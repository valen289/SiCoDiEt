// Cubre DELETE /api/tambo: el borrado permanente del establecimiento. Es la operacion
// mas destructiva del sistema, asi que el foco de este test es probar exhaustivamente
// que borrar el tambo A no toca NI UN BYTE del tambo B -- el mismo tipo de bug de
// aislamiento que se ando corrigiendo toda la sesion, pero acá con severidad maxima
// (una fila que se borra no se puede "recuperar filtrando por tambo_id" despues).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  getSetup, crearTambo, crearUsuario, crearInsumo, crearLote, generarToken, pool, app,
} = require('./helpers/setup');

let ctx;
let tamboA, duenoA, tokenDuenoA, tokenEncargadoA;
let tamboB, duenoB, tokenDuenoB;
let insumoA, loteA, insumoB, loteB;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  tamboA = await crearTambo('Tambo A - a eliminar');
  duenoA = await crearUsuario({ tamboId: tamboA, rol: 'dueno', email: 'dueno-a@test.local', password: 'Password1!' });
  const encargadoA = await crearUsuario({ tamboId: tamboA, rol: 'encargado' });
  tokenDuenoA = generarToken(duenoA);
  tokenEncargadoA = generarToken(encargadoA);
  insumoA = await crearInsumo({ tamboId: tamboA, nombre: 'Insumo A' });
  loteA = await crearLote({ tamboId: tamboA, nombre: 'Lote A' });

  // Datos en tablas sin FK real hacia tambos (huerfanas de database.sql) + push/consumo.
  await pool.query(
    'INSERT INTO proveedores (tambo_id, nombre) VALUES (?, ?)',
    [tamboA, 'Proveedor A']
  );
  const [[proveedorA]] = await pool.query('SELECT id FROM proveedores WHERE tambo_id = ?', [tamboA]);
  await pool.query(
    `INSERT INTO compras (tambo_id, proveedor_id, insumo_id, usuario_id, fecha, cantidad, precio_unitario, monto_total)
     VALUES (?, ?, ?, ?, CURDATE(), 10, 5, 50)`,
    [tamboA, proveedorA.id, insumoA.id, duenoA.id]
  );
  await pool.query(
    "INSERT INTO invitaciones (tambo_id, token, rol, creado_por, fecha_expiracion) VALUES (?, 'token-a-test', 'encargado', ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
    [tamboA, duenoA.id]
  );
  await pool.query(
    'INSERT INTO push_subscriptions (usuario_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
    [duenoA.id, 'https://endpoint-tambo-a.invalid/x', 'p256dh-a', 'auth-a']
  );
  await pool.query(
    `INSERT INTO consumos (tambo_id, lote_id, insumo_id, usuario_id, cantidad, fecha, hora)
     VALUES (?, ?, ?, ?, 5, CURDATE(), CURTIME())`,
    [tamboA, loteA.id, insumoA.id, duenoA.id]
  );

  // Tambo B: control -- no debe verse afectado por el borrado de A.
  tamboB = await crearTambo('Tambo B - control');
  duenoB = await crearUsuario({ tamboId: tamboB, rol: 'dueno' });
  tokenDuenoB = generarToken(duenoB);
  insumoB = await crearInsumo({ tamboId: tamboB, nombre: 'Insumo B' });
  loteB = await crearLote({ tamboId: tamboB, nombre: 'Lote B' });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('DELETE /api/tambo sin token es rechazado con 401', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app).delete('/api/tambo').send({ password: 'Password1!' });
  assert.equal(res.status, 401);
});

test('DELETE /api/tambo como encargado es rechazado con 403', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .delete('/api/tambo')
    .set('Authorization', `Bearer ${tokenEncargadoA}`)
    .send({ password: 'Password1!' });
  assert.equal(res.status, 403);

  const [[tambo]] = await pool.query('SELECT id FROM tambos WHERE id = ?', [tamboA]);
  assert.ok(tambo, 'el tambo debe seguir existiendo');
});

