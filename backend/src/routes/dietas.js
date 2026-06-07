const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const pool = require('../config/database');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [dietas] = await pool.query(`
      SELECT d.*, l.nombre as lote_nombre, l.cantidad_animales
      FROM dietas d
      JOIN lotes l ON d.lote_id = l.id
      WHERE d.activo = TRUE
      ORDER BY d.fecha_creacion DESC
    `);
    res.json(dietas);
  } catch (error) {
    console.error('Error al obtener dietas:', error);
    res.status(500).json({ error: 'Error al obtener las dietas' });
  }
});

router.post('/calcular', authenticateToken, [
  body('ingredientes').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
  body('produccion_leche_esperada').isFloat({ min: 0 }).withMessage('Produccion de leche invalida'),
  body('precio_leche_por_litro').isFloat({ min: 0 }).withMessage('Precio de leche invalido'),
  body('cantidad_animales').isInt({ min: 1 }).withMessage('Cantidad de animales invalida'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ingredientes, produccion_leche_esperada, precio_leche_por_litro, cantidad_animales } = req.body;

    let costoTotal = 0;
    let materiaSecaTotal = 0;
    let energiaTotal = 0;
    let proteinaTotal = 0;
    let fibraTotal = 0;
    let cantidadTotalKg = 0;
    const ingredientesCalculados = [];

    for (const ing of ingredientes) {
      const insumoId = parseInt(ing.insumo_id);
      const cantidadKg = parseFloat(ing.cantidad_kg) || 0;
      if (!insumoId || cantidadKg <= 0) continue;

      const [params] = await pool.query('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [insumoId]);
      const [costos] = await pool.query('SELECT precio_por_kg FROM costos_ingredientes WHERE insumo_id = ?', [insumoId]);
      const [insumos] = await pool.query('SELECT nombre, tipo_insumo FROM insumos WHERE id = ?', [insumoId]);

      const param = params[0] || { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };
      const precioPorKg = parseFloat(costos[0]?.precio_por_kg) || 0;
      const insumo = insumos[0] || { nombre: 'Desconocido', tipo_insumo: '' };

      const costoParcial = cantidadKg * precioPorKg;
      const msAportada = cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100);
      const energiaAportada = cantidadKg * parseFloat(param.energia_mcal_por_kg);
      const proteinaAportada = cantidadKg * (parseFloat(param.proteina_porcentaje) / 100);
      const fibraAportada = cantidadKg * (parseFloat(param.fibra_porcentaje) / 100);

      costoTotal += costoParcial;
      materiaSecaTotal += msAportada;
      energiaTotal += energiaAportada;
      proteinaTotal += proteinaAportada;
      fibraTotal += fibraAportada;
      cantidadTotalKg += cantidadKg;

      ingredientesCalculados.push({
        ...insumo,
        cantidad_kg: cantidadKg,
        precio_por_kg: precioPorKg,
        costo_parcial: costoParcial,
        materia_seca_aportada: msAportada,
        energia_aportada: energiaAportada,
        proteina_aportada: proteinaAportada,
        fibra_aportada: fibraAportada,
      });
    }

    if (cantidadTotalKg <= 0) {
      return res.status(400).json({ error: 'No hay ingredientes validos' });
    }

    const prodLeche = parseFloat(produccion_leche_esperada) || 0;
    const precioLeche = parseFloat(precio_leche_por_litro) || 0;
    const cantAnimales = parseInt(cantidad_animales) || 1;

    const costoPorVaca = costoTotal / cantAnimales;
    const costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
    const ingresoPorVaca = prodLeche * precioLeche;
    const margenAlimenticio = ingresoPorVaca - costoPorVaca;
    const margenPorLitro = prodLeche > 0 ? margenAlimenticio / prodLeche : 0;
    const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

    res.json({
      resumen: {
        costo_total: costoTotal,
        costo_por_vaca: costoPorVaca,
        costo_por_litro: costoPorLitro,
        ingreso_por_vaca: ingresoPorVaca,
        margen_alimenticio: margenAlimenticio,
        margen_por_litro: margenPorLitro,
        porcentaje_gasto_alimentacion: porcentajeGasto,
        materia_seca_total: materiaSecaTotal,
        energia_total: energiaTotal,
        proteina_total: proteinaTotal,
        fibra_total: fibraTotal,
      },
      ingredientes: ingredientesCalculados,
    });
  } catch (error) {
    console.error('Error al calcular dieta:', error);
    res.status(500).json({ error: 'Error al calcular la dieta' });
  }
});

