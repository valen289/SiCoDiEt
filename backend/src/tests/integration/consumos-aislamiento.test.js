// Cubre el fix de aislamiento en POST /api/consumos: antes, un insumo_id o lote_id
// de otro tambo se podia usar para leer y modificar stock ajeno (ver consumos.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, crearInsumo, crearLote, generarToken, pool, app } = require('./helpers/setup');

let ctx;
let tokenA, insumoA, loteA, insumoB, loteB;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  const tamboA = await crearTambo('Tambo Consumos A');
  const tamboB = await crearTambo('Tambo Consumos B');

  const usuarioA = await crearUsuario({ tamboId: tamboA, rol: 'encargado' });
  tokenA = generarToken(usuarioA);

  insumoA = await crearInsumo({ tamboId: tamboA, nombre: 'Insumo A', stockActual: 500 });
  loteA = await crearLote({ tamboId: tamboA });
  insumoB = await crearInsumo({ tamboId: tamboB, nombre: 'Insumo B', stockActual: 500 });
  loteB = await crearLote({ tamboId: tamboB });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('POST /api/consumos con insumo_id de otro tambo es rechazado y no toca el stock ajeno', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/consumos')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ lote_id: loteA.id, insumo_id: insumoB.id, cantidad: 10 });

  assert.equal(res.status, 404);

  const [[fila]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumoB.id]);
  assert.equal(parseFloat(fila.stock_actual), 500);
});

test('POST /api/consumos con lote_id de otro tambo es rechazado y no toca el stock', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const [[antes]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumoA.id]);

  const res = await request(app)
    .post('/api/consumos')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ lote_id: loteB.id, insumo_id: insumoA.id, cantidad: 10 });

  assert.equal(res.status, 404);

  const [[despues]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumoA.id]);
  assert.equal(parseFloat(despues.stock_actual), parseFloat(antes.stock_actual));
});

test('POST /api/consumos con lote_id e insumo_id del propio tambo funciona normalmente', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/consumos')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ lote_id: loteA.id, insumo_id: insumoA.id, cantidad: 10 });

  assert.equal(res.status, 201);

  const [[fila]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumoA.id]);
  assert.equal(parseFloat(fila.stock_actual), 490);
});
