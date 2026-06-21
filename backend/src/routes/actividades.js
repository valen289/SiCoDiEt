const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const tamboId = req.user.tambo_id;

    const [[[{ total }]], [actividades]] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM logs_actividad WHERE tambo_id = ? AND leida = FALSE', [tamboId]),
      pool.query(
        `SELECT l.id, l.accion, l.descripcion, l.fecha_hora, l.leida,
                u.nombre AS usuario_nombre, u.rol AS usuario_rol
         FROM logs_actividad l
         LEFT JOIN usuarios u ON l.usuario_id = u.id
         WHERE l.tambo_id = ? AND l.leida = FALSE
         ORDER BY l.fecha_hora DESC
         LIMIT ? OFFSET ?`,
        [tamboId, limit, offset]
      ),
    ]);

    res.json({
      actividades,
      total,
      pagina: page,
      total_paginas: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error obteniendo actividades:', error);
    res.status(500).json({ error: 'Error al obtener actividades' });
  }
});

router.patch('/:id/leida', authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE logs_actividad SET leida = TRUE WHERE id = ? AND tambo_id = ?',
      [req.params.id, req.user.tambo_id]
    );
    res.json({ message: 'Actividad marcada como leída' });
  } catch (error) {
    console.error('Error marcando actividad como leída:', error);
    res.status(500).json({ error: 'Error al marcar actividad como leída' });
  }
});

router.delete('/:id', authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM logs_actividad WHERE id = ? AND tambo_id = ?',
      [req.params.id, req.user.tambo_id]
    );
    res.json({ message: 'Actividad eliminada' });
  } catch (error) {
    console.error('Error eliminando actividad:', error);
    res.status(500).json({ error: 'Error al eliminar actividad' });
  }
});

module.exports = router;
