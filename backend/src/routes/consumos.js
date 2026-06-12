const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { verificarYGenerarAlertas } = require('../utils/alertas');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { fecha, lote_id } = req.query;
    let query = `
      SELECT c.*, l.nombre as lote_nombre, i.nombre as insumo_nombre, i.unidad,
             u.nombre as usuario_nombre
      FROM consumos c
      JOIN lotes l ON c.lote_id = l.id
      JOIN insumos i ON c.insumo_id = i.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha) {
      query += ' AND c.fecha = ?';
      params.push(fecha);
    }

    if (lote_id) {
      query += ' AND c.lote_id = ?';
      params.push(lote_id);
    }

    query += ' ORDER BY c.fecha DESC, c.hora DESC';
    const [consumos] = await pool.query(query, params);
    res.json({ consumos });
  } catch (error) {
    console.error('Error obteniendo consumos:', error);
    res.status(500).json({ error: 'Error al obtener consumos' });
  }
});

router.post('/', [
  body('lote_id').isInt().withMessage('ID de lote requerido'),
  body('insumo_id').isInt().withMessage('ID de insumo requerido'),
  body('cantidad').isFloat({ min: 0 }).withMessage('Cantidad debe ser mayor a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lote_id, insumo_id, cantidad, observaciones } = req.body;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [insumos] = await connection.query('SELECT * FROM insumos WHERE id = ?', [insumo_id]);
      
      if (insumos.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      const insumo = insumos[0];
      const nuevoStock = parseFloat(insumo.stock_actual) - parseFloat(cantidad);

      if (nuevoStock < 0) {
        await connection.rollback();
        return res.status(400).json({ 
          error: `Stock insuficiente. Stock actual: ${insumo.stock_actual} ${insumo.unidad}` 
        });
      }

      await connection.query(
        'UPDATE insumos SET stock_actual = ? WHERE id = ?',
        [nuevoStock, insumo_id]
      );

      const stockAnterior = parseFloat(insumo.stock_actual);

      await connection.query(
        'INSERT INTO consumos (lote_id, insumo_id, usuario_id, cantidad, fecha, hora, observaciones) VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?)',
        [lote_id, insumo_id, req.user.id, cantidad, observaciones || null]
      );

      await connection.query(
        'INSERT INTO consumo_diario (insumo_id, usuario_id, cantidad, fecha, hora, tipo_movimiento, observaciones) VALUES (?, ?, ?, CURDATE(), CURTIME(), "consumo", ?)',
        [insumo_id, req.user.id, cantidad, observaciones || null]
      );

      await connection.query(
        'INSERT INTO movimientos_stock (insumo_id, lote_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, fecha, hora) VALUES (?, ?, ?, "consumo", ?, ?, ?, ?, CURDATE(), CURTIME())',
        [insumo_id, lote_id, req.user.id, cantidad, stockAnterior, nuevoStock, observaciones || null]
      );

      await verificarYGenerarAlertas(insumo_id, connection);

      await connection.commit();

      const [[lote]] = await pool.query('SELECT nombre FROM lotes WHERE id = ?', [lote_id]);
      await logActividad(pool, {
        usuario_id: req.user.id,
        accion: 'consumo_registrado',
        descripcion: `Registró consumo: ${parseFloat(cantidad).toLocaleString('es-AR')} ${insumo.unidad} de "${insumo.nombre}" en "${lote?.nombre}"`,
      });

      res.status(201).json({
        message: 'Consumo registrado exitosamente',
        nuevoStock,
        unidad: insumo.unidad
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error registrando consumo:', error);
    res.status(500).json({ error: 'Error al registrar consumo' });
  }
});

router.get('/historial', async (req, res) => {
  try {
    const { insumo_id, fecha_inicio, fecha_fin } = req.query;
    let query = `
      SELECT m.*, i.nombre as insumo_nombre, i.unidad, u.nombre as usuario_nombre
      FROM movimientos_stock m
      JOIN insumos i ON m.insumo_id = i.id
      LEFT JOIN usuarios u ON m.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (insumo_id) {
      query += ' AND m.insumo_id = ?';
      params.push(insumo_id);
    }

    if (fecha_inicio) {
      query += ' AND m.fecha >= ?';
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ' AND m.fecha <= ?';
      params.push(fecha_fin);
    }

    query += ' ORDER BY m.fecha DESC, m.hora DESC LIMIT 100';
    const [historial] = await pool.query(query, params);
    res.json({ historial });
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
