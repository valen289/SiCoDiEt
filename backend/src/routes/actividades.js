const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const [[[{ total }]], [actividades]] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM logs_actividad WHERE tambo_id = 1'),
      pool.query(
        `SELECT l.id, l.accion, l.descripcion, l.fecha_hora,
                u.nombre AS usuario_nombre, u.rol AS usuario_rol
         FROM logs_actividad l
         LEFT JOIN usuarios u ON l.usuario_id = u.id
         WHERE l.tambo_id = 1
         ORDER BY l.fecha_hora DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
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

module.exports = router;
