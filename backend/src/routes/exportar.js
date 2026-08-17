const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const tamboLimiter = require('../middleware/tamboLimiter');
const { enviarExport } = require('../utils/exportBuilder');
const { hoyEnZona, restarDiasFecha } = require('../utils/tzDate');

router.use(authenticateToken);
router.use(tamboLimiter);
router.use(authorizeRoles('dueno', 'encargado'));

function getDateRange(query, zonaHoraria) {
  let { fecha_inicio, fecha_fin } = query;
  if (!fecha_inicio || !fecha_fin) {
    const hoy = hoyEnZona(zonaHoraria);
    fecha_inicio = restarDiasFecha(hoy, 30);
    fecha_fin = hoy;
  }
  return { fecha_inicio, fecha_fin };
}

// tipo=consumos -- ledger completo de movimientos de stock (ingresos, consumos, ajustes),
// lo mismo que muestra la pantalla de Historial.
async function datosConsumos(tamboId, fecha_inicio, fecha_fin) {
  const [rows] = await pool.query(
    `SELECT m.fecha, m.hora, i.nombre AS insumo, i.tipo_insumo, m.tipo,
            m.cantidad, i.unidad, m.stock_anterior, m.stock_posterior,
            l.nombre AS lote, u.nombre AS usuario, m.comprobante_entrega AS remito, m.observaciones
     FROM movimientos_stock m
     JOIN insumos i ON m.insumo_id = i.id
     LEFT JOIN lotes l ON m.lote_id = l.id
     LEFT JOIN usuarios u ON m.usuario_id = u.id
     WHERE m.tambo_id = ? AND m.fecha BETWEEN ? AND ?
     ORDER BY m.fecha DESC, m.hora DESC`,
    [tamboId, fecha_inicio, fecha_fin]
  );

  const headers = ['Fecha', 'Hora', 'Insumo', 'Tipo Insumo', 'Movimiento', 'Cantidad', 'Unidad', 'Stock Anterior', 'Stock Posterior', 'Lote', 'Usuario', 'Remito', 'Observaciones'];
  const rowsOut = rows.map(m => [
    m.fecha, m.hora, m.insumo, m.tipo_insumo, m.tipo, m.cantidad, m.unidad,
    m.stock_anterior, m.stock_posterior, m.lote || '', m.usuario || '', m.remito || '', m.observaciones || '',
  ]);
  return { headers, rows: rowsOut, sheetName: 'Consumos' };
}

// tipo=insumos -- foto actual del catalogo de insumos (no depende del rango de fechas).
async function datosInsumos(tamboId) {
  const [rows] = await pool.query(
    `SELECT nombre, tipo_insumo, categoria, unidad, stock_actual, capacidad_maxima, stock_minimo, activo
     FROM insumos WHERE tambo_id = ? ORDER BY nombre`,
    [tamboId]
  );

  const headers = ['Nombre', 'Tipo', 'Categoría', 'Unidad', 'Stock Actual', 'Capacidad Máxima', 'Stock Mínimo', 'Activo'];
  const rowsOut = rows.map(i => [
    i.nombre, i.tipo_insumo, i.categoria || '', i.unidad, i.stock_actual,
    i.capacidad_maxima, i.stock_minimo, i.activo ? 'Sí' : 'No',
  ]);
  return { headers, rows: rowsOut, sheetName: 'Insumos' };
}

