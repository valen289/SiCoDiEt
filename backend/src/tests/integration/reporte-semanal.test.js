// Cubre el job de reporte semanal (2.3): que generarYEnviarReporteSemanal calcule y
// "envie" (modo dev-log, sin BREVO_API_KEY) sin tirar excepcion, que la variacion
// porcentual no rompa al dividir por cero, y la idempotencia de
// notificaciones_programadas_enviadas (mismo mecanismo que el recordatorio de AM).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { getSetup, crearTambo, crearUsuario, crearInsumo, crearLote, pool } = require('./helpers/setup');
const { generarYEnviarReporteSemanal, variacionPct } = require('../../jobs/reporteSemanal');

let ctx;
let tamboId;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  tamboId = await crearTambo('Tambo Reporte Semanal');
  await crearUsuario({ tamboId, rol: 'dueno', email: 'dueno-reporte@test.local' });
  await crearInsumo({ tamboId, nombre: 'Fardo Reporte', stockActual: 100 });
  await crearLote({ tamboId, nombre: 'Lote Reporte', cantidadAnimales: 15 });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

test('variacionPct no divide por cero: sin actividad la semana anterior devuelve null', () => {
  assert.equal(variacionPct(50, 0), null);
  assert.equal(variacionPct(50, null), null);
  assert.equal(variacionPct(60, 50), 20);
  assert.equal(variacionPct(40, 50), -20);
});

test('generarYEnviarReporteSemanal no tira excepcion con datos reales del tambo', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const [[tambo]] = await pool.query('SELECT nombre, zona_horaria FROM tambos WHERE id = ?', [tamboId]);

  await assert.doesNotReject(
    generarYEnviarReporteSemanal(tamboId, tambo.nombre, tambo.zona_horaria)
  );
});

test('generarYEnviarReporteSemanal no falla si el tambo no tiene destinatarios con email', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const tamboSinEmail = await crearTambo('Tambo Sin Email');
  await crearUsuario({ tamboId: tamboSinEmail, rol: 'dueno', email: null });

  await assert.doesNotReject(
    generarYEnviarReporteSemanal(tamboSinEmail, 'Tambo Sin Email', 'America/Montevideo')
  );
});

test('el mecanismo de idempotencia evita mandar el reporte dos veces la misma semana', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const hoy = new Date().toISOString().split('T')[0];
  await pool.query(
    "INSERT INTO notificaciones_programadas_enviadas (tambo_id, tipo, fecha) VALUES (?, 'reporte_semanal', ?)",
    [tamboId, hoy]
  );

  let duplicado;
  try {
    await pool.query(
      "INSERT INTO notificaciones_programadas_enviadas (tambo_id, tipo, fecha) VALUES (?, 'reporte_semanal', ?)",
      [tamboId, hoy]
    );
  } catch (err) {
    duplicado = err;
  }
  assert.equal(duplicado?.code, 'ER_DUP_ENTRY');
});
