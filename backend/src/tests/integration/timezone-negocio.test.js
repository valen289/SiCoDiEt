// Cubre el fix de zona horaria real: antes, fecha/hora de consumos y cargas se
// generaban con CURDATE()/CURTIME()/new Date() del servidor (tipicamente UTC), lo
// que fechaba mal un registro cercano a medianoche en la zona horaria del tambo.
// Compara lo que quedo grabado contra un calculo independiente con los mismos
// helpers de tzDate.js, para la zona horaria configurada en el tambo (no la
// que use el proceso del servidor).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { getSetup, crearTambo, crearUsuario, crearInsumo, crearLote, generarToken, pool, app } = require('./helpers/setup');
const { hoyEnZona, horaEnZona } = require('../../utils/tzDate');

const ZONA = 'America/Santiago'; // distinta del default 'America/Montevideo', para
// confirmar que el valor viaja desde tambos.zona_horaria y no queda hardcodeado.

let ctx;
let token, insumo, lote;

before(async () => {
  ctx = await getSetup();
  if (!ctx.available) return;

  const tamboId = await crearTambo('Tambo Timezone');
  await pool.query('UPDATE tambos SET zona_horaria = ? WHERE id = ?', [ZONA, tamboId]);

  const usuario = await crearUsuario({ tamboId, rol: 'encargado' });
  token = generarToken(usuario);
  insumo = await crearInsumo({ tamboId, stockActual: 500 });
  lote = await crearLote({ tamboId });
});

after(async () => {
  if (ctx?.available) await pool.end();
});

function segundosDelDia(horaStr) {
  const [h, m, s] = horaStr.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

test('POST /api/consumos usa la fecha/hora de la zona horaria del tambo, no la del servidor', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/consumos')
    .set('Authorization', `Bearer ${token}`)
    .send({ lote_id: lote.id, insumo_id: insumo.id, cantidad: 5 });

  assert.equal(res.status, 201);

  const esperado = { fecha: hoyEnZona(ZONA), hora: horaEnZona(ZONA) };
  // DATE_FORMAT evita que el driver convierta la columna DATE a un objeto Date de JS
  // (lo que dependeria del timezone del propio proceso de test, no del tambo).
  const [[fila]] = await pool.query(
    `SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, hora FROM consumos ORDER BY id DESC LIMIT 1`
  );

  assert.equal(fila.fecha, esperado.fecha);
  assert.ok(
    Math.abs(segundosDelDia(fila.hora) - segundosDelDia(esperado.hora)) < 10,
    `hora guardada (${fila.hora}) muy distinta de la esperada (${esperado.hora}) para ${ZONA}`
  );
});

test('POST /api/insumos/consumo-diario sin fecha explicita usa "hoy" en la zona horaria del tambo', async (t) => {
  if (!ctx.available) return t.skip('DB de test no disponible');

  const res = await request(app)
    .post('/api/insumos/consumo-diario')
    .set('Authorization', `Bearer ${token}`)
    .send({
      turno: 'AM',
      lote_id: lote.id,
      cantidad_animales: 10,
      ingredientes: [{ insumo_id: insumo.id, cantidad_kg: 3 }],
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.fecha, hoyEnZona(ZONA));
});
