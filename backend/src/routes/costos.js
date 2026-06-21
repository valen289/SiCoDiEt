const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

const duenoEncargado = authorizeRoles('dueno', 'encargado');

function getDateRange(query) {
  let { fecha_inicio, fecha_fin } = query;
  if (!fecha_inicio || !fecha_fin) {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    fecha_inicio = start.toISOString().split('T')[0];
    fecha_fin = now.toISOString().split('T')[0];
  }
  return { fecha_inicio, fecha_fin };
}

// KPI cards: total período, promedio diario, lote más caro, insumo más caro
router.get('/resumen', duenoEncargado, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = getDateRange(req.query);
    const { lote_id } = req.query;
    const tambo_id = req.user.tambo_id;

    const baseParams = [tambo_id, fecha_inicio, fecha_fin];
    if (lote_id) baseParams.push(lote_id);

    const loteFiltro = lote_id ? 'AND c.lote_id = ?' : '';

    const [[totalesRow]] = await pool.query(`
      SELECT
        SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)) AS costo_total,
        COUNT(DISTINCT c.fecha)                             AS dias_con_consumo
      FROM consumo_diario_lote c
      LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
      WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ? ${loteFiltro}
    `, baseParams);

    const [lotesRows] = await pool.query(`
      SELECT l.nombre AS lote_nombre,
             SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)) AS costo_total
      FROM consumo_diario_lote c
      JOIN lotes l ON c.lote_id = l.id
      LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
      WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ? ${loteFiltro}
      GROUP BY c.lote_id, l.nombre
      ORDER BY costo_total DESC
      LIMIT 1
    `, baseParams);

    const [insumosRows] = await pool.query(`
      SELECT i.nombre AS insumo_nombre,
             SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)) AS costo_total
      FROM consumo_diario_lote c
      JOIN insumos i ON c.insumo_id = i.id
      LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
      WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ? ${loteFiltro}
      GROUP BY c.insumo_id, i.nombre
      ORDER BY costo_total DESC
      LIMIT 1
    `, baseParams);

    const costoTotal = parseFloat(totalesRow.costo_total) || 0;
    const dias = parseInt(totalesRow.dias_con_consumo) || 0;

    res.json({
      resumen: {
        costo_total: costoTotal,
        promedio_diario: dias > 0 ? costoTotal / dias : 0,
        dias_con_consumo: dias,
        lote_mas_caro: lotesRows[0] || null,
        insumo_mas_caro: insumosRows[0] || null,
        fecha_inicio,
        fecha_fin,
      },
    });
  } catch (error) {
    console.error('Error obteniendo resumen de costos:', error);
    res.status(500).json({ error: 'Error al obtener resumen de costos' });
  }
});

// Tabla agrupada por lote
router.get('/por-lote', duenoEncargado, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = getDateRange(req.query);
    const { lote_id } = req.query;
    const tambo_id = req.user.tambo_id;

    const loteFiltro = lote_id ? 'AND l.id = ?' : '';
    const params = [tambo_id, fecha_inicio, fecha_fin, tambo_id];
    if (lote_id) params.push(lote_id);

    const [rows] = await pool.query(`
      SELECT
        l.id                                                                 AS lote_id,
        l.nombre                                                            AS lote_nombre,
        COALESCE(l.cantidad_animales, 0)                                     AS cantidad_animales,
        COALESCE(SUM(c.cantidad_kg), 0)                                      AS total_kg,
        COALESCE(SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)), 0)      AS costo_total,
        COUNT(DISTINCT c.fecha)                                              AS dias_con_consumo,
        CASE
          WHEN COALESCE(l.cantidad_animales, 0) > 0 AND COUNT(DISTINCT c.fecha) > 0
          THEN SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0))
               / COALESCE(l.cantidad_animales, 1) / COUNT(DISTINCT c.fecha)
          ELSE 0
        END                                                                  AS costo_animal_dia
      FROM lotes l
      LEFT JOIN consumo_diario_lote c
        ON c.lote_id = l.id AND c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
      LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
      WHERE l.tambo_id = ? AND l.activo = TRUE ${loteFiltro}
      GROUP BY l.id, l.nombre, l.cantidad_animales
      ORDER BY costo_total DESC
    `, params);

    res.json({ lotes: rows, fecha_inicio, fecha_fin });
  } catch (error) {
    console.error('Error obteniendo costos por lote:', error);
    res.status(500).json({ error: 'Error al obtener costos por lote' });
  }
});

// Tabla día a día
router.get('/diario', duenoEncargado, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = getDateRange(req.query);
    const { lote_id } = req.query;
    const tambo_id = req.user.tambo_id;

    const params = [tambo_id, fecha_inicio, fecha_fin];
    const loteFiltro = lote_id ? 'AND c.lote_id = ?' : '';
    if (lote_id) params.push(lote_id);

    const [rows] = await pool.query(`
      SELECT
        c.fecha,
        SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)) AS costo_total,
        SUM(c.cantidad_kg)                                  AS total_kg,
        COUNT(DISTINCT c.lote_id)                           AS lotes_activos
      FROM consumo_diario_lote c
      LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
      WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ? ${loteFiltro}
      GROUP BY c.fecha
      ORDER BY c.fecha DESC
    `, params);

    res.json({ dias: rows, fecha_inicio, fecha_fin });
  } catch (error) {
    console.error('Error obteniendo costos diarios:', error);
    res.status(500).json({ error: 'Error al obtener costos diarios' });
  }
});

module.exports = router;
