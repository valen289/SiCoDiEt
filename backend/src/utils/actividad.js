/**
 * Registra una acción en logs_actividad.
 * Los errores se absorben silenciosamente para no interrumpir la operación principal.
 */
const logActividad = async (pool, { usuario_id, accion, descripcion, tambo_id = 1 }) => {
  try {
    await pool.query(
      'INSERT INTO logs_actividad (tambo_id, usuario_id, accion, descripcion) VALUES (?, ?, ?, ?)',
      [tambo_id, usuario_id || null, accion, descripcion]
    );
  } catch (err) {
    console.error('Error registrando actividad:', err.message);
  }
};

module.exports = { logActividad };