test('DELETE /api/tambo con contraseña incorrecta es rechazado y no borra nada', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .delete('/api/tambo')
    .set('Authorization', `Bearer ${tokenDuenoA}`)
    .send({ password: 'ContraseñaIncorrecta1!' });
  assert.equal(res.status, 400);

  const [[tambo]] = await pool.query('SELECT id FROM tambos WHERE id = ?', [tamboA]);
  assert.ok(tambo);
  const [usuarios] = await pool.query('SELECT id FROM usuarios WHERE tambo_id = ?', [tamboA]);
  assert.equal(usuarios.length, 2, 'dueno + encargado siguen existiendo');
});

test('DELETE /api/tambo con contraseña correcta borra TODO el tambo A y NADA del tambo B', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .delete('/api/tambo')
    .set('Authorization', `Bearer ${tokenDuenoA}`)
    .send({ password: 'Password1!' });
  assert.equal(res.status, 200);

  // --- Tambo A: todo borrado ---
  const tablasPorTamboId = [
    'tambos', 'usuarios', 'insumos', 'lotes', 'consumos', 'compras', 'invitaciones', 'proveedores',
  ];
  for (const tabla of tablasPorTamboId) {
    const columna = tabla === 'tambos' ? 'id' : 'tambo_id';
    const [filas] = await pool.query(`SELECT id FROM ${tabla} WHERE ${columna} = ?`, [tamboA]);
    assert.equal(filas.length, 0, `${tabla} deberia quedar sin filas de tambo A`);
  }

  const [pushA] = await pool.query('SELECT id FROM push_subscriptions WHERE usuario_id = ?', [duenoA.id]);
  assert.equal(pushA.length, 0, 'push_subscriptions del dueno de A debe quedar vacia');

  // --- Tambo B: intacto ---
  const [[tamboBFila]] = await pool.query('SELECT id, nombre FROM tambos WHERE id = ?', [tamboB]);
  assert.ok(tamboBFila);
  assert.equal(tamboBFila.nombre, 'Tambo B - control');

  const [usuariosB] = await pool.query('SELECT id FROM usuarios WHERE tambo_id = ?', [tamboB]);
  assert.equal(usuariosB.length, 1);
  assert.equal(usuariosB[0].id, duenoB.id);

  const [insumosB] = await pool.query('SELECT id FROM insumos WHERE tambo_id = ?', [tamboB]);
  assert.equal(insumosB.length, 1);
  assert.equal(insumosB[0].id, insumoB.id);

  const [lotesB] = await pool.query('SELECT id FROM lotes WHERE tambo_id = ?', [tamboB]);
  assert.equal(lotesB.length, 1);
  assert.equal(lotesB[0].id, loteB.id);
});

test('el JWT del dueño de un tambo eliminado deja de servir para cualquier ruta protegida', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  // El tambo A ya fue eliminado en el test anterior -- el token de duenoA sigue
  // siendo criptograficamente valido, pero el usuario ya no existe en la DB.
  const res = await request(app)
    .get('/api/insumos')
    .set('Authorization', `Bearer ${tokenDuenoA}`);

  assert.equal(res.status, 401);
});

