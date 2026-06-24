const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const { leidas } = req.query;
    let query = 'SELECT a.*, i.nombre as insumo_nombre FROM alertas a LEFT JOIN insumos i ON a.insumo_id = i.id WHERE a.tambo_id = ?';
    const params = [req.user.tambo_id];

    if (leidas !== undefined) {
      query += ' AND a.leida = ?';
      params.push(leidas === 'true' ? 1 : 0);
    }

    query += ' ORDER BY a.fecha_creacion DESC';
    const [alertas] = await pool.query(query, params);
    res.json({ alertas });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

router.put('/:id/leer', authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    await pool.query('UPDATE alertas SET leida = TRUE WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    res.json({ message: 'Alerta marcada como leida' });
  } catch (error) {
    console.error('Error actualizando alerta:', error);
    res.status(500).json({ error: 'Error al actualizar alerta' });
  }
});

router.put('/leer-todas', authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    await pool.query('UPDATE alertas SET leida = TRUE WHERE leida = FALSE AND tambo_id = ?', [req.user.tambo_id]);
    res.json({ message: 'Todas las alertas marcadas como leidas' });
  } catch (error) {
    console.error('Error actualizando alertas:', error);
    res.status(500).json({ error: 'Error al actualizar alertas' });
  }
});

router.delete('/:id', authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    await pool.query('DELETE FROM alertas WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    res.json({ message: 'Alerta eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando alerta:', error);
    res.status(500).json({ error: 'Error al eliminar alerta' });
  }
});

module.exports = router;
