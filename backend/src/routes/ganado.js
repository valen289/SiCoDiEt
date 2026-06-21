const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const [ganado] = await pool.query('SELECT * FROM ganado WHERE tambo_id = ? ORDER BY fecha_registro DESC LIMIT 1', [req.user.tambo_id]);
    res.json({ ganado: ganado[0] || null });
  } catch (error) {
    console.error('Error obteniendo ganado:', error);
    res.status(500).json({ error: 'Error al obtener datos de ganado' });
  }
});

router.get('/historial', async (req, res) => {
  try {
    const [historial] = await pool.query('SELECT * FROM ganado WHERE tambo_id = ? ORDER BY fecha_registro DESC LIMIT 30', [req.user.tambo_id]);
    res.json({ historial });
  } catch (error) {
    console.error('Error obteniendo historial de ganado:', error);
    res.status(500).json({ error: 'Error al obtener historial de ganado' });
  }
});

router.post('/', authorizeRoles('dueno', 'encargado'), [
  body('total_vacas').isInt({ min: 0 }).withMessage('Total de vacas debe ser mayor o igual a 0'),
  body('vacas_lechera').optional().isInt({ min: 0 }),
  body('vacas_seco').optional().isInt({ min: 0 }),
  body('terneros').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { total_vacas, vacas_lechera = 0, vacas_seco = 0, terneros = 0 } = req.body;

    const [result] = await pool.query(
      'INSERT INTO ganado (tambo_id, total_vacas, vacas_lechera, vacas_seco, terneros, fecha_registro, usuario_id) VALUES (?, ?, ?, ?, ?, CURDATE(), ?)',
      [req.user.tambo_id, total_vacas, vacas_lechera, vacas_seco, terneros, req.user.id]
    );

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'ganado_actualizado',
      descripcion: `Actualizó el rodeo: ${total_vacas} vacas totales (${vacas_lechera} lecheras, ${vacas_seco} secas, ${terneros} terneros)`,
    });

    res.status(201).json({
      message: 'Registro de ganado creado exitosamente',
      registroId: result.insertId
    });
  } catch (error) {
    console.error('Error registrando ganado:', error);
    res.status(500).json({ error: 'Error al registrar ganado' });
  }
});

module.exports = router;
