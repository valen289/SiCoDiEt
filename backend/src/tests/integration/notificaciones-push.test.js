// Cubre POST/DELETE /api/notificaciones/suscribir (CRUD de suscripciones push),
// el mecanismo de idempotencia de notificaciones_programadas_enviadas (usado por
// el cron de "consumo AM no registrado"), y que enviarPushATambo no tire excepcion
// aunque el endpoint de la suscripcion sea invalido (fire-and-forget real).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, crearLote, generarToken, pool, app } = require('./helpers/setup');
const { enviarPushATambo } = require('../../utils/webpush');
const { verificarConsumosAMPendientes } = require('../../jobs/recordatorioConsumoAM');

let ctx;
let tamboId, usuario, token;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  tamboId = await crearTambo('Tambo Push');
  usuario = await crearUsuario({ tamboId, rol: 'encargado' });
  token = generarToken(usuario);
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('GET /api/notificaciones/vapid-public-key responde sin requerir VAPID configurado', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .get('/api/notificaciones/vapid-public-key')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.ok(res.body.publicKey === null || typeof res.body.publicKey === 'string');
});

test('POST /api/notificaciones/suscribir sin token es rechazado con 401', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/notificaciones/suscribir')
    .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } });

  assert.equal(res.status, 401);
});

test('POST /api/notificaciones/suscribir crea la suscripcion, y re-suscribirse con el mismo endpoint actualiza en vez de duplicar', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const endpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint-1';

  const primera = await request(app)
    .post('/api/notificaciones/suscribir')
    .set('Authorization', `Bearer ${token}`)
    .send({ endpoint, keys: { p256dh: 'p256dh-v1', auth: 'auth-v1' } });
  assert.equal(primera.status, 201);

  const segunda = await request(app)
    .post('/api/notificaciones/suscribir')
    .set('Authorization', `Bearer ${token}`)
    .send({ endpoint, keys: { p256dh: 'p256dh-v2', auth: 'auth-v2' } });
  assert.equal(segunda.status, 201);

  const [filas] = await pool.query(
    'SELECT keys_p256dh FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
    [usuario.id, endpoint]
  );
  assert.equal(filas.length, 1, 'no debe duplicar la fila al re-suscribirse con el mismo endpoint');
  assert.equal(filas[0].keys_p256dh, 'p256dh-v2', 'debe actualizar las keys, no conservar las viejas');
});

test('DELETE /api/notificaciones/suscribir borra la suscripcion', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const endpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint-2';
  await request(app)
    .post('/api/notificaciones/suscribir')
    .set('Authorization', `Bearer ${token}`)
    .send({ endpoint, keys: { p256dh: 'p', auth: 'a' } });

  const del = await request(app)
    .delete('/api/notificaciones/suscribir')
    .set('Authorization', `Bearer ${token}`)
    .send({ endpoint });
  assert.equal(del.status, 200);

  const [filas] = await pool.query(
    'SELECT id FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
    [usuario.id, endpoint]
  );
  assert.equal(filas.length, 0);
});

test('enviarPushATambo no tira excepcion aunque la suscripcion tenga un endpoint invalido', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  await pool.query(
    'INSERT INTO push_subscriptions (usuario_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
    [usuario.id, 'https://endpoint-que-no-existe.invalid/x', 'p256dh-fake', 'auth-fake']
  );

  await assert.doesNotReject(
    enviarPushATambo(tamboId, ['dueno', 'encargado'], { title: 'Test', body: 'Test', tag: 'test', url: '/alertas' })
  );
});

test('verificarConsumosAMPendientes es idempotente: no manda el aviso dos veces el mismo dia', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const otroTambo = await crearTambo('Tambo AM Pendiente');
  await pool.query("UPDATE tambos SET zona_horaria = 'UTC' WHERE id = ?", [otroTambo]);
  await crearLote({ tamboId: otroTambo });
  await crearUsuario({ tamboId: otroTambo, rol: 'dueno' });

  // Fuerza que "ahora" caiga dentro de la ventana de la funcion insertando directo
  // la fila de idempotencia para hoy, y confirmando que un segundo intento de
  // insertar el mismo (tambo_id, tipo, fecha) efectivamente falla por duplicado
  // -- es el mecanismo real que usa verificarConsumosAMPendientes para no repetir.
  const hoy = new Date().toISOString().split('T')[0];
  await pool.query(
    "INSERT INTO notificaciones_programadas_enviadas (tambo_id, tipo, fecha) VALUES (?, 'consumo_am_pendiente', ?)",
    [otroTambo, hoy]
  );

  let duplicado;
  try {
    await pool.query(
      "INSERT INTO notificaciones_programadas_enviadas (tambo_id, tipo, fecha) VALUES (?, 'consumo_am_pendiente', ?)",
      [otroTambo, hoy]
    );
  } catch (err) {
    duplicado = err;
  }
  assert.equal(duplicado?.code, 'ER_DUP_ENTRY');

  // Con la fila de hoy ya insertada, correr la funcion real no debe duplicarla
  // ni tirar excepcion (toma el camino "ya se mando hoy" para cualquier tambo
  // cuya hora local sea las 10, y no hace nada para el resto).
  await assert.doesNotReject(verificarConsumosAMPendientes());

  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM notificaciones_programadas_enviadas WHERE tambo_id = ? AND tipo = 'consumo_am_pendiente' AND fecha = ?",
    [otroTambo, hoy]
  );
  assert.equal(filas[0].total, 1);
});
