const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. Token requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalido o expirado' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT u.token_version, t.zona_horaria
         FROM usuarios u JOIN tambos t ON u.tambo_id = t.id
         WHERE u.id = ?`,
        [user.id]
      );
      if (rows.length === 0 || rows[0].token_version !== user.token_version) {
        return res.status(401).json({
          error: 'Tu sesión se cerró porque iniciaste sesión desde otro dispositivo.',
          code: 'SESSION_INVALIDATED'
        });
      }
      user.zona_horaria = rows[0].zona_horaria;
    } catch (dbError) {
      console.error('Error verificando sesion:', dbError);
      return res.status(500).json({ error: 'Error al verificar la sesión' });
    }

    req.user = user;
    next();
  });
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para realizar esta accion' });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };
