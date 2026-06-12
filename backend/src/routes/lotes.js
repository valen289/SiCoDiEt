const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         l.id, l.nombre, l.tipo_animal, l.cantidad_animales, l.consumo_estimado_diario,
         l.observaciones, l.activo, l.fecha_creacion,
         i.id AS insumo_id, i.nombre AS insumo_nombre, i.unidad, i.tipo_insumo,
         i.stock_actual, i.capacidad_maxima, i.stock_minimo,
         i.consumo_promedio_diario, i.dias_restantes,
         li.cantidad_requerida
       FROM lotes l
       LEFT JOIN lote_insumos li ON l.id = li.lote_id
       LEFT JOIN insumos i ON li.insumo_id = i.id AND i.activo = TRUE
       WHERE l.activo = TRUE
       ORDER BY l.nombre`
    );

    const lotesMap = new Map();
    for (const row of rows) {
      if (!lotesMap.has(row.id)) {
        lotesMap.set(row.id, {
          id: row.id,
          nombre: row.nombre,
          tipo_animal: row.tipo_animal,
          cantidad_animales: row.cantidad_animales,
          consumo_estimado_diario: row.consumo_estimado_diario,
          observaciones: row.observaciones,
          activo: row.activo,
          fecha_creacion: row.fecha_creacion,
          insumos_requeridos: []
        });
      }
      if (row.insumo_id !== null) {
        lotesMap.get(row.id).insumos_requeridos.push({
          id: row.insumo_id,
          nombre: row.insumo_nombre,
          unidad: row.unidad,
          tipo_insumo: row.tipo_insumo,
          stock_actual: row.stock_actual,
          capacidad_maxima: row.capacidad_maxima,
          stock_minimo: row.stock_minimo,
          consumo_promedio_diario: row.consumo_promedio_diario,
          dias_restantes: row.dias_restantes,
          cantidad_requerida: row.cantidad_requerida
        });
      }
    }

    res.json({ lotes: Array.from(lotesMap.values()) });
  } catch (error) {
    console.error('Error obteniendo lotes:', error);
    res.status(500).json({ error: 'Error al obtener lotes' });
  }
});

router.get('/:id/dieta-activa', async (req, res) => {
  try {
    const loteId = req.params.id;
    
    const [dietas] = await pool.query(
      `SELECT d.* FROM dietas d 
       WHERE d.lote_id = ? AND d.activo = TRUE 
       ORDER BY d.fecha_creacion DESC LIMIT 1`,
      [loteId]
    );
    
    if (dietas.length === 0) {
      return res.json({ dieta: null, ingredientes: [] });
    }
    
    const dieta = dietas[0];
    const [ingredientes] = await pool.query(
      `SELECT di.insumo_id, di.cantidad_kg as kg_por_vaca, i.nombre as insumo_nombre, i.unidad
       FROM dieta_ingredientes di
       JOIN insumos i ON di.insumo_id = i.id
       WHERE di.dieta_id = ?`,
      [dieta.id]
    );
    
    res.json({ 
      dieta,
      ingredientes,
      consumo_total_por_vaca: ingredientes.reduce((sum, ing) => sum + parseFloat(ing.kg_por_vaca), 0)
    });
  } catch (error) {
    console.error('Error obteniendo dieta activa:', error);
    res.status(500).json({ error: 'Error al obtener dieta activa' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [lotes] = await pool.query('SELECT * FROM lotes WHERE id = ?', [req.params.id]);
    
    if (lotes.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    const lote = lotes[0];
    const [insumos] = await pool.query(
      'SELECT li.*, i.nombre, i.unidad FROM lote_insumos li JOIN insumos i ON li.insumo_id = i.id WHERE li.lote_id = ?',
      [lote.id]
    );
    lote.insumos_requeridos = insumos;

    res.json({ lote });
  } catch (error) {
    console.error('Error obteniendo lote:', error);
    res.status(500).json({ error: 'Error al obtener lote' });
  }
});

router.post('/', [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('tipo_animal').notEmpty().withMessage('Tipo de animal requerido'),
  body('cantidad_animales').isInt({ min: 0 }).withMessage('Cantidad debe ser mayor o igual a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_animal, cantidad_animales, consumo_estimado_diario = 0, observaciones } = req.body;

    const [result] = await pool.query(
      'INSERT INTO lotes (nombre, tipo_animal, cantidad_animales, consumo_estimado_diario, observaciones) VALUES (?, ?, ?, ?, ?)',
      [nombre, tipo_animal, cantidad_animales, consumo_estimado_diario, observaciones || null]
    );

    await logActividad(pool, {
      usuario_id: req.user.id,
      accion: 'lote_creado',
      descripcion: `Creó el lote "${nombre}"`,
    });

    res.status(201).json({
      message: 'Lote creado exitosamente',
      loteId: result.insertId
    });
  } catch (error) {
    console.error('Error creando lote:', error);
    res.status(500).json({ error: 'Error al crear lote' });
  }
});

router.put('/:id', [
  body('nombre').optional().notEmpty(),
  body('tipo_animal').optional().notEmpty(),
  body('cantidad_animales').optional().isInt({ min: 0 }),
  body('consumo_estimado_diario').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_animal, cantidad_animales, consumo_estimado_diario, observaciones, activo } = req.body;
    const updates = [];
    const values = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (tipo_animal !== undefined) { updates.push('tipo_animal = ?'); values.push(tipo_animal); }
    if (cantidad_animales !== undefined) { updates.push('cantidad_animales = ?'); values.push(cantidad_animales); }
    if (consumo_estimado_diario !== undefined) { updates.push('consumo_estimado_diario = ?'); values.push(consumo_estimado_diario); }
    if (observaciones !== undefined) { updates.push('observaciones = ?'); values.push(observaciones); }
    if (activo !== undefined) { updates.push('activo = ?'); values.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE lotes SET ${updates.join(', ')} WHERE id = ?`, values);

    const [[lote]] = await pool.query('SELECT nombre FROM lotes WHERE id = ?', [req.params.id]);
    await logActividad(pool, {
      usuario_id: req.user.id,
      accion: 'lote_actualizado',
      descripcion: `Actualizó el lote "${lote?.nombre}"`,
    });

    res.json({ message: 'Lote actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando lote:', error);
    res.status(500).json({ error: 'Error al actualizar lote' });
  }
});

