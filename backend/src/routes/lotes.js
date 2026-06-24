const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { logActividad } = require('../utils/actividad');
const { buildUpdateSet } = require('../utils/queryBuilder');

router.use(authenticateToken);

const duenoEncargado = authorizeRoles('dueno', 'encargado');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         l.id, l.nombre, l.tipo_animal, l.objetivo_productivo, l.etapa_lactancia, l.cantidad_animales, l.consumo_estimado_diario,
         l.observaciones, l.activo, l.fecha_creacion,
         i.id AS insumo_id, i.nombre AS insumo_nombre, i.unidad, i.tipo_insumo,
         i.stock_actual, i.capacidad_maxima, i.stock_minimo,
         i.consumo_promedio_diario, i.dias_restantes,
         li.cantidad_requerida
       FROM lotes l
       LEFT JOIN lote_insumos li ON l.id = li.lote_id
       LEFT JOIN insumos i ON li.insumo_id = i.id AND i.activo = TRUE
       WHERE l.tambo_id = ? AND l.activo = TRUE
       ORDER BY l.nombre`,
      [req.user.tambo_id]
    );

    const lotesMap = new Map();
    for (const row of rows) {
      if (!lotesMap.has(row.id)) {
        lotesMap.set(row.id, {
          id: row.id,
          nombre: row.nombre,
          tipo_animal: row.tipo_animal,
          objetivo_productivo: row.objetivo_productivo,
          etapa_lactancia: row.etapa_lactancia,
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
       JOIN lotes l ON d.lote_id = l.id
       WHERE d.lote_id = ? AND d.activo = TRUE AND l.tambo_id = ?
       ORDER BY d.fecha_creacion DESC LIMIT 1`,
      [loteId, req.user.tambo_id]
    );
    
    if (dietas.length === 0) {
      return res.json({ dieta: null, ingredientes: [] });
    }
    
    const dieta = dietas[0];
    const [ingredientes] = await pool.query(
      `SELECT di.insumo_id, di.cantidad_kg as kg_por_vaca, di.porcentaje_am,
              i.nombre as insumo_nombre, i.unidad
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
    const [lotes] = await pool.query('SELECT * FROM lotes WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);

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

router.post('/', duenoEncargado, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('tipo_animal').notEmpty().withMessage('Tipo de animal requerido'),
  body('objetivo_productivo').optional().isIn(['leche', 'engorde']).withMessage('Objetivo productivo invalido'),
  body('etapa_lactancia').optional({ nullable: true }).isIn(['temprana', 'media', 'tardia', 'seca']).withMessage('Etapa de lactancia invalida'),
  body('cantidad_animales').isInt({ min: 0 }).withMessage('Cantidad debe ser mayor o igual a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_animal, cantidad_animales, observaciones, objetivo_productivo = 'leche', etapa_lactancia } = req.body;

    const [result] = await pool.query(
      'INSERT INTO lotes (tambo_id, nombre, tipo_animal, objetivo_productivo, etapa_lactancia, cantidad_animales, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.tambo_id, nombre, tipo_animal, objetivo_productivo, etapa_lactancia || null, cantidad_animales, observaciones || null]
    );

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
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

router.put('/:id', duenoEncargado, [
  body('nombre').optional().notEmpty(),
  body('tipo_animal').optional().notEmpty(),
  body('objetivo_productivo').optional().isIn(['leche', 'engorde']).withMessage('Objetivo productivo invalido'),
  body('etapa_lactancia').optional({ nullable: true }).isIn(['temprana', 'media', 'tardia', 'seca']).withMessage('Etapa de lactancia invalida'),
  body('cantidad_animales').optional().isInt({ min: 0 }),
  body('consumo_estimado_diario').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_animal, objetivo_productivo, etapa_lactancia, cantidad_animales, observaciones, activo } = req.body;
    const { setClause, values, hasUpdates } = buildUpdateSet({
      nombre,
      tipo_animal,
      objetivo_productivo,
      etapa_lactancia: etapa_lactancia !== undefined ? (etapa_lactancia || null) : undefined,
      cantidad_animales,
      observaciones,
      activo,
    });

    if (!hasUpdates) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    await pool.query(`UPDATE lotes SET ${setClause} WHERE id = ? AND tambo_id = ?`, [...values, req.params.id, req.user.tambo_id]);

    const [[lote]] = await pool.query('SELECT nombre FROM lotes WHERE id = ?', [req.params.id]);
    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'lote_actualizado',
      descripcion: `Actualizó el lote "${lote?.nombre}"`,
    });

    res.json({ message: 'Lote actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando lote:', error);
    res.status(500).json({ error: 'Error al actualizar lote' });
  }
});

router.post('/:id/insumos', duenoEncargado, [
  body('insumo_id').isInt().withMessage('ID de insumo requerido'),
  body('cantidad_requerida').isFloat({ min: 0 }).withMessage('Cantidad requerida debe ser mayor a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { insumo_id, cantidad_requerida } = req.body;

    const [lotes] = await pool.query('SELECT id FROM lotes WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    if (lotes.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    const [insumos] = await pool.query('SELECT id FROM insumos WHERE id = ? AND tambo_id = ?', [insumo_id, req.user.tambo_id]);
    if (insumos.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

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

router.delete('/:id/insumos/:insumoId', duenoEncargado, async (req, res) => {
  try {
    const [lotes] = await pool.query('SELECT id FROM lotes WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    if (lotes.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }

    await pool.query('DELETE FROM lote_insumos WHERE lote_id = ? AND insumo_id = ?', [req.params.id, req.params.insumoId]);
    res.json({ message: 'Insumo desvinculado del lote exitosamente' });
  } catch (error) {
    console.error('Error desvinculando insumo:', error);
    res.status(500).json({ error: 'Error al desvincular insumo del lote' });
  }
});

router.delete('/:id', duenoEncargado, async (req, res) => {
  try {
    const [[lote]] = await pool.query('SELECT nombre FROM lotes WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    await pool.query('UPDATE lotes SET activo = FALSE WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
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
