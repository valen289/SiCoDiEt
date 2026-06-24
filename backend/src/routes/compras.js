const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { verificarYGenerarAlertas } = require('../utils/alertas');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);

const duenoEncargado = authorizeRoles('dueno', 'encargado');

/* ─── Proveedores ─────────────────────────────────────────────────────────────── */

router.get('/proveedores', duenoEncargado, async (req, res) => {
  try {
    const [proveedores] = await pool.query(
      'SELECT * FROM proveedores WHERE tambo_id = ? AND activo = 1 ORDER BY nombre ASC',
      [req.user.tambo_id]
    );
    res.json({ proveedores });
  } catch (error) {
    console.error('Error obteniendo proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

router.post('/proveedores', duenoEncargado, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nombre, contacto, telefono } = req.body;
    const [result] = await pool.query(
      'INSERT INTO proveedores (tambo_id, nombre, contacto, telefono) VALUES (?, ?, ?, ?)',
      [req.user.tambo_id, nombre, contacto || null, telefono || null]
    );

    res.status(201).json({ message: 'Proveedor creado', id: result.insertId });
  } catch (error) {
    console.error('Error creando proveedor:', error);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

router.put('/proveedores/:id', duenoEncargado, [
  body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { nombre, contacto, telefono } = req.body;
    const updates = [];
    const values = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (contacto !== undefined) { updates.push('contacto = ?'); values.push(contacto || null); }
    if (telefono !== undefined) { updates.push('telefono = ?'); values.push(telefono || null); }

    if (updates.length === 0) return res.status(400).json({ error: 'Sin datos para actualizar' });

    values.push(req.params.id, req.user.tambo_id);
    await pool.query(
      `UPDATE proveedores SET ${updates.join(', ')} WHERE id = ? AND tambo_id = ?`,
      values
    );
    res.json({ message: 'Proveedor actualizado' });
  } catch (error) {
    console.error('Error actualizando proveedor:', error);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

/* ─── Compras — listado y resumen ─────────────────────────────────────────────── */

router.get('/', duenoEncargado, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, proveedor_id, insumo_id } = req.query;
    const tambo_id = req.user.tambo_id;

    // Defaults: últimos 30 días
    const now = new Date();
    const fi = fecha_inicio || new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const ff = fecha_fin || now.toISOString().split('T')[0];

    let where = 'c.tambo_id = ? AND c.fecha BETWEEN ? AND ?';
    const params = [tambo_id, fi, ff];

    if (proveedor_id) { where += ' AND c.proveedor_id = ?'; params.push(proveedor_id); }
    if (insumo_id)    { where += ' AND c.insumo_id = ?';    params.push(insumo_id); }

    const [compras] = await pool.query(`
      SELECT
        c.*,
        p.nombre   AS proveedor_nombre,
        i.nombre   AS insumo_nombre,
        i.unidad   AS insumo_unidad,
        u.nombre   AS usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      JOIN insumos i           ON c.insumo_id   = i.id
      LEFT JOIN usuarios u     ON c.usuario_id  = u.id
      WHERE ${where}
      ORDER BY c.fecha DESC, c.fecha_creacion DESC
    `, params);

    // KPI resumen del mismo período/filtros
    const [resumenRows] = await pool.query(`
      SELECT
        SUM(c.monto_total)                             AS gasto_total,
        COUNT(*)                                       AS total_compras,
        COUNT(DISTINCT c.proveedor_id)                 AS proveedores_distintos,
        p.nombre                                       AS proveedor_top_nombre,
        SUM(c.monto_total)                             AS proveedor_top_monto
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      WHERE ${where}
      GROUP BY c.proveedor_id, p.nombre
      ORDER BY SUM(c.monto_total) DESC
      LIMIT 1
    `, params);

    const [totalesRows] = await pool.query(`
      SELECT
        SUM(monto_total)  AS gasto_total,
        COUNT(*)          AS total_compras
      FROM compras c
      WHERE ${where}
    `, params);

    res.json({
      compras,
      resumen: {
        gasto_total: parseFloat(totalesRows[0]?.gasto_total) || 0,
        total_compras: parseInt(totalesRows[0]?.total_compras) || 0,
        proveedor_top: resumenRows[0] || null,
      },
      fecha_inicio: fi,
      fecha_fin: ff,
    });
  } catch (error) {
    console.error('Error obteniendo compras:', error);
    res.status(500).json({ error: 'Error al obtener compras' });
  }
});

/* ─── Compras — crear (+ ingreso de stock) ────────────────────────────────────── */

router.post('/', duenoEncargado, [
  body('insumo_id').isInt().withMessage('Insumo requerido'),
  body('fecha').isDate().withMessage('Fecha requerida'),
  body('cantidad').isFloat({ min: 0.001 }).withMessage('Cantidad debe ser mayor a 0'),
  body('precio_unitario').isFloat({ min: 0 }).withMessage('Precio unitario inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      insumo_id, proveedor_id, fecha,
      cantidad, precio_unitario,
      numero_factura, observaciones,
    } = req.body;

    const montoTotal = parseFloat(cantidad) * parseFloat(precio_unitario);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Validar insumo y capacidad
      const [insumos] = await connection.query(
        'SELECT * FROM insumos WHERE id = ? AND tambo_id = ? FOR UPDATE',
        [insumo_id, req.user.tambo_id]
      );
      if (insumos.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      const insumo = insumos[0];
      const stockAnterior = parseFloat(insumo.stock_actual);
      const nuevoStock = stockAnterior + parseFloat(cantidad);

      if (nuevoStock > parseFloat(insumo.capacidad_maxima)) {
        await connection.rollback();
        return res.status(400).json({
          error: `El stock excede la capacidad máxima (${insumo.capacidad_maxima} ${insumo.unidad})`,
        });
      }

      // Validar proveedor si se indicó
      if (proveedor_id) {
        const [provs] = await connection.query(
          'SELECT id FROM proveedores WHERE id = ? AND tambo_id = ?',
          [proveedor_id, req.user.tambo_id]
        );
        if (provs.length === 0) {
          await connection.rollback();
          return res.status(400).json({ error: 'Proveedor no encontrado' });
        }
      }

      // Insertar compra (movimiento_id se actualizará después)
      const [compraResult] = await connection.query(`
        INSERT INTO compras
          (tambo_id, proveedor_id, insumo_id, usuario_id, fecha, cantidad, precio_unitario, monto_total, numero_factura, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.user.tambo_id,
        proveedor_id || null,
        insumo_id,
        req.user.id,
        fecha,
        cantidad,
        precio_unitario,
        montoTotal,
        numero_factura || null,
        observaciones || null,
      ]);

      const compraId = compraResult.insertId;

      // Actualizar stock
      await connection.query(
        'UPDATE insumos SET stock_actual = ? WHERE id = ?',
        [nuevoStock, insumo_id]
      );

      // Registrar en historial_cargas_alimentos (compatibilidad)
      const TIPOS_VALIDOS_HISTORIAL = ['silo', 'bolson', 'fardo', 'sales', 'pastura'];
      const tipoHistorial = TIPOS_VALIDOS_HISTORIAL.includes(insumo.tipo_insumo) ? insumo.tipo_insumo : 'silo';
      await connection.query(
        `INSERT INTO historial_cargas_alimentos
           (tipo_alimento, insumo_id, usuario_id, cantidad, comprobante_entrega, fecha, hora, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, CURTIME(), ?)`,
        [tipoHistorial, insumo_id, req.user.id, cantidad, numero_factura || null, fecha, observaciones || null]
      );

      // Registrar en consumo_diario (compatibilidad)
      await connection.query(
        `INSERT INTO consumo_diario
           (insumo_id, usuario_id, cantidad, fecha, hora, tipo_movimiento, observaciones)
         VALUES (?, ?, ?, ?, CURTIME(), 'ingreso', ?)`,
        [insumo_id, req.user.id, cantidad, fecha, observaciones || null]
      );

      // Registrar en movimientos_stock
      const [movResult] = await connection.query(
        `INSERT INTO movimientos_stock
           (tambo_id, insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, comprobante_entrega, observaciones, fecha, hora)
         VALUES (?, ?, ?, 'ingreso', ?, ?, ?, ?, ?, ?, CURTIME())`,
        [req.user.tambo_id, insumo_id, req.user.id, cantidad, stockAnterior, nuevoStock, numero_factura || null, observaciones || null, fecha]
      );

      // Vincular movimiento a la compra
      await connection.query(
        'UPDATE compras SET movimiento_id = ? WHERE id = ?',
        [movResult.insertId, compraId]
      );

      await verificarYGenerarAlertas(insumo_id, connection);
      await connection.commit();

      await logActividad(pool, {
        usuario_id: req.user.id,
        tambo_id: req.user.tambo_id,
        accion: 'compra_registrada',
        descripcion: `Registró compra de ${parseFloat(cantidad).toLocaleString('es-AR')} ${insumo.unidad} de "${insumo.nombre}"${numero_factura ? ` (${numero_factura})` : ''}`,
      });

      res.status(201).json({
        message: 'Compra registrada exitosamente',
        compraId,
        nuevoStock,
        unidad: insumo.unidad,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error registrando compra:', error);
    res.status(500).json({ error: 'Error al registrar compra' });
  }
});

/* ─── Compras — editar campos financieros ─────────────────────────────────────── */

router.put('/:id', duenoEncargado, async (req, res) => {
  try {
    const { proveedor_id, precio_unitario, numero_factura, observaciones } = req.body;

    // Re-calcular monto si cambia precio
    let extra = '';
    const params = [];

    if (proveedor_id !== undefined) {
      params.push(proveedor_id || null);
      extra += 'proveedor_id = ?, ';
    }
    if (precio_unitario !== undefined) {
      params.push(parseFloat(precio_unitario));
      extra += 'precio_unitario = ?, ';
    }
    if (numero_factura !== undefined) {
      params.push(numero_factura || null);
      extra += 'numero_factura = ?, ';
    }
    if (observaciones !== undefined) {
      params.push(observaciones || null);
      extra += 'observaciones = ?, ';
    }

    if (!extra) return res.status(400).json({ error: 'Sin datos para actualizar' });

    // Si cambió precio_unitario, recalcular monto_total
    if (precio_unitario !== undefined) {
      const [[compra]] = await pool.query(
        'SELECT cantidad FROM compras WHERE id = ? AND tambo_id = ?',
        [req.params.id, req.user.tambo_id]
      );
      if (compra) {
        const nuevoMonto = parseFloat(compra.cantidad) * parseFloat(precio_unitario);
        params.push(nuevoMonto);
        extra += 'monto_total = ?, ';
      }
    }

    const sql = `UPDATE compras SET ${extra.replace(/, $/, '')} WHERE id = ? AND tambo_id = ?`;
    params.push(req.params.id, req.user.tambo_id);
    await pool.query(sql, params);

    res.json({ message: 'Compra actualizada' });
  } catch (error) {
    console.error('Error actualizando compra:', error);
    res.status(500).json({ error: 'Error al actualizar compra' });
  }
});

/* ─── Compras — eliminar ──────────────────────────────────────────────────────── */

router.delete('/:id', duenoEncargado, async (req, res) => {
  try {
    const [[compra]] = await pool.query(
      'SELECT c.*, i.nombre AS insumo_nombre FROM compras c JOIN insumos i ON c.insumo_id = i.id WHERE c.id = ? AND c.tambo_id = ?',
      [req.params.id, req.user.tambo_id]
    );
    if (!compra) return res.status(404).json({ error: 'Compra no encontrada' });

    await pool.query('DELETE FROM compras WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'compra_eliminada',
      descripcion: `Eliminó registro de compra de "${compra.insumo_nombre}" (el ingreso de stock NO fue revertido)`,
    });

    res.json({ message: 'Compra eliminada (el ingreso de stock permanece registrado)' });
  } catch (error) {
    console.error('Error eliminando compra:', error);
    res.status(500).json({ error: 'Error al eliminar compra' });
  }
});

module.exports = router;
