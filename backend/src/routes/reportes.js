const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { generarReportePdf, tabla } = require('../utils/pdf');

router.use(authenticateToken);
router.use(authorizeRoles('dueno', 'encargado'));

// Devuelve { inicio, fin, label } para el mes YYYY-MM dado, o el mes actual si no se especifica.
function rangoDelMes(mesParam) {
  const hoy = new Date();
  let anio = hoy.getFullYear();
  let mes = hoy.getMonth() + 1;

  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    [anio, mes] = mesParam.split('-').map(Number);
  }

  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  const label = new Date(anio, mes - 1, 1).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' });

  return { inicio, fin, label };
}

function enviarPdf(res, filename, buffer) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

// GET /api/reportes/consumo-mensual?mes=YYYY-MM
router.get('/consumo-mensual', async (req, res) => {
  try {
    const tambo_id = req.user.tambo_id;
    const { inicio, fin, label } = rangoDelMes(req.query.mes);

    const [rows] = await pool.query(`
      SELECT l.nombre AS lote_nombre, i.nombre AS insumo_nombre, i.unidad,
             SUM(c.cantidad_kg) AS total_kg,
             COUNT(DISTINCT c.fecha) AS dias_con_consumo
      FROM consumo_diario_lote c
      JOIN lotes l ON c.lote_id = l.id
      JOIN insumos i ON c.insumo_id = i.id
      WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
      GROUP BY l.id, l.nombre, i.id, i.nombre, i.unidad
      ORDER BY l.nombre, total_kg DESC
    `, [tambo_id, inicio, fin]);

    const filas = rows.map(r => [
      r.lote_nombre,
      r.insumo_nombre,
      `${parseFloat(r.total_kg).toFixed(1)} ${r.unidad}`,
      r.dias_con_consumo > 0 ? `${(parseFloat(r.total_kg) / r.dias_con_consumo).toFixed(1)} ${r.unidad}/dia` : '-',
    ]);

    const content = rows.length === 0
      ? [{ text: 'No hay consumo registrado en este periodo.', italics: true, color: '#6B7280' }]
      : [tabla(['Lote', 'Insumo', 'Total consumido', 'Promedio diario'], filas, ['*', '*', 'auto', 'auto'])];

    const buffer = await generarReportePdf({
      tamboId: tambo_id,
      titulo: 'Reporte de Consumo Mensual',
      periodo: label,
      content,
    });

    enviarPdf(res, `consumo-mensual-${inicio.slice(0, 7)}.pdf`, buffer);
  } catch (error) {
    console.error('Error generando reporte de consumo mensual:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// GET /api/reportes/costos-mensual?mes=YYYY-MM
router.get('/costos-mensual', async (req, res) => {
  try {
    const tambo_id = req.user.tambo_id;
    const { inicio, fin, label } = rangoDelMes(req.query.mes);

    const [lotesRows] = await pool.query(`
      SELECT
        l.nombre AS lote_nombre,
        COALESCE(l.cantidad_animales, 0) AS cantidad_animales,
        COALESCE(SUM(c.cantidad_kg), 0) AS total_kg,
        COALESCE(SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)), 0) AS costo_total,
        COUNT(DISTINCT c.fecha) AS dias_con_consumo
      FROM lotes l
      LEFT JOIN consumo_diario_lote c ON c.lote_id = l.id AND c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
      LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
      WHERE l.tambo_id = ? AND l.activo = TRUE
      GROUP BY l.id, l.nombre, l.cantidad_animales
      ORDER BY costo_total DESC
    `, [tambo_id, inicio, fin, tambo_id]);

    const costoTotalGeneral = lotesRows.reduce((acc, r) => acc + parseFloat(r.costo_total), 0);

    const filas = lotesRows.map(r => [
      r.lote_nombre,
      String(r.cantidad_animales),
      `US$ ${parseFloat(r.costo_total).toFixed(2)}`,
      r.cantidad_animales > 0 && r.dias_con_consumo > 0
        ? `US$ ${(parseFloat(r.costo_total) / r.cantidad_animales / r.dias_con_consumo).toFixed(2)}`
        : '-',
    ]);

    const content = [
      { text: `Costo total del periodo: US$ ${costoTotalGeneral.toFixed(2)}`, bold: true, margin: [0, 0, 0, 8] },
      lotesRows.length === 0
        ? { text: 'No hay costos registrados en este periodo.', italics: true, color: '#6B7280' }
        : tabla(['Lote', 'Animales', 'Costo total', 'Costo/animal/dia'], filas, ['*', 'auto', 'auto', 'auto']),
    ];

    const buffer = await generarReportePdf({
      tamboId: tambo_id,
      titulo: 'Reporte de Costos Mensuales',
      periodo: label,
      content,
    });

    enviarPdf(res, `costos-mensual-${inicio.slice(0, 7)}.pdf`, buffer);
  } catch (error) {
    console.error('Error generando reporte de costos mensuales:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// GET /api/reportes/compras?mes=YYYY-MM
router.get('/compras', async (req, res) => {
  try {
    const tambo_id = req.user.tambo_id;
    const { inicio, fin, label } = rangoDelMes(req.query.mes);

    const [rows] = await pool.query(`
      SELECT c.fecha, p.nombre AS proveedor_nombre, i.nombre AS insumo_nombre,
             c.cantidad, i.unidad, c.precio_unitario, c.monto_total, c.numero_factura
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      JOIN insumos i ON c.insumo_id = i.id
      WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
      ORDER BY c.fecha ASC
    `, [tambo_id, inicio, fin]);

    const montoTotal = rows.reduce((acc, r) => acc + parseFloat(r.monto_total), 0);

    const filas = rows.map(r => [
      r.fecha,
      r.proveedor_nombre || '-',
      r.insumo_nombre,
      `${parseFloat(r.cantidad).toFixed(1)} ${r.unidad}`,
      `US$ ${parseFloat(r.monto_total).toFixed(2)}`,
      r.numero_factura || '-',
    ]);

    const content = [
      { text: `Gasto total del periodo: US$ ${montoTotal.toFixed(2)}  -  ${rows.length} compras`, bold: true, margin: [0, 0, 0, 8] },
      rows.length === 0
        ? { text: 'No hay compras registradas en este periodo.', italics: true, color: '#6B7280' }
        : tabla(['Fecha', 'Proveedor', 'Insumo', 'Cantidad', 'Monto', 'Factura'], filas, ['auto', '*', '*', 'auto', 'auto', 'auto']),
    ];

    const buffer = await generarReportePdf({
      tamboId: tambo_id,
      titulo: 'Reporte de Compras',
      periodo: label,
      content,
    });

    enviarPdf(res, `compras-${inicio.slice(0, 7)}.pdf`, buffer);
  } catch (error) {
    console.error('Error generando reporte de compras:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// GET /api/reportes/stock - snapshot del stock actual, sin rango de fechas
router.get('/stock', async (req, res) => {
  try {
    const tambo_id = req.user.tambo_id;

    const [rows] = await pool.query(
      'SELECT * FROM insumos WHERE tambo_id = ? AND activo = TRUE ORDER BY nombre ASC',
      [tambo_id]
    );

    const ORIGEN_LABEL = { historico: '', formulado: ' (estimado)', sin_datos: '', manual: ' (estimado)' };

    const filas = rows.map(r => {
      const dias = parseInt(r.dias_restantes);
      const diasTexto = dias === 999 || dias === 0 ? 'Sin datos' : `${dias} dias${ORIGEN_LABEL[r.dias_restantes_origen] || ''}`;
      return [
        r.nombre,
        r.tipo_insumo,
        `${parseFloat(r.stock_actual).toFixed(1)} ${r.unidad}`,
        `${parseFloat(r.capacidad_maxima).toFixed(1)} ${r.unidad}`,
        diasTexto,
      ];
    });

    const content = rows.length === 0
      ? [{ text: 'No hay insumos registrados.', italics: true, color: '#6B7280' }]
      : [tabla(['Insumo', 'Tipo', 'Stock actual', 'Capacidad max.', 'Dias restantes'], filas, ['*', 'auto', 'auto', 'auto', 'auto'])];

    const buffer = await generarReportePdf({
      tamboId: tambo_id,
      titulo: 'Reporte de Stock',
      periodo: null,
      content,
    });

    enviarPdf(res, `stock-${new Date().toISOString().slice(0, 10)}.pdf`, buffer);
  } catch (error) {
    console.error('Error generando reporte de stock:', error);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

module.exports = router;