// tipo=costos -- mismo detalle que Costos > Por Lote / Evolución Diaria.
async function datosCostos(tamboId, fecha_inicio, fecha_fin, vista) {
  if (vista === 'diario') {
    const [rows] = await pool.query(
      `SELECT c.fecha,
              SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)) AS costo_total,
              SUM(c.cantidad_kg) AS total_kg,
              COUNT(DISTINCT c.lote_id) AS lotes_activos
       FROM consumo_diario_lote c
       LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
       WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
       GROUP BY c.fecha ORDER BY c.fecha DESC`,
      [tamboId, fecha_inicio, fecha_fin]
    );
    const headers = ['Fecha', 'Costo Total', 'Consumo Total (kg)', 'Lotes Activos'];
    const rowsOut = rows.map(r => [r.fecha, parseFloat(r.costo_total) || 0, parseFloat(r.total_kg) || 0, r.lotes_activos]);
    return { headers, rows: rowsOut, sheetName: 'Costos diarios' };
  }

  const [rows] = await pool.query(
    `SELECT l.nombre AS lote_nombre, COALESCE(l.cantidad_animales, 0) AS cantidad_animales,
            COALESCE(SUM(c.cantidad_kg), 0) AS total_kg,
            COALESCE(SUM(c.cantidad_kg * COALESCE(ci.precio_por_kg, 0)), 0) AS costo_total,
            COUNT(DISTINCT c.fecha) AS dias_con_consumo
     FROM lotes l
     LEFT JOIN consumo_diario_lote c ON c.lote_id = l.id AND c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
     LEFT JOIN costos_ingredientes ci ON c.insumo_id = ci.insumo_id
     WHERE l.tambo_id = ? AND l.activo = TRUE
     GROUP BY l.id, l.nombre, l.cantidad_animales
     ORDER BY costo_total DESC`,
    [tamboId, fecha_inicio, fecha_fin, tamboId]
  );
  const headers = ['Lote', 'Animales', 'Consumo Total (kg)', 'Costo Total', 'Días con Consumo'];
  const rowsOut = rows.map(r => [r.lote_nombre, r.cantidad_animales, parseFloat(r.total_kg) || 0, parseFloat(r.costo_total) || 0, r.dias_con_consumo]);
  return { headers, rows: rowsOut, sheetName: 'Costos por lote' };
}

// tipo=compras
async function datosCompras(tamboId, fecha_inicio, fecha_fin) {
  const [rows] = await pool.query(
    `SELECT c.fecha, p.nombre AS proveedor, i.nombre AS insumo, c.cantidad, i.unidad,
            c.precio_unitario, c.monto_total, c.numero_factura, c.observaciones
     FROM compras c
     LEFT JOIN proveedores p ON c.proveedor_id = p.id
     JOIN insumos i ON c.insumo_id = i.id
     WHERE c.tambo_id = ? AND c.fecha BETWEEN ? AND ?
     ORDER BY c.fecha DESC`,
    [tamboId, fecha_inicio, fecha_fin]
  );
  const headers = ['Fecha', 'Proveedor', 'Insumo', 'Cantidad', 'Unidad', 'Precio Unitario', 'Total', 'Factura', 'Observaciones'];
  const rowsOut = rows.map(c => [
    c.fecha, c.proveedor || '', c.insumo, c.cantidad, c.unidad,
    c.precio_unitario, c.monto_total, c.numero_factura || '', c.observaciones || '',
  ]);
  return { headers, rows: rowsOut, sheetName: 'Compras' };
}

router.get('/', async (req, res) => {
  try {
    const { tipo, formato = 'csv', vista } = req.query;
    const tiposValidos = ['consumos', 'insumos', 'costos', 'compras'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: `Tipo inválido. Debe ser uno de: ${tiposValidos.join(', ')}` });
    }
    if (!['csv', 'xlsx'].includes(formato)) {
      return res.status(400).json({ error: 'Formato inválido. Debe ser csv o xlsx' });
    }

    const { fecha_inicio, fecha_fin } = getDateRange(req.query, req.user.zona_horaria);
    const tamboId = req.user.tambo_id;

    let datos;
    if (tipo === 'consumos') datos = await datosConsumos(tamboId, fecha_inicio, fecha_fin);
    else if (tipo === 'insumos') datos = await datosInsumos(tamboId);
    else if (tipo === 'costos') datos = await datosCostos(tamboId, fecha_inicio, fecha_fin, vista);
    else datos = await datosCompras(tamboId, fecha_inicio, fecha_fin);

    await enviarExport(res, {
      formato,
      filename: `${tipo}_${fecha_inicio}_${fecha_fin}`,
      ...datos,
    });
  } catch (error) {
    console.error('Error exportando datos:', error);
    res.status(500).json({ error: 'Error al exportar datos' });
  }
});

module.exports = router;
