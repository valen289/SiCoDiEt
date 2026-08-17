// Login con 2FA de punta a punta. El código real lo genera el servidor al azar y
// se manda por email (Brevo) -- como no hay BREVO_API_KEY en el entorno de test,
// el email queda en modo no-op (solo console.log) y no podemos leer el código real
// desde afuera. Para probar el flujo completo igual, simulamos "el código que le
// habría llegado por mail" pisando directamente el hash en la DB con uno conocido,
// exactamente como lo dejaría el propio POST /login (mismo algoritmo: sha256).
// Esto SÍ ejercita la ruta real de verify-2fa (hash, expiración, emisión de JWT,
// token_version) -- lo único simulado es el canal de entrega del código.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, pool, app } = require('./helpers/setup');

let ctx;
let usuario;
let tempToken;
const CODIGO_SIMULADO = '123456';

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  const tamboId = await crearTambo('Tambo 2FA');
  usuario = await crearUsuario({ tamboId, rol: 'dueno', email: 'dueno@test.local', password: 'Password1!' });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('login con usuario que tiene email dispara el flujo de 2FA (no loguea directo)', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/auth/login')
    .send({ cedula: usuario.cedula, password: usuario.password });

  assert.equal(res.status, 200);
  assert.equal(res.body.requiresTwoFactor, true);
  assert.ok(res.body.tempToken);

  // El login ya generó y hasheó un código real (que "se envió" por email); lo
  // pisamos con uno conocido para poder verificarlo desde el test.
  const codeHash = crypto.createHash('sha256').update(CODIGO_SIMULADO).digest('hex');
  await pool.query(
    'UPDATE usuarios SET two_factor_code_hash = ?, two_factor_code_expires = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?',
    [codeHash, usuario.id]
  );

  tempToken = res.body.tempToken;
});

test('verify-2fa con código incorrecto es rechazado', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/auth/verify-2fa')
    .send({ tempToken, code: '000000' });

  assert.equal(res.status, 400);
});

test('verify-2fa con el código correcto completa el login y emite un JWT válido', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/auth/verify-2fa')
    .send({ tempToken, code: CODIGO_SIMULADO });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.equal(res.body.user.cedula, usuario.cedula);
  assert.equal(res.body.user.tambo_id, usuario.tambo_id);

  // El JWT emitido debe servir para pegarle a una ruta protegida real.
  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${res.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, usuario.id);
});
