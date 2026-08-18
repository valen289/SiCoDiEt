const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const tamboLimiter = require('../middleware/tamboLimiter');

router.use(authenticateToken);
router.use(tamboLimiter);

router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

router.post('/suscribir', [
  body('endpoint').isString().notEmpty().withMessage('endpoint requerido'),
  body('keys.p256dh').isString().notEmpty().withMessage('keys.p256dh requerido'),
  body('keys.auth').isString().notEmpty().withMessage('keys.auth requerido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { endpoint, keys } = req.body;

    await pool.query(
      `INSERT INTO push_subscriptions (usuario_id, endpoint, keys_p256dh, keys_auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE keys_p256dh = ?, keys_auth = ?`,
      [req.user.id, endpoint, keys.p256dh, keys.auth, keys.p256dh, keys.auth]
    );

    res.status(201).json({ message: 'Suscripción a notificaciones guardada' });
  } catch (error) {
    console.error('Error guardando suscripción push:', error);
    res.status(500).json({ error: 'Error al guardar la suscripción' });
  }
});

router.delete('/suscribir', [
  body('endpoint').isString().notEmpty().withMessage('endpoint requerido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    await pool.query(
      'DELETE FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?',
      [req.user.id, req.body.endpoint]
    );

    res.json({ message: 'Suscripción cancelada' });
  } catch (error) {
    console.error('Error cancelando suscripción push:', error);
    res.status(500).json({ error: 'Error al cancelar la suscripción' });
  }
});

module.exports = router;
