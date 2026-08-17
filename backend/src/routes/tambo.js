const express = require('express');
const router = express.Router();
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

module.exports = router;
