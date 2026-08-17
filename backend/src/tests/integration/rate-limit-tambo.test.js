// Cubre el rate limiter por tambo (0.3): el cupo debe ser por tambo_id, no por IP,
// para que varios trabajadores del mismo tambo compartiendo una sola IP (router de
// campo) no se agoten entre si, y para que un tambo agotado no afecte a otro que
// comparte esa misma IP (como pasa en este test, corrido siempre desde localhost).
//
// TAMBO_RATE_LIMIT_MAX debe setearse ANTES de requerir helpers/setup (que carga
// server.js, que carga el middleware) -- el valor productivo (800-1000) haria este
// test absurdamente lento.
process.env.TAMBO_RATE_LIMIT_MAX = '5';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, generarToken, pool, app } = require('./helpers/setup');

let ctx;
let tokenA, tokenB;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  const tamboA = await crearTambo('Tambo Rate Limit A');
  const tamboB = await crearTambo('Tambo Rate Limit B');
  const usuarioA = await crearUsuario({ tamboId: tamboA, rol: 'encargado' });
  const usuarioB = await crearUsuario({ tamboId: tamboB, rol: 'encargado' });
  tokenA = generarToken(usuarioA);
  tokenB = generarToken(usuarioB);
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('el cupo se agota por tambo: la request que excede el limite responde 429', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  for (let i = 0; i < 5; i++) {
    const res = await request(app).get('/api/insumos').set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200, `request ${i + 1}/5 de tambo A deberia pasar`);
  }

  const excedida = await request(app).get('/api/insumos').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(excedida.status, 429);
});

test('un tambo distinto no se ve afectado aunque comparta la misma IP (la del test runner)', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  // tambo A ya agoto su cupo en el test anterior (misma ventana de 15min, mismo proceso).
  const agotado = await request(app).get('/api/insumos').set('Authorization', `Bearer ${tokenA}`);
  assert.equal(agotado.status, 429, 'confirma que tambo A sigue bloqueado');

  // tambo B nunca hizo una request -- si el limite fuera por IP (ambos pegan desde
  // localhost en este test), tambo B ya deberia estar afectado por lo que consumio A.
  const resB = await request(app).get('/api/insumos').set('Authorization', `Bearer ${tokenB}`);
  assert.equal(resB.status, 200, 'tambo B no deberia estar limitado por lo que hizo tambo A');
});
