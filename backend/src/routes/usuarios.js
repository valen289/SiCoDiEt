const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

router.use(authenticateToken);

router.get('/', authorizeRoles('admin', 'operario'), async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, cedula, nombre, email, telefono, rol, activo, fecha_creacion, ultimo_acceso FROM usuarios');
    res.json({ users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

router.get('/:id', authorizeRoles('admin', 'operario'), async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, cedula, nombre, email, telefono, rol, activo, fecha_creacion, ultimo_acceso FROM usuarios WHERE id = ?', [req.params.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

router.put('/:id', authorizeRoles('admin', 'operario'), [
  body('nombre').optional().notEmpty(),
  body('email').optional().isEmail(),
  body('telefono').optional(),
  body('rol').optional().isIn(['admin', 'usuario', 'operario']),
  body('activo').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, email, telefono, rol, activo } = req.body;
    const updates = [];
    const values = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (telefono !== undefined) { updates.push('telefono = ?'); values.push(telefono); }
    if (rol !== undefined) { updates.push('rol = ?'); values.push(rol); }
    if (activo !== undefined) { updates.push('activo = ?'); values.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

router.put('/:id/password', authorizeRoles('admin', 'operario'), [
  body('password').isLength({ min: 6 }).withMessage('Password minimo 6 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await pool.query('UPDATE usuarios SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);

    res.json({ message: 'Password actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando password:', error);
    res.status(500).json({ error: 'Error al actualizar password' });
  }
});

router.delete('/:id', authorizeRoles('admin', 'operario'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    await pool.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