test('el dueño de B (token distinto) puede seguir usando su tambo con normalidad', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .get('/api/insumos')
    .set('Authorization', `Bearer ${tokenDuenoB}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.insumos.length, 1);
  assert.equal(res.body.insumos[0].nombre, 'Insumo B');
});

// Regresión: los tests de arriba insertan datos directo por SQL (siempre con tambo_id
// explícito), así que nunca hubieran detectado que POST /insumos/:id/cargar y
// POST /insumos/consumo-diario insertaban en historial_cargas_alimentos, consumo_diario,
// movimientos_stock y alertas SIN columna tambo_id -- la fila caía en el DEFAULT 1 de la
// columna sin importar el tambo real, y esas filas huérfanas después bloqueaban el propio
// DELETE /api/tambo por FK contra insumos. Este test pasa por las rutas reales para que
// esa clase de bug no pueda volver a colarse sin que un test lo note.
test('borrar un tambo con datos creados via las rutas reales (carga de stock + consumo diario + dieta) no queda bloqueado por FK', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const tamboC = await crearTambo('Tambo C - flujo real');
  const duenoC = await crearUsuario({ tamboId: tamboC, rol: 'dueno', password: 'Password1!' });
  const tokenC = generarToken(duenoC);

  const insumoRes = await request(app)
    .post('/api/insumos')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({ nombre: 'Fardo C', tipo_insumo: 'fardo', unidad: 'unidades', capacidad_maxima: 100, stock_actual: 5, stock_minimo: 50 });
  assert.equal(insumoRes.status, 201);
  const insumoId = insumoRes.body.insumoId;

  const loteRes = await request(app)
    .post('/api/lotes')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({ nombre: 'Lote C', tipo_animal: 'Vaca lechera', cantidad_animales: 15, objetivo_productivo: 'leche' });
  assert.equal(loteRes.status, 201);
  const loteId = loteRes.body.loteId;

  // Carga de stock -- genera historial_cargas_alimentos, consumo_diario y movimientos_stock.
  const cargarRes = await request(app)
    .post(`/api/insumos/${insumoId}/cargar`)
    .set('Authorization', `Bearer ${tokenC}`)
    .send({ cantidad: 10 });
  assert.equal(cargarRes.status, 200);

  await request(app).put(`/api/dietas/costos/${insumoId}`).set('Authorization', `Bearer ${tokenC}`).send({ precio_por_kg: 0.5 });
  await request(app).put(`/api/dietas/parametros/${insumoId}`).set('Authorization', `Bearer ${tokenC}`)
    .send({ materia_seca_porcentaje: 90, energia_mcal_por_kg: 2, proteina_porcentaje: 15, fibra_porcentaje: 20 });

  const dietaRes = await request(app)
    .post('/api/dietas')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({
      nombre: 'Dieta C', lote_id: loteId,
      ingredientes: [{ insumo_id: insumoId, cantidad_kg: 2, porcentaje_am: 50 }],
      produccion_leche_esperada: 20, precio_leche_por_litro: 0.45,
    });
  assert.equal(dietaRes.status, 201);

  // Consumo diario -- stock bajo capacidad/minimo fuerza una alerta de stock crítico,
  // que es exactamente donde apareció el bug original.
  const consumoRes = await request(app)
    .post('/api/insumos/consumo-diario')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({
      fecha: '2026-08-19', turno: 'AM', lote_id: loteId, cantidad_animales: 15,
      ingredientes: [{ insumo_id: insumoId, cantidad_kg: 5, origen_cantidad: 'manual' }],
      observacion: 'test', porcentaje_sobra: 5,
    });
  assert.equal(consumoRes.status, 200);

  // Todas las filas generadas por las rutas de arriba deben quedar atribuidas al tambo C,
  // nunca al DEFAULT de la columna (tambo 1).
  for (const tabla of ['historial_cargas_alimentos', 'consumo_diario', 'movimientos_stock', 'alertas']) {
    const [filas] = await pool.query(`SELECT id, tambo_id FROM ${tabla} WHERE insumo_id = ?`, [insumoId]);
    assert.ok(filas.length > 0, `${tabla} deberia tener al menos una fila para este insumo`);
    for (const fila of filas) {
      assert.equal(fila.tambo_id, tamboC, `${tabla}.id=${fila.id} deberia tener tambo_id=${tamboC}, no ${fila.tambo_id}`);
    }
  }

  const delRes = await request(app)
    .delete('/api/tambo')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({ password: 'Password1!' });
  assert.equal(delRes.status, 200);

  const [[tamboCheck]] = await pool.query('SELECT id FROM tambos WHERE id = ?', [tamboC]);
  assert.equal(tamboCheck, undefined);
});
