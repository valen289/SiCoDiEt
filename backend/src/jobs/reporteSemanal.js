const pool = require('../config/database');
const { hoyEnZona, horaEnZona, restarDiasFecha } = require('../utils/tzDate');
const { obtenerDestinatariosAlerta } = require('../utils/alertas');
const { sendReporteSemanalEmail } = require('../utils/email');

async function totalesConsumoCosto(tamboId, inicio, fin) {
  const [[fila]] = await pool.query(
    `SELECT COALESCE(SUM(c.cantidad_kg), 0) AS kg,
            COALESCE(SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)), 0) AS costo
     FROM consumo_diario_lote c
     LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
     WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ?`,
    [tamboId, inicio, fin]
  );
  return { kg: parseFloat(fila.kg), costo: parseFloat(fila.costo) };
}

// Variacion porcentual respecto a la semana anterior. Si la semana anterior no tuvo
// actividad (0), no hay "porcentaje de variacion" bien definido -- se devuelve null
// en vez de Infinity/NaN, y el template de email lo trata como "sin comparacion".
function variacionPct(actual, anterior) {
  if (!anterior || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

// Separado del gate de mas abajo para poder testear el calculo/envio sin esperar
// a que sea lunes 8am real (se llama directo desde el test de integracion).
async function generarYEnviarReporteSemanal(tamboId, tamboNombre, zonaHoraria) {
  const hoy = hoyEnZona(zonaHoraria);
  const finSemana = restarDiasFecha(hoy, 1);
  const inicioSemana = restarDiasFecha(hoy, 7);
  const finSemanaAnterior = restarDiasFecha(hoy, 8);
  const inicioSemanaAnterior = restarDiasFecha(hoy, 14);

  const totalesSemana = await totalesConsumoCosto(tamboId, inicioSemana, finSemana);
  const totalesSemanaAnterior = await totalesConsumoCosto(tamboId, inicioSemanaAnterior, finSemanaAnterior);

  const [insumosBajos] = await pool.query(
    `SELECT nombre, dias_restantes, unidad FROM insumos
     WHERE tambo_id = ? AND activo = TRUE ORDER BY dias_restantes ASC LIMIT 3`,
    [tamboId]
  );

  const [lotes] = await pool.query(
    'SELECT nombre, cantidad_animales FROM lotes WHERE tambo_id = ? AND activo = TRUE ORDER BY nombre',
    [tamboId]
  );

  const destinatarios = (await obtenerDestinatariosAlerta(tamboId, (sql, params) => pool.query(sql, params)))
    .filter((d) => d.email)
    .map((d) => d.email);
  if (destinatarios.length === 0) return;

  await sendReporteSemanalEmail(destinatarios, {
    tamboNombre,
    periodoLabel: `${inicioSemana} al ${finSemana}`,
    consumoTotalKg: totalesSemana.kg,
    costoTotal: totalesSemana.costo,
    variacionConsumoPct: variacionPct(totalesSemana.kg, totalesSemanaAnterior.kg),
    variacionCostoPct: variacionPct(totalesSemana.costo, totalesSemanaAnterior.costo),
    insumosBajos,
    lotes,
  });
}

// Corre cada ~20 min (ver server.js). Por cada tambo activo, si es lunes 8 en punto
// de SU zona horaria (no la del servidor) manda el reporte -- una vez por tambo/semana
// (ver notificaciones_programadas_enviadas).
async function enviarReportesSemanal() {
  const [tambos] = await pool.query('SELECT id, nombre, zona_horaria FROM tambos WHERE activo = TRUE');

  for (const tambo of tambos) {
    try {
      const hoy = hoyEnZona(tambo.zona_horaria);
      const esLunes = new Date(hoy + 'T00:00:00Z').getUTCDay() === 1;
      const horaLocal = parseInt(horaEnZona(tambo.zona_horaria).split(':')[0], 10);
      if (!esLunes || horaLocal !== 8) continue;

      try {
        await pool.query(
          "INSERT INTO notificaciones_programadas_enviadas (tambo_id, tipo, fecha) VALUES (?, 'reporte_semanal', ?)",
          [tambo.id, hoy]
        );
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') continue; // ya se mando este lunes
        throw error;
      }

      await generarYEnviarReporteSemanal(tambo.id, tambo.nombre, tambo.zona_horaria);
    } catch (error) {
      console.error(`Error generando reporte semanal del tambo ${tambo.id}:`, error);
    }
  }
}

module.exports = { enviarReportesSemanal, generarYEnviarReporteSemanal, variacionPct };
