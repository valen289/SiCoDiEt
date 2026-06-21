const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

const duenoEncargado = authorizeRoles('dueno', 'encargado');

// GET /api/movimientos - Listar movimientos con filtros
router.get('/', duenoEncargado, async (req, res) => {
  try {
    const { insumo_id, tipo, tipo_insumo, fecha_inicio, fecha_fin, lote_id, page = 1, limit = 50 } = req.query;

    let query = `
      SELECT m.*,
             i.nombre as insumo_nombre,
             i.unidad,
             i.tipo_insumo,
             l.nombre as lote_nombre,
             u.nombre as usuario_nombre
      FROM movimientos_stock m
      JOIN insumos i ON m.insumo_id = i.id
      LEFT JOIN lotes l ON m.lote_id = l.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.tambo_id = ?
    `;
    const params = [req.user.tambo_id];

    if (insumo_id) {
      query += ' AND m.insumo_id = ?';
      params.push(insumo_id);
    }

    if (tipo) {
      query += ' AND m.tipo = ?';
      params.push(tipo);
    }

    if (tipo_insumo) {
      query += ' AND i.tipo_insumo = ?';
      params.push(tipo_insumo);
    }

    if (fecha_inicio) {
      query += ' AND m.fecha >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ' AND m.fecha <= ?';
      params.push(fecha_fin);
    }

    if (lote_id) {
      query += ' AND m.lote_id = ?';
      params.push(lote_id);
    }

    // Count total for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].total;

    query += ' ORDER BY m.fecha DESC, m.hora DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const [movimientos] = await pool.query(query, params);

    res.json({
      movimientos,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo movimientos:', error);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// GET /api/movimientos/resumen - Resumen por período
router.get('/resumen', duenoEncargado, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, insumo_id, tipo_insumo, tipo } = req.query;

    let query = `
      SELECT
        m.insumo_id,
        i.nombre as insumo_nombre,
        i.unidad,
        i.tipo_insumo,
        COUNT(*) as movimientos_count,
        SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN m.tipo = 'consumo' THEN m.cantidad ELSE 0 END) as total_consumos,
        (
          SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE 0 END)
          + SUM(CASE WHEN m.tipo = 'ajuste_positivo' THEN m.cantidad ELSE 0 END)
          - SUM(CASE WHEN m.tipo = 'consumo' THEN m.cantidad ELSE 0 END)
          - SUM(CASE WHEN m.tipo = 'ajuste_negativo' THEN m.cantidad ELSE 0 END)
        ) as balance_neto
      FROM movimientos_stock m
      JOIN insumos i ON m.insumo_id = i.id
      WHERE m.tambo_id = ?
    `;
    const params = [req.user.tambo_id];

    if (fecha_inicio) {
      query += ' AND m.fecha >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ' AND m.fecha <= ?';
      params.push(fecha_fin);
    }

    if (insumo_id) {
      query += ' AND m.insumo_id = ?';
      params.push(insumo_id);
    }

    if (tipo_insumo) {
      query += ' AND i.tipo_insumo = ?';
      params.push(tipo_insumo);
    }

    if (tipo) {
      query += ' AND m.tipo = ?';
      params.push(tipo);
    }

    query += ' GROUP BY m.insumo_id, i.nombre, i.unidad, i.tipo_insumo ORDER BY i.tipo_insumo, i.nombre';

    const [resumen] = await pool.query(query, params);

    // Totales generales (mismos filtros que el resumen)
    let totalesQuery = `
      SELECT
        COUNT(*) as total_movimientos,
        SUM(CASE WHEN m.tipo = 'ingreso' THEN m.cantidad ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN m.tipo = 'consumo' THEN m.cantidad ELSE 0 END) as total_consumos,
        SUM(CASE WHEN m.tipo = 'ajuste_positivo' THEN m.cantidad ELSE 0 END) as total_ajustes_pos,
        SUM(CASE WHEN m.tipo = 'ajuste_negativo' THEN m.cantidad ELSE 0 END) as total_ajustes_neg
      FROM movimientos_stock m
      JOIN insumos i ON m.insumo_id = i.id
      WHERE m.tambo_id = ?
    `;
    const totalesParams = [req.user.tambo_id];

    if (fecha_inicio) {
      totalesQuery += ' AND m.fecha >= ?';
      totalesParams.push(fecha_inicio);
    }
    if (fecha_fin) {
      totalesQuery += ' AND m.fecha <= ?';
      totalesParams.push(fecha_fin);
    }
    if (insumo_id) {
      totalesQuery += ' AND m.insumo_id = ?';
      totalesParams.push(insumo_id);
    }
    if (tipo_insumo) {
      totalesQuery += ' AND i.tipo_insumo = ?';
      totalesParams.push(tipo_insumo);
    }
    if (tipo) {
      totalesQuery += ' AND m.tipo = ?';
      totalesParams.push(tipo);
    }

    const [totales] = await pool.query(totalesQuery, totalesParams);

    res.json({
      resumen,
      totales: totales[0]
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/movimientos/export - Exportar a CSV
router.get('/export', duenoEncargado, async (req, res) => {
  try {
    const { insumo_id, tipo, fecha_inicio, fecha_fin, lote_id } = req.query;

    let query = `
      SELECT
        m.fecha,
        m.hora,
        i.nombre as insumo,
        i.tipo_insumo,
        m.tipo,
        m.cantidad,
        i.unidad,
        m.stock_anterior,
        m.stock_posterior,
        l.nombre as lote,
        u.nombre as usuario,
        m.comprobante_entrega as remito,
        m.observaciones
      FROM movimientos_stock m
      JOIN insumos i ON m.insumo_id = i.id
      LEFT JOIN lotes l ON m.lote_id = l.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.tambo_id = ?
    `;
    const params = [req.user.tambo_id];

    if (insumo_id) {
      query += ' AND m.insumo_id = ?';
      params.push(insumo_id);
    }
    if (tipo) {
      query += ' AND m.tipo = ?';
      params.push(tipo);
    }
    if (fecha_inicio) {
      query += ' AND m.fecha >= ?';
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      query += ' AND m.fecha <= ?';
      params.push(fecha_fin);
    }
    if (lote_id) {
      query += ' AND m.lote_id = ?';
      params.push(lote_id);
    }

    query += ' ORDER BY m.fecha DESC, m.hora DESC';

    const [movimientos] = await pool.query(query, params);

    // Generar CSV
    const headers = [
      'Fecha', 'Hora', 'Insumo', 'Tipo Insumo', 'Movimiento',
      'Cantidad', 'Unidad', 'Stock Anterior', 'Stock Posterior',
      'Lote', 'Usuario', 'Remito', 'Observaciones'
    ];

    const rows = movimientos.map(m => [
      m.fecha,
      m.hora,
      `"${(m.insumo || '').replace(/"/g, '""')}"`,
      `"${(m.tipo_insumo || '').replace(/"/g, '""')}"`,
      m.tipo,
      m.cantidad,
      m.unidad,
      m.stock_anterior,
      m.stock_posterior,
      `"${(m.lote || '').replace(/"/g, '""')}"`,
      `"${(m.usuario || '').replace(/"/g, '""')}"`,
      `"${(m.remito || '').replace(/"/g, '""')}"`,
      `"${(m.observaciones || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=movimientos_stock.csv');
    res.send('\uFEFF' + csvContent); // BOM para Excel
  } catch (error) {
    console.error('Error exportando movimientos:', error);
    res.status(500).json({ error: 'Error al exportar movimientos' });
  }
});

// GET /api/movimientos/historial-insumo - Historial específico de un insumo (para modal)
router.get('/historial-insumo', async (req, res) => {
  try {
    const { insumo_id, periodo = '30' } = req.query;

    if (!insumo_id) {
      return res.status(400).json({ error: 'insumo_id es requerido' });
    }

    let fechaInicio;
    const now = new Date();
    switch (periodo) {
      case '7':
        fechaInicio = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30':
        fechaInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90':
        fechaInicio = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '180':
        fechaInicio = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '365':
        fechaInicio = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        fechaInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];

    const query = `
      SELECT m.*, u.nombre as usuario_nombre
      FROM movimientos_stock m
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE m.insumo_id = ? AND m.tambo_id = ? AND m.fecha >= ?
      ORDER BY m.fecha DESC, m.hora DESC
    `;

    const [historial] = await pool.query(query, [insumo_id, req.user.tambo_id, fechaInicioStr]);

    // Resumen
    const resumenQuery = `
      SELECT
        SUM(CASE WHEN tipo = 'ingreso' THEN cantidad ELSE 0 END) as total_ingresos,
        SUM(CASE WHEN tipo = 'consumo' THEN cantidad ELSE 0 END) as total_consumos,
        SUM(CASE WHEN tipo = 'ajuste_positivo' THEN cantidad ELSE 0 END) as total_ajustes_pos,
        SUM(CASE WHEN tipo = 'ajuste_negativo' THEN cantidad ELSE 0 END) as total_ajustes_neg,
        COUNT(*) as total_movimientos
      FROM movimientos_stock
      WHERE insumo_id = ? AND tambo_id = ? AND fecha >= ?
    `;

    const [resumen] = await pool.query(resumenQuery, [insumo_id, req.user.tambo_id, fechaInicioStr]);

    res.json({
      historial,
      resumen: resumen[0],
      periodo: {
        desde: fechaInicioStr,
        hasta: now.toISOString().split('T')[0],
        dias: periodo
      }
    });
  } catch (error) {
    console.error('Error obteniendo historial de insumo:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
