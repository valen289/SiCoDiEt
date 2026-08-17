const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const tamboLimiter = require('../middleware/tamboLimiter');
const { body, validationResult } = require('express-validator');
const { logActividad } = require('../utils/actividad');
const { buildUpdateSet } = require('../utils/queryBuilder');
const { PASSWORD_REGEX } = require('../utils/passwordPolicy');
const { sendInvitationEmail } = require('../utils/email');

router.use(authenticateToken);
router.use(tamboLimiter);

// Solo el Dueño gestiona usuarios
const soloDueno = authorizeRoles('dueno');

router.get('/', soloDueno, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, cedula, nombre, email, telefono, rol, activo, fecha_creacion, ultimo_acceso FROM usuarios WHERE tambo_id = ? ORDER BY nombre ASC',
      [req.user.tambo_id]
    );
    res.json({ usuarios });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Debe quedar antes de '/:id' -- si no, "GET /invitaciones" seria capturado
// como si "invitaciones" fuera un id de usuario.
router.get('/invitaciones', soloDueno, async (req, res) => {
  try {
    const [invitaciones] = await pool.query(
      `SELECT id, email, rol, fecha_creacion, fecha_expiracion,
              (fecha_expiracion < NOW()) AS expirada
       FROM invitaciones
       WHERE tambo_id = ? AND usado = 0
       ORDER BY fecha_creacion DESC`,
      [req.user.tambo_id]
    );
    res.json({ invitaciones: invitaciones.map(i => ({ ...i, expirada: !!i.expirada })) });
  } catch (error) {
    console.error('Error listando invitaciones:', error);
    res.status(500).json({ error: 'Error al listar invitaciones' });
  }
});

router.get('/:id', soloDueno, async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, cedula, nombre, email, telefono, rol, activo, fecha_creacion, ultimo_acceso FROM usuarios WHERE id = ? AND tambo_id = ?',
      [req.params.id, req.user.tambo_id]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ usuario: users[0] });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

router.post('/', soloDueno, [
  body('cedula').matches(/^[0-9]{8}$/).withMessage('Cédula inválida, debe tener 8 dígitos'),
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('password').matches(PASSWORD_REGEX).withMessage('Contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial'),
  body('telefono').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{8,20}$/).withMessage('Teléfono inválido'),
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
      return res.status(400).json({ error: 'Ya existe un usuario con esa cédula' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO usuarios (tambo_id, cedula, nombre, password, email, telefono, rol) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.tambo_id, cedula, nombre, hashedPassword, email || null, telefono || null, rol]
    );

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'usuario_creado',
      descripcion: `Creó el usuario "${nombre}" con rol ${rol}`,
    });

    res.status(201).json({ message: 'Usuario creado exitosamente', usuarioId: result.insertId });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

router.put('/:id', soloDueno, [
  body('nombre').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('email').optional().isEmail().withMessage('Email inválido'),
  body('telefono').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{8,20}$/).withMessage('Teléfono inválido'),
  body('rol').optional().isIn(['dueno', 'encargado', 'trabajador']).withMessage('Rol inválido'),
  body('activo').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const targetId = parseInt(req.params.id);

    // Impedir que el único Dueño se quite el rol o se desactive
    if (req.body.rol && req.body.rol !== 'dueno' && targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol de Administrador' });
    }
    if (req.body.activo === false && targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });
    }

    const { nombre, email, telefono, rol, activo } = req.body;
    const { setClause, values, hasUpdates } = buildUpdateSet({
      nombre,
      email: email !== undefined ? (email || null) : undefined,
      telefono: telefono !== undefined ? (telefono || null) : undefined,
      rol,
      activo,
    });

    if (!hasUpdates) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    await pool.query(`UPDATE usuarios SET ${setClause} WHERE id = ? AND tambo_id = ?`, [...values, targetId, req.user.tambo_id]);

    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Restablecer contraseña de un usuario (el Dueño lo hace por usuarios sin email)
router.put('/:id/password', soloDueno, [
  body('password').matches(PASSWORD_REGEX).withMessage('Contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await pool.query('UPDATE usuarios SET password = ? WHERE id = ? AND tambo_id = ?', [hashedPassword, req.params.id, req.user.tambo_id]);

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    res.status(500).json({ error: 'Error al actualizar contraseña' });
  }
});

// Baja lógica: revoca el acceso pero conserva el historial
router.delete('/:id', soloDueno, async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes darte de baja a ti mismo' });
    }

    const [[target]] = await pool.query('SELECT nombre FROM usuarios WHERE id = ? AND tambo_id = ?', [targetId, req.user.tambo_id]);
    await pool.query('UPDATE usuarios SET activo = FALSE WHERE id = ? AND tambo_id = ?', [targetId, req.user.tambo_id]);

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'usuario_desactivado',
      descripcion: `Dio de baja al usuario "${target?.nombre}"`,
    });

    res.json({ message: 'Usuario dado de baja exitosamente' });
  } catch (error) {
    console.error('Error dando de baja usuario:', error);
    res.status(500).json({ error: 'Error al dar de baja el usuario' });
  }
});

// Crear token de invitación (solo dueño). Si se indica email, además se envía el
// link por correo (Brevo) -- el link/QR se sigue devolviendo siempre como respaldo,
// por si el email no llega o el dueño prefiere compartirlo a mano.
router.post('/invitacion', soloDueno, [
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('rol').optional().isIn(['trabajador', 'encargado']).withMessage('Rol inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rol = 'trabajador', email } = req.body;
    const token = crypto.randomBytes(32).toString('hex');
    const expiracion = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      'INSERT INTO invitaciones (tambo_id, token, rol, creado_por, fecha_expiracion, email) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.tambo_id, token, rol, req.user.id, expiracion, email || null]
    );

    let emailEnviado = false;
    if (email) {
      const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3001').split(',')[0].trim();
      const link = `${baseUrl}/register?token=${token}`;
      try {
        await sendInvitationEmail(email, link, rol);
        emailEnviado = true;
      } catch (emailErr) {
        console.error('Error enviando email de invitación:', emailErr);
      }
    }

    res.json({ token, expira: expiracion.toISOString(), emailEnviado });
  } catch (error) {
    console.error('Error creando invitación:', error);
    res.status(500).json({ error: 'Error al crear invitación' });
  }
});

// Revocar una invitación pendiente (solo dueño)
router.delete('/invitaciones/:id', soloDueno, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM invitaciones WHERE id = ? AND tambo_id = ? AND usado = 0',
      [req.params.id, req.user.tambo_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invitación no encontrada o ya utilizada' });
    }

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'invitacion_revocada',
      descripcion: 'Revocó una invitación pendiente',
    });

    res.json({ message: 'Invitación revocada' });
  } catch (error) {
    console.error('Error revocando invitación:', error);
    res.status(500).json({ error: 'Error al revocar invitación' });
  }
});

module.exports = router;
