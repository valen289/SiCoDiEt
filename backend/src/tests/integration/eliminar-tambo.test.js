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
