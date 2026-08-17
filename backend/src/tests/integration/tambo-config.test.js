// Cubre la ruta nueva GET/PUT /api/tambo: lectura abierta a todo el tambo, edicion
// solo para dueno, y las whitelists de moneda/zona horaria/tamano de logo.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, generarToken, pool, app } = require('./helpers/setup');

let ctx;
let tamboId, tokenDueno, tokenEncargado;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  tamboId = await crearTambo('Tambo Config');
  const dueno = await crearUsuario({ tamboId, rol: 'dueno' });
  const encargado = await crearUsuario({ tamboId, rol: 'encargado' });
  tokenDueno = generarToken(dueno);
  tokenEncargado = generarToken(encargado);
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('GET /api/tambo es visible para un encargado (config de cuenta, no solo del dueno)', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .get('/api/tambo')
    .set('Authorization', `Bearer ${tokenEncargado}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.tambo.moneda, 'UYU');
  assert.equal(res.body.tambo.zona_horaria, 'America/Montevideo');
});

test('PUT /api/tambo como encargado es rechazado con 403', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .put('/api/tambo')
    .set('Authorization', `Bearer ${tokenEncargado}`)
    .send({ moneda: 'ARS' });

  assert.equal(res.status, 403);
});

test('PUT /api/tambo como dueno actualiza nombre, moneda y zona horaria', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .put('/api/tambo')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ nombre: 'Tambo Config Editado', moneda: 'ARS', zona_horaria: 'America/Argentina/Buenos_Aires' });

  assert.equal(res.status, 200);
  assert.equal(res.body.tambo.nombre, 'Tambo Config Editado');
  assert.equal(res.body.tambo.moneda, 'ARS');
  assert.equal(res.body.tambo.zona_horaria, 'America/Argentina/Buenos_Aires');

  const [[fila]] = await pool.query('SELECT nombre, moneda, zona_horaria FROM tambos WHERE id = ?', [tamboId]);
  assert.equal(fila.nombre, 'Tambo Config Editado');
  assert.equal(fila.moneda, 'ARS');
  assert.equal(fila.zona_horaria, 'America/Argentina/Buenos_Aires');
});

test('PUT /api/tambo con moneda fuera de la whitelist es rechazado con 400', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .put('/api/tambo')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ moneda: 'EUR' });

  assert.equal(res.status, 400);
});

test('PUT /api/tambo con zona horaria fuera de la whitelist es rechazado con 400', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .put('/api/tambo')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ zona_horaria: 'Europe/Madrid' });

  assert.equal(res.status, 400);
});

test('PUT /api/tambo con un logo que excede el limite de tamano es rechazado con 400', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const logoGrande = 'data:image/png;base64,' + 'A'.repeat(2_100_000);

  const res = await request(app)
    .put('/api/tambo')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ logo: logoGrande });

  assert.equal(res.status, 400);
});

test('PUT /api/tambo con un logo valido se guarda y persiste', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const logoValido = 'data:image/png;base64,' + 'A'.repeat(1000);

  const res = await request(app)
    .put('/api/tambo')
    .set('Authorization', `Bearer ${tokenDueno}`)
    .send({ logo: logoValido });

  assert.equal(res.status, 200);
  assert.equal(res.body.tambo.logo, logoValido);

  const [[fila]] = await pool.query('SELECT logo FROM tambos WHERE id = ?', [tamboId]);
  assert.equal(fila.logo, logoValido);
});