router.post('/:id/insumos', [
  body('insumo_id').isInt().withMessage('ID de insumo requerido'),
  body('cantidad_requerida').isFloat({ min: 0 }).withMessage('Cantidad requerida debe ser mayor a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { insumo_id, cantidad_requerida } = req.body;

    await pool.query(
      'INSERT INTO lote_insumos (lote_id, insumo_id, cantidad_requerida) VALUES (?, ?, ?)',
      [req.params.id, insumo_id, cantidad_requerida]
    );

    res.status(201).json({ message: 'Insumo asociado al lote exitosamente' });
  } catch (error) {
    console.error('Error asociando insumo:', error);
    res.status(500).json({ error: 'Error al asociar insumo al lote' });
  }
});

router.delete('/:id/insumos/:insumoId', async (req, res) => {
  try {
    await pool.query('DELETE FROM lote_insumos WHERE lote_id = ? AND insumo_id = ?', [req.params.id, req.params.insumoId]);
    res.json({ message: 'Insumo desvinculado del lote exitosamente' });
  } catch (error) {
    console.error('Error desvinculando insumo:', error);
    res.status(500).json({ error: 'Error al desvincular insumo del lote' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const [[lote]] = await pool.query('SELECT nombre FROM lotes WHERE id = ?', [req.params.id]);
    await pool.query('UPDATE lotes SET activo = FALSE WHERE id = ?', [req.params.id]);

    await logActividad(pool, {
      usuario_id: req.user.id,
      accion: 'lote_desactivado',
      descripcion: `Desactivó el lote "${lote?.nombre}"`,
    });

    res.json({ message: 'Lote desactivado exitosamente' });
  } catch (error) {
    console.error('Error desactivando lote:', error);
    res.status(500).json({ error: 'Error al desactivar lote' });
  }
});

module.exports = router;
