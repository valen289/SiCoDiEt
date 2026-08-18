const pool = require('../config/database');
const { hoyEnZona, horaEnZona } = require('../utils/tzDate');
const { enviarPushATambo } = require('../utils/webpush');

// Corre cada ~20 min (ver server.js). Por cada tambo activo, si son las 10 en punto
// de SU zona horaria (no la del servidor) y todavia no registro el consumo del turno
// AM de hoy, manda un push -- una vez por tambo/dia (ver notificaciones_programadas_enviadas).
async function verificarConsumosAMPendientes() {
  const [tambos] = await pool.query('SELECT id, zona_horaria FROM tambos WHERE activo = TRUE');

  for (const tambo of tambos) {
    try {
      const horaLocal = parseInt(horaEnZona(tambo.zona_horaria).split(':')[0], 10);
      if (horaLocal !== 10) continue;

      const hoy = hoyEnZona(tambo.zona_horaria);

      const [[{ lotesActivos }]] = await pool.query(
        'SELECT COUNT(*) AS lotesActivos FROM lotes WHERE tambo_id = ? AND activo = TRUE',
        [tambo.id]
      );
      if (lotesActivos === 0) continue;

      const [[{ consumoAM }]] = await pool.query(
        `SELECT COUNT(*) AS consumoAM FROM consumo_diario_lote
         WHERE tambo_id = ? AND fecha = ? AND turno = 'AM'`,
        [tambo.id, hoy]
      );
      if (consumoAM > 0) continue;

      try {
        await pool.query(
          'INSERT INTO notificaciones_programadas_enviadas (tambo_id, tipo, fecha) VALUES (?, ?, ?)',
          [tambo.id, 'consumo_am_pendiente', hoy]
        );
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') continue; // ya se mando hoy
        throw error;
      }

      await enviarPushATambo(tambo.id, ['dueno', 'encargado'], {
        title: 'Consumo de la mañana sin registrar',
        body: 'Todavía no se registró el consumo del turno AM de hoy.',
        tag: 'consumo-am-pendiente',
        url: '/consumos',
      });
    } catch (error) {
      console.error(`Error verificando consumo AM del tambo ${tambo.id}:`, error);
    }
  }
}

module.exports = { verificarConsumosAMPendientes };
