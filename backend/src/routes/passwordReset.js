const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { sendPasswordResetEmail } = require('../utils/email');
const { PASSWORD_REGEX } = require('../utils/passwordPolicy');

const TOKEN_EXPIRY_HOURS = parseInt(process.env.RESET_TOKEN_EXPIRY) || 1;

router.post('/forgot-password', [
  body('email').isEmail().withMessage('Email invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email } = req.body;

    const [users] = await pool.query('SELECT id, nombre FROM usuarios WHERE email = ? AND activo = TRUE', [email]);

    if (users.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      // El token ya tiene 256 bits propios de entropia (no es una password de baja entropia que
      // necesite el hash lento+salado de bcrypt). Usamos SHA-256 para poder buscarlo directo por
      // igualdad en el SELECT de abajo, en vez de cargar todos los tokens vigentes en memoria.
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      await pool.query(
        'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES (?, ?, ?)',
        [email, hashedToken, expiresAt]
      );

      try {
        await sendPasswordResetEmail(email, token);
      } catch (emailErr) {
        console.error('Error enviando email:', emailErr);
      }
    }

    res.json({ message: 'Si el email existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.' });
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token requerido'),
  body('password').matches(PASSWORD_REGEX).withMessage('La contraseña debe tener minimo 8 caracteres, mayuscula, minuscula, numero y caracter especial'),
  body('confirmPassword').notEmpty().withMessage('Confirma tu contraseña'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { token, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const [tokens] = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = FALSE AND expires_at > NOW()',
      [hashedToken]
    );
    const tokenRecord = tokens[0];

    if (!tokenRecord) {
      return res.status(400).json({ error: 'Token invalido o expirado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query('UPDATE usuarios SET password = ? WHERE email = ?', [hashedPassword, tokenRecord.email]);

    await pool.query('UPDATE password_reset_tokens SET used = TRUE WHERE id = ?', [tokenRecord.id]);

    res.json({ message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

module.exports = router;