router.get('/costos', authenticateToken, async (req, res) => {
  try {
    const [costos] = await pool.query(`
      SELECT ci.*, i.nombre as insumo_nombre, i.tipo_insumo
      FROM costos_ingredientes ci
      JOIN insumos i ON ci.insumo_id = i.id
      WHERE i.activo = TRUE
      ORDER BY i.nombre
    `);
    res.json(costos);
  } catch (error) {
    console.error('Error al obtener costos:', error);
    res.status(500).json({ error: 'Error al obtener los costos' });
  }
});

router.put('/costos/:insumoId', authenticateToken, [
  body('precio_por_kg').isFloat({ min: 0 }).withMessage('Precio invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { precio_por_kg } = req.body;
    const insumoId = req.params.insumoId;

    const [result] = await pool.query(
      `INSERT INTO costos_ingredientes (insumo_id, precio_por_kg) VALUES (?, ?) ON DUPLICATE KEY UPDATE precio_por_kg = ?, fecha_actualizacion = CURRENT_TIMESTAMP`,
      [insumoId, precio_por_kg, precio_por_kg]
    );

    res.json({ message: 'Costo actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar costo:', error);
    res.status(500).json({ error: 'Error al actualizar el costo' });
  }
});

router.get('/parametros/:insumoId', authenticateToken, async (req, res) => {
  try {
    const [parametros] = await pool.query('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [req.params.insumoId]);
    if (parametros.length === 0) {
      return res.json({ materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 });
    }
    res.json(parametros[0]);
  } catch (error) {
    console.error('Error al obtener parametros:', error);
    res.status(500).json({ error: 'Error al obtener los parametros nutricionales' });
  }
});

router.put('/parametros/:insumoId', authenticateToken, [
  body('materia_seca_porcentaje').isFloat({ min: 0, max: 100 }).withMessage('Materia seca invalida'),
  body('energia_mcal_por_kg').isFloat({ min: 0 }).withMessage('Energia invalida'),
  body('proteina_porcentaje').isFloat({ min: 0, max: 100 }).withMessage('Proteina invalida'),
  body('fibra_porcentaje').isFloat({ min: 0, max: 100 }).withMessage('Fibra invalida'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { materia_seca_porcentaje, energia_mcal_por_kg, proteina_porcentaje, fibra_porcentaje } = req.body;
    const insumoId = req.params.insumoId;

    await pool.query(
      `INSERT INTO parametros_nutricionales (insumo_id, materia_seca_porcentaje, energia_mcal_por_kg, proteina_porcentaje, fibra_porcentaje) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE materia_seca_porcentaje = ?, energia_mcal_por_kg = ?, proteina_porcentaje = ?, fibra_porcentaje = ?`,
      [insumoId, materia_seca_porcentaje, energia_mcal_por_kg, proteina_porcentaje, fibra_porcentaje, materia_seca_porcentaje, energia_mcal_por_kg, proteina_porcentaje, fibra_porcentaje]
    );

    res.json({ message: 'Parametros nutricionales actualizados exitosamente' });
  } catch (error) {
    console.error('Error al actualizar parametros:', error);
    res.status(500).json({ error: 'Error al actualizar los parametros nutricionales' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const dietaId = parseInt(req.params.id);
    if (!dietaId) {
      return res.status(400).json({ error: 'ID de dieta invalido' });
    }

    const [dietas] = await pool.query(`
      SELECT d.*, l.nombre as lote_nombre, l.cantidad_animales, l.tipo_animal
      FROM dietas d
      JOIN lotes l ON d.lote_id = l.id
      WHERE d.id = ? AND d.activo = TRUE
    `, [dietaId]);

    if (dietas.length === 0) {
      return res.status(404).json({ error: 'Dieta no encontrada' });
    }

    const [ingredientes] = await pool.query(`
      SELECT di.*, i.nombre as insumo_nombre, i.tipo_insumo, ci.precio_por_kg
      FROM dieta_ingredientes di
      JOIN insumos i ON di.insumo_id = i.id
      LEFT JOIN costos_ingredientes ci ON ci.insumo_id = i.id
      WHERE di.dieta_id = ?
    `, [dietaId]);

    const dieta = dietas[0];
    res.json({
      ...dieta,
      ingredientes: ingredientes.map(ing => ({
        ...ing,
        insumo_id: parseInt(ing.insumo_id),
        cantidad_kg: parseFloat(ing.cantidad_kg) || 0,
        porcentaje_dieta: parseFloat(ing.porcentaje_dieta) || 0,
        costo_parcial: parseFloat(ing.costo_parcial) || 0,
      })),
    });
  } catch (error) {
    console.error('Error al obtener dieta:', error);
    res.status(500).json({ error: 'Error al obtener la dieta' });
  }
});

router.post('/', authenticateToken, [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('lote_id').isInt().withMessage('El lote es requerido'),
  body('ingredientes').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
  body('produccion_leche_esperada').isFloat({ min: 0 }).withMessage('Produccion de leche invalida'),
  body('precio_leche_por_litro').isFloat({ min: 0 }).withMessage('Precio de leche invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, lote_id, ingredientes, produccion_leche_esperada, precio_leche_por_litro } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [lotes] = await connection.query('SELECT cantidad_animales FROM lotes WHERE id = ? AND activo = TRUE', [lote_id]);
      if (lotes.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Lote no encontrado' });
      }
      const cantidadAnimales = lotes[0].cantidad_animales;

      let costoTotal = 0;
      let materiaSecaTotal = 0;
      let energiaTotal = 0;
      let proteinaTotal = 0;
      let fibraTotal = 0;
      let cantidadTotalKg = 0;

      for (const ing of ingredientes) {
        const insumoId = parseInt(ing.insumo_id);
        const cantidadKg = parseFloat(ing.cantidad_kg) || 0;
        if (!insumoId || cantidadKg <= 0) continue;

        const [params] = await connection.query('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [insumoId]);
        const [costos] = await connection.query('SELECT precio_por_kg FROM costos_ingredientes WHERE insumo_id = ?', [insumoId]);

        const param = params[0] || { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };
        const precioPorKg = parseFloat(costos[0]?.precio_por_kg) || 0;

        const costoParcial = cantidadKg * precioPorKg;
        const msAportada = cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100);
        const energiaAportada = cantidadKg * parseFloat(param.energia_mcal_por_kg);
        const proteinaAportada = cantidadKg * (parseFloat(param.proteina_porcentaje) / 100);
        const fibraAportada = cantidadKg * (parseFloat(param.fibra_porcentaje) / 100);

        costoTotal += costoParcial;
        materiaSecaTotal += msAportada;
        energiaTotal += energiaAportada;
        proteinaTotal += proteinaAportada;
        fibraTotal += fibraAportada;
        cantidadTotalKg += cantidadKg;
      }

      if (cantidadTotalKg <= 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'No hay ingredientes validos' });
      }

      const prodLeche = parseFloat(produccion_leche_esperada) || 0;
      const precioLeche = parseFloat(precio_leche_por_litro) || 0;

      const costoPorVaca = costoTotal / cantidadAnimales;
      const costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
      const ingresoPorVaca = prodLeche * precioLeche;
      const margenAlimenticio = ingresoPorVaca - costoPorVaca;
      const margenPorLitro = prodLeche > 0 ? margenAlimenticio / prodLeche : 0;
      const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

      const [result] = await connection.query(
        `INSERT INTO dietas (nombre, lote_id, materia_seca_kg, energia_mcal, proteina_porcentaje, fibra_porcentaje, produccion_leche_esperada, precio_leche_por_litro, costo_total, costo_por_vaca, costo_por_litro, ingreso_por_vaca, margen_alimenticio, margen_por_litro, porcentaje_gasto_alimentacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nombre, lote_id, materiaSecaTotal, energiaTotal, proteinaTotal, fibraTotal, prodLeche, precioLeche, costoTotal, costoPorVaca, costoPorLitro, ingresoPorVaca, margenAlimenticio, margenPorLitro, porcentajeGasto]
      );

      const dietaId = result.insertId;

      for (const ing of ingredientes) {
        const insumoId = parseInt(ing.insumo_id);
        const cantidadKg = parseFloat(ing.cantidad_kg) || 0;
        if (!insumoId || cantidadKg <= 0) continue;

        const [params] = await connection.query('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [insumoId]);
        const [costos] = await connection.query('SELECT precio_por_kg FROM costos_ingredientes WHERE insumo_id = ?', [insumoId]);

        const param = params[0] || { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };
        const precioPorKg = parseFloat(costos[0]?.precio_por_kg) || 0;

        const costoParcial = cantidadKg * precioPorKg;
        const porcentajeDieta = (cantidadKg / cantidadTotalKg) * 100;

        await connection.query(
          `INSERT INTO dieta_ingredientes (dieta_id, insumo_id, cantidad_kg, porcentaje_dieta, costo_parcial, materia_seca_aportada, energia_aportada, proteina_aportada, fibra_aportada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dietaId, insumoId, cantidadKg, porcentajeDieta, costoParcial, cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100), cantidadKg * parseFloat(param.energia_mcal_por_kg), cantidadKg * (parseFloat(param.proteina_porcentaje) / 100), cantidadKg * (parseFloat(param.fibra_porcentaje) / 100)]
        );
      }

      await connection.commit();
      res.status(201).json({ id: dietaId, message: 'Dieta creada exitosamente' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error al crear dieta:', error);
    res.status(500).json({ error: 'Error al crear la dieta' });
  }
});

router.put('/:id', authenticateToken, [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('lote_id').isInt().withMessage('El lote es requerido'),
  body('ingredientes').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
  body('produccion_leche_esperada').isFloat({ min: 0 }).withMessage('Produccion de leche invalida'),
  body('precio_leche_por_litro').isFloat({ min: 0 }).withMessage('Precio de leche invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, lote_id, ingredientes, produccion_leche_esperada, precio_leche_por_litro } = req.body;
    const dietaId = parseInt(req.params.id);
    if (!dietaId) {
      return res.status(400).json({ error: 'ID de dieta invalido' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [dietas] = await connection.query('SELECT id FROM dietas WHERE id = ? AND activo = TRUE', [dietaId]);
      if (dietas.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Dieta no encontrada' });
      }

      const [lotes] = await connection.query('SELECT cantidad_animales FROM lotes WHERE id = ? AND activo = TRUE', [lote_id]);
      if (lotes.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Lote no encontrado' });
      }
      const cantidadAnimales = lotes[0].cantidad_animales;

      await connection.query('DELETE FROM dieta_ingredientes WHERE dieta_id = ?', [dietaId]);

      let costoTotal = 0;
      let materiaSecaTotal = 0;
      let energiaTotal = 0;
      let proteinaTotal = 0;
      let fibraTotal = 0;
      let cantidadTotalKg = 0;

      for (const ing of ingredientes) {
        const insumoId = parseInt(ing.insumo_id);
        const cantidadKg = parseFloat(ing.cantidad_kg) || 0;
        if (!insumoId || cantidadKg <= 0) continue;

        const [params] = await connection.query('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [insumoId]);
        const [costos] = await connection.query('SELECT precio_por_kg FROM costos_ingredientes WHERE insumo_id = ?', [insumoId]);

        const param = params[0] || { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };
        const precioPorKg = parseFloat(costos[0]?.precio_por_kg) || 0;

        const costoParcial = cantidadKg * precioPorKg;
        costoTotal += costoParcial;
        materiaSecaTotal += cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100);
        energiaTotal += cantidadKg * parseFloat(param.energia_mcal_por_kg);
        proteinaTotal += cantidadKg * (parseFloat(param.proteina_porcentaje) / 100);
        fibraTotal += cantidadKg * (parseFloat(param.fibra_porcentaje) / 100);
        cantidadTotalKg += cantidadKg;
      }

      if (cantidadTotalKg <= 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'No hay ingredientes validos' });
      }

      const prodLeche = parseFloat(produccion_leche_esperada) || 0;
      const precioLeche = parseFloat(precio_leche_por_litro) || 0;

      const costoPorVaca = costoTotal / cantidadAnimales;
      const costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
      const ingresoPorVaca = prodLeche * precioLeche;
      const margenAlimenticio = ingresoPorVaca - costoPorVaca;
      const margenPorLitro = prodLeche > 0 ? margenAlimenticio / prodLeche : 0;
      const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

      await connection.query(
        `UPDATE dietas SET nombre = ?, lote_id = ?, materia_seca_kg = ?, energia_mcal = ?, proteina_porcentaje = ?, fibra_porcentaje = ?, produccion_leche_esperada = ?, precio_leche_por_litro = ?, costo_total = ?, costo_por_vaca = ?, costo_por_litro = ?, ingreso_por_vaca = ?, margen_alimenticio = ?, margen_por_litro = ?, porcentaje_gasto_alimentacion = ? WHERE id = ?`,
        [nombre, lote_id, materiaSecaTotal, energiaTotal, proteinaTotal, fibraTotal, prodLeche, precioLeche, costoTotal, costoPorVaca, costoPorLitro, ingresoPorVaca, margenAlimenticio, margenPorLitro, porcentajeGasto, dietaId]
      );

      for (const ing of ingredientes) {
        const insumoId = parseInt(ing.insumo_id);
        const cantidadKg = parseFloat(ing.cantidad_kg) || 0;
        if (!insumoId || cantidadKg <= 0) continue;

        const [params] = await connection.query('SELECT * FROM parametros_nutricionales WHERE insumo_id = ?', [insumoId]);
        const [costos] = await connection.query('SELECT precio_por_kg FROM costos_ingredientes WHERE insumo_id = ?', [insumoId]);

        const param = params[0] || { materia_seca_porcentaje: 0, energia_mcal_por_kg: 0, proteina_porcentaje: 0, fibra_porcentaje: 0 };
        const precioPorKg = parseFloat(costos[0]?.precio_por_kg) || 0;

        const costoParcial = cantidadKg * precioPorKg;
        const porcentajeDieta = (cantidadKg / cantidadTotalKg) * 100;

        await connection.query(
          `INSERT INTO dieta_ingredientes (dieta_id, insumo_id, cantidad_kg, porcentaje_dieta, costo_parcial, materia_seca_aportada, energia_aportada, proteina_aportada, fibra_aportada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dietaId, insumoId, cantidadKg, porcentajeDieta, costoParcial, cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100), cantidadKg * parseFloat(param.energia_mcal_por_kg), cantidadKg * (parseFloat(param.proteina_porcentaje) / 100), cantidadKg * (parseFloat(param.fibra_porcentaje) / 100)]
        );
      }

      await connection.commit();
      res.json({ message: 'Dieta actualizada exitosamente' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error al actualizar dieta:', error);
    res.status(500).json({ error: 'Error al actualizar la dieta' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE dietas SET activo = FALSE WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dieta no encontrada' });
    }
    res.json({ message: 'Dieta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar dieta:', error);
    res.status(500).json({ error: 'Error al eliminar la dieta' });
  }
});

module.exports = router;
