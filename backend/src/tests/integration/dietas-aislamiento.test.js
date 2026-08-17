// Cubre el fix de aislamiento en dietas.js: un insumo_id de otro tambo dentro del
// array `ingredientes` debia quedar excluido del calculo (no filtrar nombre/costo/
// parametros nutricionales ajenos, ni persistirse en dieta_ingredientes).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, crearInsumo, crearLote, generarToken, pool, app } = require('./helpers/setup');

let ctx;
let tokenA, loteA, insumoA, insumoB;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  const tamboA = await crearTambo('Tambo Dietas A');
  const tamboB = await crearTambo('Tambo Dietas B');

  const usuarioA = await crearUsuario({ tamboId: tamboA, rol: 'dueno' });
  tokenA = generarToken(usuarioA);

  loteA = await crearLote({ tamboId: tamboA, cantidadAnimales: 20 });
  insumoA = await crearInsumo({ tamboId: tamboA, nombre: 'Insumo Propio' });
  insumoB = await crearInsumo({ tamboId: tamboB, nombre: 'Insumo Ajeno Secreto' });

  // Le da un precio al insumo ajeno para poder detectar si su costo se filtra igual.
  await pool.query('INSERT INTO costos_ingredientes (insumo_id, precio_por_kg) VALUES (?, ?)', [insumoB.id, 999]);
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('POST /api/dietas/calcular excluye un insumo_id de otro tambo sin filtrar sus datos', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/dietas/calcular')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      lote_id: loteA.id,
      produccion_leche_esperada: 25,
      precio_leche_por_litro: 10,
      ingredientes: [
        { insumo_id: insumoA.id, cantidad_kg: 5 },
        { insumo_id: insumoB.id, cantidad_kg: 5 },
      ],
    });

  assert.equal(res.status, 200);
  const nombres = res.body.ingredientes.map(i => i.nombre);
  assert.ok(nombres.includes('Insumo Propio'));
  assert.ok(!nombres.includes('Insumo Ajeno Secreto'), 'no debe filtrar el nombre del insumo de otro tambo');
  assert.equal(res.body.ingredientes.length, 1);
});

test('POST /api/dietas no persiste en dieta_ingredientes un insumo_id de otro tambo', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/dietas')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      nombre: 'Dieta Mixta',
      lote_id: loteA.id,
      produccion_leche_esperada: 25,
      precio_leche_por_litro: 10,
      ingredientes: [
        { insumo_id: insumoA.id, cantidad_kg: 5 },
        { insumo_id: insumoB.id, cantidad_kg: 5 },
      ],
    });

  assert.equal(res.status, 201);

  const [filas] = await pool.query('SELECT insumo_id FROM dieta_ingredientes WHERE dieta_id = ?', [res.body.id]);
  const insumoIds = filas.map(f => f.insumo_id);
  assert.deepEqual(insumoIds, [insumoA.id]);
});

test('DELETE /api/dietas/:id con id de otro tambo es rechazado con 404', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const creada = await request(app)
    .post('/api/dietas')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      nombre: 'Dieta Propia',
      lote_id: loteA.id,
      produccion_leche_esperada: 25,
      precio_leche_por_litro: 10,
      ingredientes: [{ insumo_id: insumoA.id, cantidad_kg: 5 }],
    });
  assert.equal(creada.status, 201);
  const dietaId = creada.body.id;

  const usuarioB = await crearUsuario({ tamboId: insumoB.tambo_id, rol: 'dueno' });
  const tokenB = generarToken(usuarioB);

  const resDelete = await request(app)
    .delete(`/api/dietas/${dietaId}`)
    .set('Authorization', `Bearer ${tokenB}`);

  assert.equal(resDelete.status, 404);

  const [[dieta]] = await pool.query('SELECT activo FROM dietas WHERE id = ?', [dietaId]);
  assert.equal(dieta.activo, 1);
});
