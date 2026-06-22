const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { verificarYGenerarAlertas, getNivelAlerta, calcularEstadoActual } = require('../utils/alertas');
const { logActividad } = require('../utils/actividad');

router.use(authenticateToken);

const duenoEncargado = authorizeRoles('dueno', 'encargado');

router.get('/', async (req, res) => {
  try {
    const { tipo, categoria } = req.query;
    let query = `
      SELECT i.*, pn.materia_seca_porcentaje
      FROM insumos i
      LEFT JOIN parametros_nutricionales pn ON pn.insumo_id = i.id
      WHERE i.tambo_id = ? AND i.activo = TRUE`;
    const params = [req.user.tambo_id];

    if (categoria) {
      query += ' AND i.categoria = ?';
      params.push(categoria);
    } else if (tipo) {
      query += ' AND i.tipo_insumo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY i.nombre ASC';
    const [insumos] = await pool.query(query, params);

    const insumosActualizados = await Promise.all(
      insumos.map(async (insumo) => ({
        ...insumo,
        ...(await calcularEstadoActual(insumo)),
        // kg de materia seca disponible = stock fisico x %MS. Solo se calcula si el
        // insumo ya tiene %MS cargado en parametros nutricionales; si no, no se fuerza.
        kg_materia_seca_disponible: insumo.materia_seca_porcentaje
          ? parseFloat(insumo.stock_actual) * (parseFloat(insumo.materia_seca_porcentaje) / 100)
          : null,
      }))
    );

    res.json({ insumos: insumosActualizados });
  } catch (error) {
    console.error('Error obteniendo insumos:', error);
    res.status(500).json({ error: 'Error al obtener insumos' });
  }
});

// Devuelve la lectura de sobra del turno anterior al indicado para un lote/fecha dados.
// turno=PM → busca AM del mismo día; turno=AM → busca PM del día anterior.
router.get('/lectura-anterior', async (req, res) => {
  try {
    const { lote_id, fecha, turno } = req.query;
    if (!lote_id || !fecha || !turno) {
      return res.json({ lectura: null });
    }

    let fechaBusqueda, turnoBusqueda;
    if (turno === 'PM') {
      fechaBusqueda = fecha;
      turnoBusqueda = 'AM';
    } else {
      const d = new Date(fecha + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      fechaBusqueda = d.toISOString().split('T')[0];
      turnoBusqueda = 'PM';
    }

    const [[row]] = await pool.query(
      `SELECT porcentaje_sobra FROM consumo_diario_lote
       WHERE lote_id = ? AND fecha = ? AND turno = ? AND porcentaje_sobra IS NOT NULL
       LIMIT 1`,
      [lote_id, fechaBusqueda, turnoBusqueda]
    );

    res.json({
      lectura: row ? parseFloat(row.porcentaje_sobra) : null,
      fecha: fechaBusqueda,
      turno: turnoBusqueda,
    });
  } catch (error) {
    console.error('Error obteniendo lectura anterior:', error);
    res.status(500).json({ error: 'Error al obtener lectura anterior' });
  }
});

router.post('/', duenoEncargado, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('tipo_insumo').notEmpty().withMessage('Tipo requerido'),
  body('categoria').optional(),
  body('unidad').notEmpty().withMessage('Unidad requerida'),
  body('capacidad_maxima').isFloat({ min: 0 }).withMessage('Capacidad maxima debe ser mayor a 0'),
  body('stock_minimo').isFloat({ min: 0 }).withMessage('Stock minimo debe ser mayor o igual a 0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_insumo, categoria, unidad, capacidad_maxima, stock_actual = 0, stock_minimo } = req.body;

    const [result] = await pool.query(
      'INSERT INTO insumos (tambo_id, nombre, tipo_insumo, categoria, unidad, capacidad_maxima, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.tambo_id, nombre, tipo_insumo, categoria || null, unidad, capacidad_maxima, stock_actual, stock_minimo]
    );

    await verificarYGenerarAlertas(result.insertId);

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'insumo_creado',
      descripcion: `Creó el insumo "${nombre}"`,
    });

    res.status(201).json({
      message: 'Insumo creado exitosamente',
      insumoId: result.insertId
    });
  } catch (error) {
    console.error('Error creando insumo:', error);
    res.status(500).json({ error: 'Error al crear insumo' });
  }
});

