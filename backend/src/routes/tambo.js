const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const tamboLimiter = require('../middleware/tamboLimiter');
const { buildUpdateSet } = require('../utils/queryBuilder');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);
router.use(tamboLimiter);

const soloDueno = authorizeRoles('dueno');

const ZONAS_VALIDAS = [
  'America/Montevideo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Asuncion',
];

router.get('/', async (req, res) => {
  try {
    const [[tambo]] = await pool.query(
      'SELECT nombre, logo, zona_horaria FROM tambos WHERE id = ?',
      [req.user.tambo_id]
    );
    res.json({ tambo });
  } catch (error) {
    console.error('Error obteniendo tambo:', error);
    res.status(500).json({ error: 'Error al obtener los datos del establecimiento' });
  }
});

router.put('/', soloDueno, [
  body('nombre').optional().notEmpty().withMessage('El nombre no puede estar vacio'),
  body('zona_horaria').optional().isIn(ZONAS_VALIDAS).withMessage('Zona horaria invalida'),
  body('logo').optional({ nullable: true }).custom((value) => {
    if (value === null) return true;
    if (typeof value !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(value)) {
      throw new Error('Logo invalido');
    }
    if (value.length > 2_000_000) {
      throw new Error('Logo demasiado grande');
    }
    return true;
  }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, zona_horaria, logo } = req.body;
    const { setClause, values, hasUpdates } = buildUpdateSet({ nombre, zona_horaria, logo });

    if (!hasUpdates) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    await pool.query(`UPDATE tambos SET ${setClause} WHERE id = ?`, [...values, req.user.tambo_id]);

    const [[tambo]] = await pool.query(
      'SELECT nombre, logo, zona_horaria FROM tambos WHERE id = ?',
      [req.user.tambo_id]
    );

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'tambo_actualizado',
      descripcion: `Actualizó la configuración del establecimiento "${tambo.nombre}"`,
    });

    res.json({ message: 'Establecimiento actualizado exitosamente', tambo });
  } catch (error) {
    console.error('Error actualizando tambo:', error);
    res.status(500).json({ error: 'Error al actualizar el establecimiento' });
  }
});

// Borrado permanente del establecimiento: elimina TODOS los usuarios (para liberar
// sus cedulas, unicas en el sistema, y que puedan registrarse en otro tambo) y todos
// los datos asociados. No hay soft-delete posible aca -- ver justificacion en el plan.
// Las FKs hacia tambos son todas RESTRICT (a proposito, no se tocan): el orden de los
// DELETE de abajo respeta ese grafo para que el ultimo DELETE FROM tambos no falle.
router.delete('/', soloDueno, [
  body('password').notEmpty().withMessage('La contraseña es requerida para confirmar'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const [[usuario]] = await pool.query('SELECT password FROM usuarios WHERE id = ?', [req.user.id]);
    const valido = await bcrypt.compare(req.body.password, usuario.password);
    if (!valido) {
      return res.status(400).json({ error: 'Contraseña incorrecta' });
    }

    // tambo_id SIEMPRE del JWT -- nunca debe poder venir del body/params en este endpoint.
    const tamboId = req.user.tambo_id;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Cuelgan de usuarios sin FK propia hacia tambos.
      await connection.query(
        'DELETE FROM push_subscriptions WHERE usuario_id IN (SELECT id FROM usuarios WHERE tambo_id = ?)',
        [tamboId]
      );
      await connection.query(
        'DELETE FROM password_reset_tokens WHERE email IN (SELECT email FROM usuarios WHERE tambo_id = ? AND email IS NOT NULL)',
        [tamboId]
      );

      // 2. Tablas con tambo_id sin FK real (huerfanas de database.sql, no se limpian solas).
      await connection.query('DELETE FROM invitaciones WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM compras WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM proveedores WHERE tambo_id = ?', [tamboId]);

      // 3. Tablas con tambo_id + FK real (RESTRICT) que bloquean tambos/lotes/insumos/usuarios.
      await connection.query('DELETE FROM notificaciones_programadas_enviadas WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM consumo_diario_lote WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM dietas WHERE tambo_id = ?', [tamboId]); // cascada sola a dieta_ingredientes
      await connection.query('DELETE FROM movimientos_stock WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM historial_cargas_alimentos WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM logs_actividad WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM alertas WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM ganado WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM consumo_diario WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM consumos WHERE tambo_id = ?', [tamboId]);

      // 4. lotes/insumos: cascada sola a lote_insumos, costos_ingredientes,
      //    dieta_ingredientes, parametros_nutricionales, registro_diario_animales.
      await connection.query('DELETE FROM lotes WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM insumos WHERE tambo_id = ?', [tamboId]);

      // 5. usuarios y por ultimo el tambo.
      await connection.query('DELETE FROM usuarios WHERE tambo_id = ?', [tamboId]);
      await connection.query('DELETE FROM tambos WHERE id = ?', [tamboId]);

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // logs_actividad tambien se borro como parte de esto -- este console.log queda
    // como unico rastro (visible en los logs de Railway) de que la eliminacion ocurrio.
    console.log(`Establecimiento eliminado permanentemente: tambo_id=${tamboId}, por usuario_id=${req.user.id}`);

    res.json({ message: 'Establecimiento eliminado permanentemente' });
  } catch (error) {
    console.error('Error eliminando establecimiento:', error);
    res.status(500).json({ error: 'Error al eliminar el establecimiento' });
  }
});

module.exports = router;
