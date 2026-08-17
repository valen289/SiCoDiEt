// Cubre el camino que mueve stock real: registrar consumo, rechazar consumo que
// supera el stock disponible, y cargar alimento sin superar la capacidad máxima.
// Requiere la DB de test (docker-compose.test.yml) -- si no está levantada, se saltea.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, crearInsumo, crearLote, generarToken, pool, app } = require('./helpers/setup');

let ctx;
let tamboId, token, insumo, lote;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  tamboId = await crearTambo('Tambo Consumo Stock');
  const usuario = await crearUsuario({ tamboId, rol: 'encargado' });
  token = generarToken(usuario);
  insumo = await crearInsumo({ tamboId, nombre: 'Fardo Alfalfa', stockActual: 500, capacidadMaxima: 1000 });
  lote = await crearLote({ tamboId, cantidadAnimales: 10 });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('registrar un consumo reduce el stock correctamente', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/insumos/consumo-diario')
    .set('Authorization', `Bearer ${token}`)
    .send({
      fecha: '2026-01-10',
      turno: 'AM',
      lote_id: lote.id,
      cantidad_animales: 10,
      ingredientes: [{ insumo_id: insumo.id, cantidad_kg: 50 }],
    });

  assert.equal(res.status, 200);

  const [[fila]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumo.id]);
  assert.equal(parseFloat(fila.stock_actual), 450);
});

test('un consumo que supera el stock disponible es rechazado con 400 y no toca el stock', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const [[antes]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumo.id]);

  const res = await request(app)
    .post('/api/insumos/consumo-diario')
    .set('Authorization', `Bearer ${token}`)
    .send({
      fecha: '2026-01-11',
      turno: 'AM',
      lote_id: lote.id,
      cantidad_animales: 10,
      ingredientes: [{ insumo_id: insumo.id, cantidad_kg: 999999 }],
    });

  assert.equal(res.status, 400);

  const [[despues]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumo.id]);
  assert.equal(parseFloat(despues.stock_actual), parseFloat(antes.stock_actual));
});

test('cargar alimento aumenta el stock', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const [[antes]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumo.id]);

  const res = await request(app)
    .post(`/api/insumos/${insumo.id}/cargar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ cantidad: 100 });

  assert.equal(res.status, 200);

  const [[despues]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumo.id]);
  assert.equal(parseFloat(despues.stock_actual), parseFloat(antes.stock_actual) + 100);
});

test('cargar alimento por encima de la capacidad máxima es rechazado con 400', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const [[antes]] = await pool.query('SELECT stock_actual, capacidad_maxima FROM insumos WHERE id = ?', [insumo.id]);
  const exceso = parseFloat(antes.capacidad_maxima) - parseFloat(antes.stock_actual) + 1;

  const res = await request(app)
    .post(`/api/insumos/${insumo.id}/cargar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ cantidad: exceso });

  assert.equal(res.status, 400);

  const [[despues]] = await pool.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumo.id]);
  assert.equal(parseFloat(despues.stock_actual), parseFloat(antes.stock_actual));
});
