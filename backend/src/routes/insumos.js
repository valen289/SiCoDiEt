const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { verificarYGenerarAlertas, getNivelAlerta } = require('../utils/alertas');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = 'SELECT * FROM insumos WHERE activo = TRUE';
    const params = [];

    if (tipo) {
      query += ' AND tipo_insumo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY nombre ASC';
    const [insumos] = await pool.query(query, params);
    res.json({ insumos });
  } catch (error) {
    console.error('Error obteniendo insumos:', error);
    res.status(500).json({ error: 'Error al obtener insumos' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [insumos] = await pool.query('SELECT * FROM insumos WHERE id = ?', [req.params.id]);
    
    if (insumos.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json({ insumo: insumos[0] });
  } catch (error) {
    console.error('Error obteniendo insumo:', error);
    res.status(500).json({ error: 'Error al obtener insumo' });
  }
});

router.post('/', [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('tipo_insumo').notEmpty().withMessage('Tipo requerido'),
  body('unidad').notEmpty().withMessage('Unidad requerida'),
  body('capacidad_maxima').isFloat({ min: 0 }).withMessage('Capacidad maxima debe ser mayor a 0'),
  body('stock_minimo').isFloat({ min: 0 }).withMessage('Stock minimo debe ser mayor o igual a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_insumo, unidad, capacidad_maxima, stock_actual = 0, stock_minimo } = req.body;

    const [result] = await pool.query(
      'INSERT INTO insumos (nombre, tipo_insumo, unidad, capacidad_maxima, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, tipo_insumo, unidad, capacidad_maxima, stock_actual, stock_minimo]
    );

    await logActividad(pool, {
      usuario_id: req.user.id,
      accion: 'insumo_creado',
      descripcion: `Creó el insumo "${nombre}"`,
    });

    res.status(201).json({
      message: 'Insumo creado exitosamente',
      insumoId: result.insertId
    });
  } catch (error) {
    console.error('Error creando insumo:', error);
    res.status(500).json({ error: 'Error al crear insumo' });
  }
});

router.put('/:id', [
  body('nombre').optional().notEmpty(),
  body('tipo_insumo').optional().notEmpty(),
  body('unidad').optional().notEmpty(),
  body('capacidad_maxima').optional().isFloat({ min: 0 }),
  body('stock_minimo').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_insumo, unidad, capacidad_maxima, stock_minimo } = req.body;
    const updates = [];
    const values = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (tipo_insumo !== undefined) { updates.push('tipo_insumo = ?'); values.push(tipo_insumo); }
    if (unidad !== undefined) { updates.push('unidad = ?'); values.push(unidad); }
    if (capacidad_maxima !== undefined) { updates.push('capacidad_maxima = ?'); values.push(capacidad_maxima); }
    if (stock_minimo !== undefined) { updates.push('stock_minimo = ?'); values.push(stock_minimo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE insumos SET ${updates.join(', ')} WHERE id = ?`, values);

    const [[insumo]] = await pool.query('SELECT nombre FROM insumos WHERE id = ?', [req.params.id]);
    await logActividad(pool, {
      usuario_id: req.user.id,
      accion: 'insumo_actualizado',
      descripcion: `Actualizó el insumo "${insumo?.nombre}"`,
    });

    res.json({ message: 'Insumo actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando insumo:', error);
    res.status(500).json({ error: 'Error al actualizar insumo' });
  }
});

router.post('/:id/cargar', [
  body('cantidad').isFloat({ min: 0 }).withMessage('Cantidad debe ser mayor a 0'),
  body('comprobante_entrega').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cantidad, comprobante_entrega, observaciones } = req.body;
    const insumoId = req.params.id;

    const [insumos] = await pool.query('SELECT * FROM insumos WHERE id = ?', [insumoId]);
    
    if (insumos.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    const insumo = insumos[0];
    const stockAnterior = parseFloat(insumo.stock_actual);
    const nuevoStock = stockAnterior + parseFloat(cantidad);

    if (nuevoStock > parseFloat(insumo.capacidad_maxima)) {
      return res.status(400).json({ 
        error: `El stock excede la capacidad maxima (${insumo.capacidad_maxima} ${insumo.unidad})` 
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        'UPDATE insumos SET stock_actual = ? WHERE id = ?',
        [nuevoStock, insumoId]
      );

      await connection.query(
        'INSERT INTO historial_cargas_alimentos (tipo_alimento, insumo_id, usuario_id, cantidad, comprobante_entrega, fecha, hora, observaciones) VALUES (?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)',
        [insumo.tipo_insumo, insumoId, req.user.id, cantidad, comprobante_entrega || null, observaciones || null]
      );

      await connection.query(
        'INSERT INTO consumo_diario (insumo_id, usuario_id, cantidad, fecha, hora, tipo_movimiento, observaciones) VALUES (?, ?, ?, CURDATE(), CURTIME(), "ingreso", ?)',
        [insumoId, req.user.id, cantidad, observaciones || null]
      );

      await connection.query(
        'INSERT INTO movimientos_stock (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, comprobante_entrega, observaciones, fecha, hora) VALUES (?, ?, "ingreso", ?, ?, ?, ?, ?, CURDATE(), CURTIME())',
        [insumoId, req.user.id, cantidad, stockAnterior, nuevoStock, comprobante_entrega || null, observaciones || null]
      );

      await verificarYGenerarAlertas(insumoId, connection);

      await connection.commit();

      await logActividad(pool, {
        usuario_id: req.user.id,
        accion: 'carga_registrada',
        descripcion: `Cargó ${parseFloat(cantidad).toLocaleString('es-AR')} ${insumo.unidad} en "${insumo.nombre}"`,
      });

      res.json({
        message: 'Carga registrada exitosamente',
        nuevoStock,
        capacidadMaxima: insumo.capacidad_maxima,
        unidad: insumo.unidad
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error registrando carga:', error);
    res.status(500).json({ error: 'Error al registrar carga' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [[insumo]] = await pool.query('SELECT nombre FROM insumos WHERE id = ?', [req.params.id]);
    await pool.query('UPDATE insumos SET activo = FALSE WHERE id = ?', [req.params.id]);

    await logActividad(pool, {
      usuario_id: req.user.id,
      accion: 'insumo_desactivado',
      descripcion: `Desactivó el insumo "${insumo?.nombre}"`,
    });

    res.json({ message: 'Insumo desactivado exitosamente' });
  } catch (error) {
    console.error('Error desactivando insumo:', error);
    res.status(500).json({ error: 'Error al desactivar insumo' });
  }
});

router.post('/consumo-diario', async (req, res) => {
  try {
    const { fecha, registros } = req.body;
    const fechaConsumo = fecha || new Date().toISOString().split('T')[0];
    const usuarioId = req.user?.id;

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: 'Debe proporcionar registros de animales por lote' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const consumosPorInsumo = {};
      const detallesConsumo = [];

      for (const reg of registros) {
        const { lote_id, cantidad_animales } = reg;

        await connection.query(
          `INSERT INTO registro_diario_animales (lote_id, fecha, cantidad_animales, usuario_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE cantidad_animales = ?, usuario_id = ?`,
          [lote_id, fechaConsumo, cantidad_animales, usuarioId, cantidad_animales, usuarioId]
        );

        const [dietas] = await connection.query(
          `SELECT d.id FROM dietas d WHERE d.lote_id = ? AND d.activo = TRUE ORDER BY d.fecha_creacion DESC LIMIT 1`,
          [lote_id]
        );

        if (dietas.length === 0) continue;

        const dietaId = dietas[0].id;
        const [ingredientes] = await connection.query(
          `SELECT di.insumo_id, di.cantidad_kg as kg_por_vaca, i.nombre as insumo_nombre
           FROM dieta_ingredientes di
           JOIN insumos i ON di.insumo_id = i.id
           WHERE di.dieta_id = ?`,
          [dietaId]
        );

        for (const ing of ingredientes) {
          const consumoTotal = ing.kg_por_vaca * cantidad_animales;
          const kgPorAnimal = ing.kg_por_vaca;

          if (!consumosPorInsumo[ing.insumo_id]) {
            consumosPorInsumo[ing.insumo_id] = { total: 0, nombre: ing.insumo_nombre };
          }
          consumosPorInsumo[ing.insumo_id].total += consumoTotal;

          await connection.query(
            `INSERT INTO consumo_diario_lote (fecha, lote_id, insumo_id, cantidad_kg, cantidad_animales, kg_por_animal, usuario_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE cantidad_kg = ?, cantidad_animales = ?, kg_por_animal = ?, usuario_id = ?`,
            [fechaConsumo, lote_id, ing.insumo_id, consumoTotal, cantidad_animales, kgPorAnimal, usuarioId,
             consumoTotal, cantidad_animales, kgPorAnimal, usuarioId]
          );

          detallesConsumo.push({
            lote_id,
            insumo_id: ing.insumo_id,
            insumo_nombre: ing.insumo_nombre,
            kg_por_vaca: kgPorAnimal,
            cantidad_animales,
            consumo_total: consumoTotal,
          });
        }
      }

      for (const [insumoId, data] of Object.entries(consumosPorInsumo)) {
        const [insumoData] = await connection.query('SELECT stock_actual FROM insumos WHERE id = ?', [insumoId]);
        const stockAnterior = parseFloat(insumoData[0].stock_actual);
        const nuevoStock = stockAnterior - data.total;

        await connection.query(
          `UPDATE insumos SET stock_actual = ? WHERE id = ?`,
          [nuevoStock, insumoId]
        );

        await connection.query(
          'INSERT INTO movimientos_stock (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, fecha, hora) VALUES (?, ?, "consumo", ?, ?, ?, "Consumo diario automatico", ?, CURTIME())',
          [insumoId, usuarioId, data.total, stockAnterior, nuevoStock, fechaConsumo]
        );

        await verificarYGenerarAlertas(insumoId, connection);
      }

      await connection.commit();

      const resumen = Object.entries(consumosPorInsumo).map(([id, data]) => ({
        insumo_id: parseInt(id),
        insumo_nombre: data.nombre,
        consumo_total_kg: data.total,
      }));

      res.json({
        message: `Consumo diario registrado para ${fechaConsumo}`,
        fecha: fechaConsumo,
        total_lotes: registros.length,
        resumen,
        detalles: detallesConsumo,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error registrando consumo diario:', error);
    res.status(500).json({ error: 'Error al registrar consumo diario' });
  }
});

router.get('/resumen-diario', async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];

    const [consumos] = await pool.query(
      `SELECT c.insumo_id, i.nombre as insumo_nombre, i.stock_actual, i.stock_minimo, i.capacidad_maxima,
              SUM(c.cantidad_kg) as consumo_total,
              COUNT(DISTINCT c.lote_id) as lotes_consumieron
       FROM consumo_diario_lote c
       JOIN insumos i ON c.insumo_id = i.id
       WHERE c.fecha = ?
       GROUP BY c.insumo_id, i.nombre, i.stock_actual, i.stock_minimo, i.capacidad_maxima`,
      [fecha]
    );

    const [registros] = await pool.query(
      `SELECT r.lote_id, l.nombre as lote_nombre, r.cantidad_animales, r.fecha
       FROM registro_diario_animales r
       JOIN lotes l ON r.lote_id = l.id
       WHERE r.fecha = ?
       ORDER BY l.nombre`,
      [fecha]
    );

    const consumoTotalDia = consumos.reduce((sum, c) => sum + parseFloat(c.consumo_total), 0);

    res.json({
      fecha,
      consumo_total_dia: consumoTotalDia,
      lotes_registrados: registros,
      insumos_consumidos: consumos.map(c => {
        const diasRestantes = parseFloat(c.consumo_total) > 0 ? Math.floor(parseFloat(c.stock_actual) / parseFloat(c.consumo_total)) : 999;
        const nivelAlerta = getNivelAlerta(diasRestantes);
        return {
          ...c,
          consumo_total: parseFloat(c.consumo_total),
          stock_actual: parseFloat(c.stock_actual),
          dias_restantes: diasRestantes,
          nivel_alerta: nivelAlerta.nivel,
          color_alerta: nivelAlerta.color,
          label_alerta: nivelAlerta.label,
        };
      }),
    });
  } catch (error) {
    console.error('Error obteniendo resumen diario:', error);
    res.status(500).json({ error: 'Error al obtener resumen diario' });
  }
});

router.get('/historial-consumo', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, insumo_id, lote_id } = req.query;
    let query = `
      SELECT c.fecha, c.lote_id, l.nombre as lote_nombre, c.insumo_id, i.nombre as insumo_nombre,
             c.cantidad_kg, c.cantidad_animales, c.kg_por_animal
      FROM consumo_diario_lote c
      JOIN lotes l ON c.lote_id = l.id
      JOIN insumos i ON c.insumo_id = i.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha_desde) { query += ' AND c.fecha >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { query += ' AND c.fecha <= ?'; params.push(fecha_hasta); }
    if (insumo_id) { query += ' AND c.insumo_id = ?'; params.push(insumo_id); }
    if (lote_id) { query += ' AND c.lote_id = ?'; params.push(lote_id); }

    query += ' ORDER BY c.fecha DESC, l.nombre';

    const [historial] = await pool.query(query, params);
    res.json(historial);
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

router.post('/tipos', async (req, res) => {
  try {
    const { nombre, valor } = req.body;
    if (!nombre || !valor) {
      return res.status(400).json({ error: 'Nombre y valor son requeridos' });
    }
    res.json({ message: 'Tipo registrado', nombre, valor });
  } catch (error) {
    console.error('Error registrando tipo:', error);
    res.status(500).json({ error: 'Error al registrar tipo' });
  }
});

router.delete('/tipos/:valor', async (req, res) => {
  try {
    const { valor } = req.params;
    const tiposProtegidos = ['silo', 'bolson', 'fardo', 'sales'];
    
    if (tiposProtegidos.includes(valor)) {
      return res.status(400).json({ error: 'No se pueden eliminar los tipos originales' });
    }

    const [insumos] = await pool.query('SELECT COUNT(*) as count FROM insumos WHERE tipo_insumo = ? AND activo = TRUE', [valor]);
    if (insumos[0].count > 0) {
      return res.status(400).json({ error: `No se puede eliminar el tipo porque tiene ${insumos[0].count} insumos asociados` });
    }

    res.json({ message: 'Tipo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando tipo:', error);
    res.status(500).json({ error: 'Error al eliminar tipo' });
  }
});

router.get('/estado-alertas', async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = 'SELECT * FROM insumos WHERE activo = TRUE';
    const params = [];

    if (tipo) {
      query += ' AND tipo_insumo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY dias_restantes ASC';
    const [insumos] = await pool.query(query, params);

    const insumosConAlertas = insumos.map(insumo => {
      const nivelAlerta = getNivelAlerta(parseInt(insumo.dias_restantes));
      return {
        ...insumo,
        nivel_alerta: nivelAlerta.nivel,
        color_alerta: nivelAlerta.color,
        label_alerta: nivelAlerta.label,
      };
    });

    res.json({ insumos: insumosConAlertas });
  } catch (error) {
    console.error('Error obteniendo estado de alertas:', error);
    res.status(500).json({ error: 'Error al obtener estado de alertas' });
  }
});

module.exports = router;