router.put('/:id', duenoEncargado, [
  body('nombre').optional().notEmpty(),
  body('tipo_insumo').optional().notEmpty(),
  body('categoria').optional(),
  body('unidad').optional().notEmpty(),
  body('capacidad_maxima').optional().isFloat({ min: 0 }),
  body('stock_minimo').optional().isFloat({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, tipo_insumo, categoria, unidad, capacidad_maxima, stock_minimo } = req.body;
    const updates = [];
    const values = [];

    if (nombre !== undefined) { updates.push('nombre = ?'); values.push(nombre); }
    if (tipo_insumo !== undefined) { updates.push('tipo_insumo = ?'); values.push(tipo_insumo); }
    if (categoria !== undefined) { updates.push('categoria = ?'); values.push(categoria); }
    if (unidad !== undefined) { updates.push('unidad = ?'); values.push(unidad); }
    if (capacidad_maxima !== undefined) { updates.push('capacidad_maxima = ?'); values.push(capacidad_maxima); }
    if (stock_minimo !== undefined) { updates.push('stock_minimo = ?'); values.push(stock_minimo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    values.push(req.params.id, req.user.tambo_id);
    await pool.query(`UPDATE insumos SET ${updates.join(', ')} WHERE id = ? AND tambo_id = ?`, values);

    const [[insumo]] = await pool.query('SELECT nombre FROM insumos WHERE id = ?', [req.params.id]);
    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'insumo_actualizado',
      descripcion: `Actualizó el insumo "${insumo?.nombre}"`,
    });

    res.json({ message: 'Insumo actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando insumo:', error);
    res.status(500).json({ error: 'Error al actualizar insumo' });
  }
});

router.post('/:id/cargar', duenoEncargado, [
  body('cantidad').isFloat({ min: 0 }).withMessage('Cantidad debe ser mayor a 0'),
  body('comprobante_entrega').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { cantidad, comprobante_entrega, observaciones } = req.body;
    const insumoId = req.params.id;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [insumos] = await connection.query('SELECT * FROM insumos WHERE id = ? AND tambo_id = ? FOR UPDATE', [insumoId, req.user.tambo_id]);

      if (insumos.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }

      const insumo = insumos[0];
      const stockAnterior = parseFloat(insumo.stock_actual);
      const nuevoStock = stockAnterior + parseFloat(cantidad);

      if (nuevoStock > parseFloat(insumo.capacidad_maxima)) {
        await connection.rollback();
        return res.status(400).json({
          error: `El stock excede la capacidad maxima (${insumo.capacidad_maxima} ${insumo.unidad})`
        });
      }

      await connection.query(
        'UPDATE insumos SET stock_actual = ? WHERE id = ?',
        [nuevoStock, insumoId]
      );

      await connection.query(
        'INSERT INTO historial_cargas_alimentos (tipo_alimento, insumo_id, usuario_id, cantidad, comprobante_entrega, fecha, hora, observaciones) VALUES (?, ?, ?, ?, ?, CURDATE(), CURTIME(), ?)',
        [insumo.tipo_insumo, insumoId, req.user.id, cantidad, comprobante_entrega || null, observaciones || null]
      );

      await connection.query(
        'INSERT INTO consumo_diario (insumo_id, usuario_id, cantidad, fecha, hora, tipo_movimiento, observaciones) VALUES (?, ?, ?, CURDATE(), CURTIME(), "ingreso", ?)',
        [insumoId, req.user.id, cantidad, observaciones || null]
      );

      await connection.query(
        'INSERT INTO movimientos_stock (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, comprobante_entrega, observaciones, fecha, hora) VALUES (?, ?, "ingreso", ?, ?, ?, ?, ?, CURDATE(), CURTIME())',
        [insumoId, req.user.id, cantidad, stockAnterior, nuevoStock, comprobante_entrega || null, observaciones || null]
      );

      await verificarYGenerarAlertas(insumoId, connection);

      await connection.commit();

      await logActividad(pool, {
        usuario_id: req.user.id,
        tambo_id: req.user.tambo_id,
        accion: 'carga_registrada',
        descripcion: `Cargó ${parseFloat(cantidad).toLocaleString('es-AR')} ${insumo.unidad} en "${insumo.nombre}"`,
      });

      res.json({
        message: 'Carga registrada exitosamente',
        nuevoStock,
        capacidadMaxima: insumo.capacidad_maxima,
        unidad: insumo.unidad
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error registrando carga:', error);
    res.status(500).json({ error: 'Error al registrar carga' });
  }
});

router.delete('/:id', duenoEncargado, async (req, res) => {
  try {
    const [[insumo]] = await pool.query('SELECT nombre FROM insumos WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    await pool.query('UPDATE insumos SET activo = FALSE WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);

    await logActividad(pool, {
      usuario_id: req.user.id,
      tambo_id: req.user.tambo_id,
      accion: 'insumo_desactivado',
      descripcion: `Desactivó el insumo "${insumo?.nombre}"`,
    });

    res.json({ message: 'Insumo desactivado exitosamente' });
  } catch (error) {
    console.error('Error desactivando insumo:', error);
    res.status(500).json({ error: 'Error al desactivar insumo' });
  }
});

// POST /consumo-diario
// Acepta ingredientes explícitos con cantidades reales (editadas por el trabajador).
// Usa lógica de diferencias: si el turno ya fue registrado, solo aplica el delta al stock.
// Esto elimina el doble descuento y permite correcciones sin descuadrar el stock.
router.post('/consumo-diario', async (req, res) => {
  try {
    const { fecha, turno, lote_id, cantidad_animales, ingredientes, observacion, porcentaje_sobra } = req.body;
    const sobraValor = (porcentaje_sobra !== null && porcentaje_sobra !== undefined && porcentaje_sobra !== '')
      ? parseFloat(porcentaje_sobra)
      : null;
    const fechaConsumo = fecha || new Date().toISOString().split('T')[0];
    const usuarioId = req.user?.id;
    const turnoValido = turno === 'PM' ? 'PM' : 'AM';

    if (!lote_id || !cantidad_animales || !Array.isArray(ingredientes) || ingredientes.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos: lote, animales e ingredientes son requeridos' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      await connection.query(
        `INSERT INTO registro_diario_animales (lote_id, fecha, cantidad_animales, usuario_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE cantidad_animales = ?, usuario_id = ?`,
        [lote_id, fechaConsumo, cantidad_animales, usuarioId, cantidad_animales, usuarioId]
      );

      for (const ing of ingredientes) {
        const insumoId = parseInt(ing.insumo_id);
        const cantidadNueva = parseFloat(ing.cantidad_kg) || 0;
        const obsIng = ing.observacion || observacion || null;

        // Buscar registro previo para (fecha, lote, insumo, turno)
        const [existente] = await connection.query(
          `SELECT id, cantidad_kg FROM consumo_diario_lote
           WHERE fecha = ? AND lote_id = ? AND insumo_id = ? AND turno = ?`,
          [fechaConsumo, lote_id, insumoId, turnoValido]
        );
        const cantidadAnterior = existente.length > 0 ? parseFloat(existente[0].cantidad_kg) : 0;
        const diferencia = cantidadNueva - cantidadAnterior;

        // Sin cambio real: no tocar stock ni movimientos
        if (diferencia === 0) continue;

        // Leer stock actual con lock
        const [insumoData] = await connection.query(
          `SELECT stock_actual, nombre FROM insumos WHERE id = ? AND tambo_id = ? FOR UPDATE`,
          [insumoId, req.user.tambo_id]
        );
        if (insumoData.length === 0) {
          await connection.rollback();
          return res.status(404).json({ error: `Insumo ID ${insumoId} no encontrado` });
        }

        const stockAnterior = parseFloat(insumoData[0].stock_actual);
        const nuevoStock = stockAnterior - diferencia; // diferencia negativa = devuelve stock

        if (nuevoStock < 0) {
          await connection.rollback();
          return res.status(400).json({
            error: `Stock insuficiente para "${insumoData[0].nombre}". Disponible: ${stockAnterior.toFixed(2)} kg, adicional requerido: ${diferencia.toFixed(2)} kg`
          });
        }

        await connection.query(`UPDATE insumos SET stock_actual = ? WHERE id = ?`, [nuevoStock, insumoId]);

        // Upsert o delete en consumo_diario_lote
        if (cantidadNueva > 0) {
          const kgPorAnimal = cantidadNueva / (parseInt(cantidad_animales) || 1);
          if (existente.length > 0) {
            await connection.query(
              `UPDATE consumo_diario_lote
               SET cantidad_kg = ?, cantidad_animales = ?, kg_por_animal = ?, usuario_id = ?, observaciones = ?,
                   porcentaje_sobra = COALESCE(?, porcentaje_sobra)
               WHERE id = ?`,
              [cantidadNueva, cantidad_animales, kgPorAnimal, usuarioId, obsIng, sobraValor, existente[0].id]
            );
          } else {
            await connection.query(
              `INSERT INTO consumo_diario_lote
               (tambo_id, fecha, lote_id, insumo_id, cantidad_kg, cantidad_animales, kg_por_animal, usuario_id, turno, observaciones, porcentaje_sobra)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [req.user.tambo_id, fechaConsumo, lote_id, insumoId, cantidadNueva, cantidad_animales, kgPorAnimal, usuarioId, turnoValido, obsIng, sobraValor]
            );
          }
        } else if (existente.length > 0) {
          // cantidad = 0 + había registro previo: eliminar y devolver stock
          await connection.query(`DELETE FROM consumo_diario_lote WHERE id = ?`, [existente[0].id]);
        }

        // Registro en movimientos_stock
        const esCorreccion = existente.length > 0;
        const tipo = diferencia > 0 ? 'consumo' : 'ajuste_positivo';
        const obsMovimiento = esCorreccion
          ? `Corrección ${turnoValido}${obsIng ? ': ' + obsIng : ''}`
          : `Consumo ${turnoValido}${obsIng ? ': ' + obsIng : ''}`;

        await connection.query(
          `INSERT INTO movimientos_stock
           (tambo_id, insumo_id, lote_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, turno, fecha, hora)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURTIME())`,
          [req.user.tambo_id, insumoId, lote_id, usuarioId, tipo, Math.abs(diferencia), stockAnterior, nuevoStock, obsMovimiento, turnoValido, fechaConsumo]
        );

        await verificarYGenerarAlertas(insumoId, connection);
      }

      await connection.commit();

      res.json({
        message: `Consumo ${turnoValido} registrado para ${fechaConsumo}`,
        fecha: fechaConsumo,
        turno: turnoValido,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error registrando consumo diario:', error);
    res.status(500).json({ error: 'Error al registrar consumo diario' });
  }
});

router.get('/resumen-diario', async (req, res) => {
  try {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];

    const [consumos] = await pool.query(
      `SELECT c.insumo_id, i.nombre as insumo_nombre, i.stock_actual, i.stock_minimo, i.capacidad_maxima,
              SUM(c.cantidad_kg) as consumo_total,
              COUNT(DISTINCT c.lote_id) as lotes_consumieron
       FROM consumo_diario_lote c
       JOIN insumos i ON c.insumo_id = i.id
       WHERE c.fecha = ? AND i.tambo_id = ?
       GROUP BY c.insumo_id, i.nombre, i.stock_actual, i.stock_minimo, i.capacidad_maxima`,
      [fecha, req.user.tambo_id]
    );

    const [registros] = await pool.query(
      `SELECT r.lote_id, l.nombre as lote_nombre, r.cantidad_animales, r.fecha
       FROM registro_diario_animales r
       JOIN lotes l ON r.lote_id = l.id
       WHERE r.fecha = ? AND l.tambo_id = ?
       ORDER BY l.nombre`,
      [fecha, req.user.tambo_id]
    );

    const consumoTotalDia = consumos.reduce((sum, c) => sum + parseFloat(c.consumo_total), 0);

    res.json({
      fecha,
      consumo_total_dia: consumoTotalDia,
      lotes_registrados: registros,
      insumos_consumidos: consumos.map(c => {
        const diasRestantes = parseFloat(c.consumo_total) > 0 ? Math.floor(parseFloat(c.stock_actual) / parseFloat(c.consumo_total)) : 999;
        const nivelAlerta = getNivelAlerta(diasRestantes);
        return {
          ...c,
          consumo_total: parseFloat(c.consumo_total),
          stock_actual: parseFloat(c.stock_actual),
          dias_restantes: diasRestantes,
          nivel_alerta: nivelAlerta.nivel,
          color_alerta: nivelAlerta.color,
          label_alerta: nivelAlerta.label,
        };
      }),
    });
  } catch (error) {
    console.error('Error obteniendo resumen diario:', error);
    res.status(500).json({ error: 'Error al obtener resumen diario' });
  }
});

router.get('/historial-consumo', async (req, res) => {
  try {
    const { fecha_desde, fecha_hasta, insumo_id, lote_id } = req.query;
    let query = `
      SELECT c.fecha, c.turno, c.lote_id, l.nombre as lote_nombre, c.insumo_id, i.nombre as insumo_nombre,
             c.cantidad_kg, c.cantidad_animales, c.kg_por_animal, c.porcentaje_sobra
      FROM consumo_diario_lote c
      JOIN lotes l ON c.lote_id = l.id
      JOIN insumos i ON c.insumo_id = i.id
      WHERE c.tambo_id = ?
    `;
    const params = [req.user.tambo_id];

    if (fecha_desde) { query += ' AND c.fecha >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { query += ' AND c.fecha <= ?'; params.push(fecha_hasta); }
    if (insumo_id) { query += ' AND c.insumo_id = ?'; params.push(insumo_id); }
    if (lote_id) { query += ' AND c.lote_id = ?'; params.push(lote_id); }

    query += ' ORDER BY c.fecha DESC, l.nombre, c.turno';

    const [historial] = await pool.query(query, params);
    res.json(historial);
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

router.post('/tipos', async (req, res) => {
  try {
    const { nombre, valor } = req.body;
    if (!nombre || !valor) {
      return res.status(400).json({ error: 'Nombre y valor son requeridos' });
    }
    res.json({ message: 'Tipo registrado', nombre, valor });
  } catch (error) {
    console.error('Error registrando tipo:', error);
    res.status(500).json({ error: 'Error al registrar tipo' });
  }
});

router.delete('/tipos/:valor', async (req, res) => {
  try {
    const { valor } = req.params;
    const tiposProtegidos = ['silo', 'bolson', 'fardo', 'sales'];
    
    if (tiposProtegidos.includes(valor)) {
      return res.status(400).json({ error: 'No se pueden eliminar los tipos originales' });
    }

    const [insumos] = await pool.query('SELECT COUNT(*) as count FROM insumos WHERE tipo_insumo = ? AND activo = TRUE', [valor]);
    if (insumos[0].count > 0) {
      return res.status(400).json({ error: `No se puede eliminar el tipo porque tiene ${insumos[0].count} insumos asociados` });
    }

    res.json({ message: 'Tipo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando tipo:', error);
    res.status(500).json({ error: 'Error al eliminar tipo' });
  }
});

router.get('/estado-alertas', async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = 'SELECT * FROM insumos WHERE activo = TRUE AND tambo_id = ?';
    const params = [req.user.tambo_id];

    if (tipo) {
      query += ' AND tipo_insumo = ?';
      params.push(tipo);
    }

    const [insumos] = await pool.query(query, params);

    const insumosConAlertas = await Promise.all(
      insumos.map(async (insumo) => {
        const estado = await calcularEstadoActual(insumo);
        const nivelAlerta = getNivelAlerta(estado.dias_restantes);
        return {
          ...insumo,
          ...estado,
          nivel_alerta: nivelAlerta.nivel,
          color_alerta: nivelAlerta.color,
          label_alerta: nivelAlerta.label,
        };
      })
    );

    insumosConAlertas.sort((a, b) => a.dias_restantes - b.dias_restantes);

    res.json({ insumos: insumosConAlertas });
  } catch (error) {
    console.error('Error obteniendo estado de alertas:', error);
    res.status(500).json({ error: 'Error al obtener estado de alertas' });
  }
});

// Debe quedar después de las rutas GET con paths literales (/estado-alertas, /resumen-diario, etc.)
// porque '/:id' las capturaría como si "estado-alertas" fuera un id.
router.get('/:id', async (req, res) => {
  try {
    const [insumos] = await pool.query('SELECT * FROM insumos WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);

    if (insumos.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

    res.json({ insumo: insumos[0] });
  } catch (error) {
    console.error('Error obteniendo insumo:', error);
    res.status(500).json({ error: 'Error al obtener insumo' });
  }
});

module.exports = router;
