const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { buildUpdateSet } = require('../utils/queryBuilder');
const { PASSWORD_REGEX } = require('../utils/passwordPolicy');
const { sendTwoFactorCodeEmail } = require('../utils/email');

const TWO_FACTOR_CODE_EXPIRY_MINUTES = 10;

router.post('/register', [
  body('cedula').matches(/^[0-9]{8}$/).withMessage('Cedula invalida, debe tener 8 digitos'),
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('email').isEmail().withMessage('Email invalido, es necesario para la verificación en dos pasos'),
  body('password').matches(PASSWORD_REGEX).withMessage('Password debe tener minimo 8 caracteres, mayuscula, minuscula, numero y caracter especial'),
  body('telefono').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{8,20}$/).withMessage('Telefono invalido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cedula, nombre, password, email, telefono, invitation_token, nombre_tambo } = req.body;
    let rol;
    let tambo_id;

    const [existing] = await pool.query('SELECT id FROM usuarios WHERE cedula = ?', [cedula]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con esa cedula' });
    }

    if (invitation_token) {
      const [invRows] = await pool.query(
        'SELECT * FROM invitaciones WHERE token = ? AND usado = 0 AND fecha_expiracion > NOW()',
        [invitation_token]
      );
      if (invRows.length === 0) {
        return res.status(400).json({ error: 'Invitación inválida o expirada' });
      }
      tambo_id = invRows[0].tambo_id;
      rol = invRows[0].rol;
    } else {
      if (!nombre_tambo || !nombre_tambo.trim()) {
        return res.status(400).json({ error: 'Nombre del establecimiento requerido' });
      }
      const [tamboResult] = await pool.query('INSERT INTO tambos (nombre) VALUES (?)', [nombre_tambo.trim()]);
      tambo_id = tamboResult.insertId;
      rol = 'dueno';
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO usuarios (tambo_id, cedula, nombre, password, email, telefono, rol) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tambo_id, cedula, nombre, hashedPassword, email || null, telefono || null, rol]
    );

    if (invitation_token) {
      await pool.query(
        'UPDATE invitaciones SET usado = 1, usuario_id = ? WHERE token = ?',
        [result.insertId, invitation_token]
      );
    }

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Validar token de invitación (público)
router.get('/invitacion/:token', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.token, i.rol, i.fecha_expiracion, t.nombre AS tambo_nombre
       FROM invitaciones i
       JOIN tambos t ON i.tambo_id = t.id
       WHERE i.token = ? AND i.usado = 0 AND i.fecha_expiracion > NOW()`,
      [req.params.token]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invitación inválida o expirada' });
    }
    res.json({ invitacion: rows[0] });
  } catch (error) {
    console.error('Error validando invitacion:', error);
    res.status(500).json({ error: 'Error al validar invitación' });
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
      `SELECT u.id, u.cedula, u.nombre, u.email, u.telefono, u.rol, u.password, u.tambo_id,
              u.intentos_fallidos, u.bloqueado_hasta, u.token_version, t.nombre AS tambo_nombre
       FROM usuarios u
       JOIN tambos t ON u.tambo_id = t.id
       WHERE u.cedula = ? AND u.activo = TRUE`,
      [cedula]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const user = users[0];

    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      const minutosRestantes = Math.ceil((new Date(user.bloqueado_hasta) - new Date()) / 60000);
      return res.status(429).json({ error: `Cuenta bloqueada temporalmente. Intentá de nuevo en ${minutosRestantes} minuto${minutosRestantes !== 1 ? 's' : ''}.` });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      const intentos = (user.intentos_fallidos || 0) + 1;
      if (intentos >= 5) {
        await pool.query(
          'UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
          [intentos, user.id]
        );
        return res.status(429).json({ error: 'Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos.' });
      }
      await pool.query('UPDATE usuarios SET intentos_fallidos = ? WHERE id = ?', [intentos, user.id]);
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    await pool.query(
      'UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?',
      [user.id]
    );

    // Cuentas viejas sin email cargado no tienen a donde recibir el codigo: se
    // les deja entrar sin 2FA en vez de bloquearlas (recomendar agregar email
    // desde Perfil queda para mas adelante).
    if (!user.email) {
      return emitirSesion(res, user);
    }

    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + TWO_FACTOR_CODE_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      'UPDATE usuarios SET two_factor_code_hash = ?, two_factor_code_expires = ? WHERE id = ?',
      [codeHash, expiresAt, user.id]
    );

    try {
      await sendTwoFactorCodeEmail(user.email, code);
    } catch (emailErr) {
      console.error('Error enviando codigo 2FA:', emailErr);
    }

    const tempToken = jwt.sign(
      { id: user.id, purpose: 'two_factor' },
      process.env.JWT_SECRET,
      { expiresIn: `${TWO_FACTOR_CODE_EXPIRY_MINUTES}m` }
    );

    res.json({ requiresTwoFactor: true, tempToken });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
});

router.post('/verify-2fa', [
  body('tempToken').notEmpty().withMessage('Token requerido'),
  body('code').matches(/^[0-9]{6}$/).withMessage('Código inválido')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tempToken, code } = req.body;

    let payload;
    try {
      payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'La sesión de verificación expiró, iniciá sesión nuevamente' });
    }
    if (payload.purpose !== 'two_factor') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const [users] = await pool.query(
      `SELECT u.id, u.cedula, u.nombre, u.email, u.telefono, u.rol, u.tambo_id, u.token_version,
              u.two_factor_code_hash, u.two_factor_code_expires, t.nombre AS tambo_nombre
       FROM usuarios u
       JOIN tambos t ON u.tambo_id = t.id
       WHERE u.id = ? AND u.activo = TRUE`,
      [payload.id]
    );

    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (!user.two_factor_code_hash || !user.two_factor_code_expires || new Date(user.two_factor_code_expires) < new Date()) {
      return res.status(400).json({ error: 'El código expiró, iniciá sesión nuevamente' });
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== user.two_factor_code_hash) {
      return res.status(400).json({ error: 'Código incorrecto' });
    }

    await pool.query(
      'UPDATE usuarios SET two_factor_code_hash = NULL, two_factor_code_expires = NULL WHERE id = ?',
      [user.id]
    );

    await emitirSesion(res, user);
  } catch (error) {
    console.error('Error en verify-2fa:', error);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

// Incrementa token_version (invalida cualquier sesion anterior del usuario),
// emite el JWT definitivo y responde con el usuario logueado.
async function emitirSesion(res, user) {
  const tokenVersion = (user.token_version || 1) + 1;

  await pool.query(
    'UPDATE usuarios SET ultimo_acceso = NOW(), token_version = ? WHERE id = ?',
    [tokenVersion, user.id]
  );

  const token = jwt.sign(
    {
      id: user.id,
      cedula: user.cedula,
      nombre: user.nombre,
      rol: user.rol,
      tambo_id: user.tambo_id,
      token_version: tokenVersion
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
      rol: user.rol,
      tambo_id: user.tambo_id,
      tambo_nombre: user.tambo_nombre
    }
  });
}

router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.cedula, u.nombre, u.email, u.telefono, u.rol, u.tambo_id, t.nombre AS tambo_nombre
       FROM usuarios u
       JOIN tambos t ON u.tambo_id = t.id
       WHERE u.id = ?`,
      [req.user.id]
    );

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
  body('telefono').optional({ checkFalsy: true }).matches(/^[0-9+\- ]{8,20}$/).withMessage('Telefono invalido'),
  body('password').optional().matches(PASSWORD_REGEX).withMessage('Password debe tener minimo 8 caracteres, mayuscula, minuscula, numero y caracter especial'),
  body('currentPassword').optional().notEmpty().withMessage('Contraseña actual requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, email, telefono, password, currentPassword } = req.body;

    let hashedPassword;
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Debes ingresar tu contraseña actual para cambiarla' });
      }
      const [[usuario]] = await pool.query('SELECT password FROM usuarios WHERE id = ?', [req.user.id]);
      const validPassword = await bcrypt.compare(currentPassword, usuario.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
      }
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const { setClause, values, hasUpdates } = buildUpdateSet({
      password: hashedPassword,
      nombre,
      email: email !== undefined ? (email || null) : undefined,
      telefono: telefono !== undefined ? (telefono || null) : undefined,
    });

    if (!hasUpdates) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    await pool.query(`UPDATE usuarios SET ${setClause} WHERE id = ?`, [...values, req.user.id]);

    const [users] = await pool.query(
      `SELECT u.id, u.cedula, u.nombre, u.email, u.telefono, u.rol, u.tambo_id, t.nombre AS tambo_nombre
       FROM usuarios u
       JOIN tambos t ON u.tambo_id = t.id
       WHERE u.id = ?`,
      [req.user.id]
    );

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
