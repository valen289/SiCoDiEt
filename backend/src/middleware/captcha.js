const { verifyTurnstile } = require('../utils/turnstile');

async function requireCaptcha(req, res, next) {
  const ok = await verifyTurnstile(req.body.captchaToken, req.ip);
  if (!ok) {
    return res.status(400).json({ error: 'Verificación de seguridad fallida. Recargá la página e intentá de nuevo.' });
  }
  next();
}

module.exports = requireCaptcha;
