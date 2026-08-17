// Cubre el flujo de invitación con token: una invitación vencida se rechaza en el
// registro, y una vigente asigna correctamente el rol/tambo del invitado.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, cedulaAlAzar, pool, app } = require('./helpers/setup');

let ctx;
let tamboId;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  tamboId = await crearTambo('Tambo Invitaciones');
  await crearUsuario({ tamboId, rol: 'dueno' });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

async function crearInvitacion({ rol = 'trabajador', expiraEnHoras = 24, usado = 0 }) {
  const token = crypto.randomBytes(16).toString('hex');
  const [[dueno]] = await pool.query('SELECT id FROM usuarios WHERE tambo_id = ? AND rol = "dueno" LIMIT 1', [tamboId]);
  await pool.query(
    'INSERT INTO invitaciones (tambo_id, token, rol, creado_por, fecha_expiracion, usado) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?)',
    [tamboId, token, rol, dueno.id, expiraEnHoras, usado]
  );
  return token;
}

test('registrarse con una invitación vencida es rechazado con 400', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const tokenVencido = await crearInvitacion({ expiraEnHoras: -1 });

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      cedula: cedulaAlAzar(),
      nombre: 'Operario Tardío',
      email: 'tardio@test.local',
      password: 'Password1!',
      invitation_token: tokenVencido,
    });

  assert.equal(res.status, 400);
  assert.match(res.body.error.toLowerCase(), /inválida|expirada|invalida/);
});

test('registrarse con una invitación vigente asigna el rol y el tambo de la invitación', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const tokenVigente = await crearInvitacion({ rol: 'encargado', expiraEnHoras: 24 });

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      cedula: cedulaAlAzar(),
      nombre: 'Nuevo Encargado',
      email: 'encargado@test.local',
      password: 'Password1!',
      invitation_token: tokenVigente,
    });

  assert.equal(res.status, 201);

  const [[creado]] = await pool.query('SELECT tambo_id, rol FROM usuarios WHERE id = ?', [res.body.userId]);
  assert.equal(creado.tambo_id, tamboId);
  assert.equal(creado.rol, 'encargado');

  const [[invitacion]] = await pool.query('SELECT usado, usuario_id FROM invitaciones WHERE token = ?', [tokenVigente]);
  assert.equal(invitacion.usado, 1);
  assert.equal(invitacion.usuario_id, res.body.userId);
});

test('una invitación ya usada no puede reutilizarse', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const tokenUsado = await crearInvitacion({ expiraEnHoras: 24, usado: 1 });

  const res = await request(app)
    .post('/api/auth/register')
    .send({
      cedula: cedulaAlAzar(),
      nombre: 'Otro Operario',
      email: 'otro@test.local',
      password: 'Password1!',
      invitation_token: tokenUsado,
    });

  assert.equal(res.status, 400);
});
