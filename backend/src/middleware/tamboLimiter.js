const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';

// Limita por tambo, no por IP: varios trabajadores de un mismo tambo suelen compartir
// una sola IP (un router de campo), asi que el limiter general por IP puede agotarse
// con uso normal de un solo cliente si hay varios activos a la vez. Debe montarse
// DESPUES de authenticateToken en cada router -- necesita req.user.tambo_id.
// Antes de que exista sesion (o si por algun motivo authenticateToken no corrio),
// cae a limitar por IP normalizada, usando el helper de la libreria para no romper
// con IPv6 (ver ERR_ERL_KEY_GEN_IPV6).
// TAMBO_RATE_LIMIT_MAX permite bajar el limite en tests de integracion (agotar 800-1000
// requests reales para probar el comportamiento seria absurdamente lento); en producción
// y desarrollo normal no se define, y se usa el default.
const tamboLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.TAMBO_RATE_LIMIT_MAX, 10) || (isProduction ? 800 : 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones desde este establecimiento, intente nuevamente en 15 minutos' },
  keyGenerator: (req) => (req.user?.tambo_id ? `tambo_${req.user.tambo_id}` : ipKeyGenerator(req.ip)),
});

module.exports = tamboLimiter;
