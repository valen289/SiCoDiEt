const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

router.post('/register', [
  body('cedula').notEmpty().withMessage('Cedula requerida'),
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('password').isLength({ min: 6 }).withMessage('Password minimo 6 caracteres'),
  body('rol').optional().isIn(['dueno', 'encargado', 'trabajador'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cedula, nombre, password, email, telefono, rol = 'trabajador' } = req.body;

    const [existing] = await pool.query('SELECT id FROM usuarios WHERE cedula = ?', [cedula]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con esa cedula' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO usuarios (cedula, nombre, password, email, telefono, rol) VALUES (?, ?, ?, ?, ?, ?)',
      [cedula, nombre, hashedPassword, email || null, telefono || null, rol]
    );

    res.status(201).json({ 
      message: 'Usuario registrado exitosamente',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

router.post('/login', [
  body('cedula').notEmpty().withMessage('Cedula requerida'),
  body('password').notEmpty().withMessage('Password requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cedula, password } = req.body;

    const [users] = await pool.query(
      'SELECT id, cedula, nombre, email, telefono, rol, password FROM usuarios WHERE cedula = ? AND activo = TRUE',
      [cedula]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    await pool.query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { 
        id: user.id, 
        cedula: user.cedula, 
        nombre: user.nombre, 
        rol: user.rol 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        cedula: user.cedula,
        nombre: user.nombre,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, cedula, nombre, email, telefono, rol FROM usuarios WHERE id = ?', [req.user.id]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
});

router.put('/profile', require('../middleware/auth').authenticateToken, [
  body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacio'),
  body('email').optional().isEmail().withMessage('Email invalido'),
  body('telefono').optional(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password minimo 6 caracteres')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, email, telefono, password } = req.body;
    const updates = [];
    const values = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      values.push(nombre);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email || null);
    }
    if (telefono !== undefined) {
      updates.push('telefono = ?');
      values.push(telefono || null);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(req.user.id);
    await pool.query(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, values);

    const [users] = await pool.query('SELECT id, cedula, nombre, email, telefono, rol FROM usuarios WHERE id = ?', [req.user.id]);
    
    res.json({ 
      message: 'Perfil actualizado exitosamente',
      user: users[0]
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

module.exports = router;
