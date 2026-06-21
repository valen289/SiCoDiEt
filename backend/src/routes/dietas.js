const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const pool = require('../config/database');
const { verificarYGenerarAlertas } = require('../utils/alertas');

router.get('/', authenticateToken, authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    const [dietas] = await pool.query(`
      SELECT d.*, l.nombre as lote_nombre, l.cantidad_animales, l.tipo_animal, l.objetivo_productivo
      FROM dietas d
      JOIN lotes l ON d.lote_id = l.id
      WHERE d.activo = TRUE AND d.tambo_id = ?
      ORDER BY d.fecha_creacion DESC
    `, [req.user.tambo_id]);
    res.json(dietas);
  } catch (error) {
    console.error('Error al obtener dietas:', error);
    res.status(500).json({ error: 'Error al obtener las dietas' });
  }
});

router.post('/calcular', authenticateToken, authorizeRoles('dueno', 'encargado'), [
  body('ingredientes').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
  body('lote_id').isInt().withMessage('El lote es requerido'),
  body('produccion_leche_esperada').optional().isFloat({ min: 0 }).withMessage('Produccion de leche invalida'),
  body('precio_leche_por_litro').optional().isFloat({ min: 0 }).withMessage('Precio de leche invalido'),
  body('ganancia_kg_esperada').optional().isFloat({ min: 0 }).withMessage('Ganancia de kg invalida'),
  body('precio_kg_en_pie').optional().isFloat({ min: 0 }).withMessage('Precio por kg invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ingredientes, lote_id, produccion_leche_esperada, precio_leche_por_litro, ganancia_kg_esperada, precio_kg_en_pie } = req.body;

    const [lotes] = await pool.query('SELECT cantidad_animales, objetivo_productivo FROM lotes WHERE id = ? AND activo = TRUE AND tambo_id = ?', [lote_id, req.user.tambo_id]);
    if (lotes.length === 0) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    const { cantidad_animales: cantidadAnimalesLote, objetivo_productivo } = lotes[0];

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

    const cantAnimales = parseInt(cantidadAnimalesLote) || 1;
    const costoPorVaca = costoTotal / cantAnimales;

    let costoPorLitro = 0, margenPorLitro = 0, costoPorKgGanado = 0, margenPorKgGanado = 0;
    let ingresoPorVaca = 0;

    if (objetivo_productivo === 'leche') {
      const prodLeche = parseFloat(produccion_leche_esperada) || 0;
      const precioLeche = parseFloat(precio_leche_por_litro) || 0;
      ingresoPorVaca = prodLeche * precioLeche;
      costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
      margenPorLitro = prodLeche > 0 ? (ingresoPorVaca - costoPorVaca) / prodLeche : 0;
    } else {
      const gananciaKg = parseFloat(ganancia_kg_esperada) || 0;
      const precioKg = parseFloat(precio_kg_en_pie) || 0;
      ingresoPorVaca = gananciaKg * precioKg;
      costoPorKgGanado = gananciaKg > 0 ? costoPorVaca / gananciaKg : 0;
      margenPorKgGanado = gananciaKg > 0 ? (ingresoPorVaca - costoPorVaca) / gananciaKg : 0;
    }

    const margenAlimenticio = ingresoPorVaca - costoPorVaca;
    const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

    res.json({
      resumen: {
        objetivo_productivo,
        costo_total: costoTotal,
        costo_por_vaca: costoPorVaca,
        costo_por_litro: costoPorLitro,
        ingreso_por_vaca: ingresoPorVaca,
        margen_alimenticio: margenAlimenticio,
        margen_por_litro: margenPorLitro,
        costo_por_kg_ganado: costoPorKgGanado,
        margen_por_kg_ganado: margenPorKgGanado,
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

router.get('/costos', authenticateToken, authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    const [costos] = await pool.query(`
      SELECT ci.*, i.nombre as insumo_nombre, i.tipo_insumo
      FROM costos_ingredientes ci
      JOIN insumos i ON ci.insumo_id = i.id
      WHERE i.activo = TRUE AND i.tambo_id = ?
      ORDER BY i.nombre
    `, [req.user.tambo_id]);
    res.json(costos);
  } catch (error) {
    console.error('Error al obtener costos:', error);
    res.status(500).json({ error: 'Error al obtener los costos' });
  }
});

router.put('/costos/:insumoId', authenticateToken, authorizeRoles('dueno', 'encargado'), [
  body('precio_por_kg').isFloat({ min: 0 }).withMessage('Precio invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { precio_por_kg } = req.body;
    const insumoId = req.params.insumoId;

    const [insumos] = await pool.query('SELECT id FROM insumos WHERE id = ? AND tambo_id = ?', [insumoId, req.user.tambo_id]);
    if (insumos.length === 0) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }

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

router.get('/parametros/:insumoId', authenticateToken, authorizeRoles('dueno', 'encargado'), async (req, res) => {
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

router.put('/parametros/:insumoId', authenticateToken, authorizeRoles('dueno', 'encargado'), [
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

router.get('/:id', authenticateToken, authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    const dietaId = parseInt(req.params.id);
    if (!dietaId) {
      return res.status(400).json({ error: 'ID de dieta invalido' });
    }

    const [dietas] = await pool.query(`
      SELECT d.*, l.nombre as lote_nombre, l.cantidad_animales, l.tipo_animal, l.objetivo_productivo
      FROM dietas d
      JOIN lotes l ON d.lote_id = l.id
      WHERE d.id = ? AND d.activo = TRUE AND d.tambo_id = ?
    `, [dietaId, req.user.tambo_id]);

    if (dietas.length === 0) {
      return res.status(404).json({ error: 'Dieta no encontrada' });
    }

    const [ingredientes] = await pool.query(`
      SELECT di.*, i.nombre as insumo_nombre, i.tipo_insumo, ci.precio_por_kg,
             di.porcentaje_am
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
        porcentaje_am: parseFloat(ing.porcentaje_am ?? 50),
      })),
    });
  } catch (error) {
    console.error('Error al obtener dieta:', error);
    res.status(500).json({ error: 'Error al obtener la dieta' });
  }
});

router.post('/', authenticateToken, authorizeRoles('dueno', 'encargado'), [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('lote_id').isInt().withMessage('El lote es requerido'),
  body('ingredientes').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
  body('produccion_leche_esperada').optional().isFloat({ min: 0 }).withMessage('Produccion de leche invalida'),
  body('precio_leche_por_litro').optional().isFloat({ min: 0 }).withMessage('Precio de leche invalido'),
  body('ganancia_kg_esperada').optional().isFloat({ min: 0 }).withMessage('Ganancia de kg invalida'),
  body('precio_kg_en_pie').optional().isFloat({ min: 0 }).withMessage('Precio por kg invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, lote_id, ingredientes, produccion_leche_esperada, precio_leche_por_litro, ganancia_kg_esperada, precio_kg_en_pie } = req.body;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [lotes] = await connection.query('SELECT cantidad_animales, objetivo_productivo FROM lotes WHERE id = ? AND activo = TRUE AND tambo_id = ?', [lote_id, req.user.tambo_id]);
      if (lotes.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Lote no encontrado' });
      }
      const cantidadAnimales = lotes[0].cantidad_animales;
      const objetivoProductivo = lotes[0].objetivo_productivo;

      if (objetivoProductivo === 'leche') {
        if (produccion_leche_esperada === undefined || precio_leche_por_litro === undefined) {
          await connection.rollback();
          return res.status(400).json({ error: 'Produccion y precio de leche requeridos para un lote lechero' });
        }
      } else {
        if (ganancia_kg_esperada === undefined || precio_kg_en_pie === undefined) {
          await connection.rollback();
          return res.status(400).json({ error: 'Ganancia de kg y precio por kg requeridos para un lote de engorde' });
        }
      }

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

      const costoPorVaca = costoTotal / cantidadAnimales;
      let prodLeche = 0, precioLeche = 0, costoPorLitro = 0, margenPorLitro = 0;
      let gananciaKg = 0, precioKg = 0, costoPorKgGanado = 0, margenPorKgGanado = 0;
      let ingresoPorVaca = 0;

      if (objetivoProductivo === 'leche') {
        prodLeche = parseFloat(produccion_leche_esperada) || 0;
        precioLeche = parseFloat(precio_leche_por_litro) || 0;
        ingresoPorVaca = prodLeche * precioLeche;
        costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
        margenPorLitro = prodLeche > 0 ? (ingresoPorVaca - costoPorVaca) / prodLeche : 0;
      } else {
        gananciaKg = parseFloat(ganancia_kg_esperada) || 0;
        precioKg = parseFloat(precio_kg_en_pie) || 0;
        ingresoPorVaca = gananciaKg * precioKg;
        costoPorKgGanado = gananciaKg > 0 ? costoPorVaca / gananciaKg : 0;
        margenPorKgGanado = gananciaKg > 0 ? (ingresoPorVaca - costoPorVaca) / gananciaKg : 0;
      }

      const margenAlimenticio = ingresoPorVaca - costoPorVaca;
      const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

      const [result] = await connection.query(
        `INSERT INTO dietas (tambo_id, nombre, lote_id, materia_seca_kg, energia_mcal, proteina_porcentaje, fibra_porcentaje, produccion_leche_esperada, precio_leche_por_litro, costo_total, costo_por_vaca, costo_por_litro, ingreso_por_vaca, margen_alimenticio, margen_por_litro, porcentaje_gasto_alimentacion, ganancia_kg_esperada, precio_kg_en_pie, costo_por_kg_ganado, margen_por_kg_ganado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.user.tambo_id, nombre, lote_id, materiaSecaTotal, energiaTotal, proteinaTotal, fibraTotal, prodLeche, precioLeche, costoTotal, costoPorVaca, costoPorLitro, ingresoPorVaca, margenAlimenticio, margenPorLitro, porcentajeGasto, gananciaKg, precioKg, costoPorKgGanado, margenPorKgGanado]
      );

      const dietaId = result.insertId;
      const insumoIdsAfectados = new Set();

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
        const porcentajeAm = Math.min(100, Math.max(0, parseFloat(ing.porcentaje_am ?? 50)));

        await connection.query(
          `INSERT INTO dieta_ingredientes (dieta_id, insumo_id, cantidad_kg, porcentaje_dieta, costo_parcial, materia_seca_aportada, energia_aportada, proteina_aportada, fibra_aportada, porcentaje_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dietaId, insumoId, cantidadKg, porcentajeDieta, costoParcial, cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100), cantidadKg * parseFloat(param.energia_mcal_por_kg), cantidadKg * (parseFloat(param.proteina_porcentaje) / 100), cantidadKg * (parseFloat(param.fibra_porcentaje) / 100), porcentajeAm]
        );
        insumoIdsAfectados.add(insumoId);
      }

      await connection.commit();

      for (const insumoId of insumoIdsAfectados) {
        await verificarYGenerarAlertas(insumoId);
      }

      res.status(201).json({ id: dietaId, message: 'Dieta creada exitosamente' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error al crear dieta:', error.message, error.code);
    res.status(500).json({ error: 'Error al crear la dieta: ' + error.message });
  }
});

router.put('/:id', authenticateToken, authorizeRoles('dueno', 'encargado'), [
  body('nombre').notEmpty().withMessage('El nombre es requerido'),
  body('lote_id').isInt().withMessage('El lote es requerido'),
  body('ingredientes').isArray({ min: 1 }).withMessage('Debe incluir al menos un ingrediente'),
  body('produccion_leche_esperada').optional().isFloat({ min: 0 }).withMessage('Produccion de leche invalida'),
  body('precio_leche_por_litro').optional().isFloat({ min: 0 }).withMessage('Precio de leche invalido'),
  body('ganancia_kg_esperada').optional().isFloat({ min: 0 }).withMessage('Ganancia de kg invalida'),
  body('precio_kg_en_pie').optional().isFloat({ min: 0 }).withMessage('Precio por kg invalido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nombre, lote_id, ingredientes, produccion_leche_esperada, precio_leche_por_litro, ganancia_kg_esperada, precio_kg_en_pie } = req.body;
    const dietaId = parseInt(req.params.id);
    if (!dietaId) {
      return res.status(400).json({ error: 'ID de dieta invalido' });
    }

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const [dietas] = await connection.query('SELECT id FROM dietas WHERE id = ? AND activo = TRUE AND tambo_id = ?', [dietaId, req.user.tambo_id]);
      if (dietas.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Dieta no encontrada' });
      }

      const [lotes] = await connection.query('SELECT cantidad_animales, objetivo_productivo FROM lotes WHERE id = ? AND activo = TRUE AND tambo_id = ?', [lote_id, req.user.tambo_id]);
      if (lotes.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Lote no encontrado' });
      }
      const cantidadAnimales = lotes[0].cantidad_animales;
      const objetivoProductivo = lotes[0].objetivo_productivo;

      if (objetivoProductivo === 'leche') {
        if (produccion_leche_esperada === undefined || precio_leche_por_litro === undefined) {
          await connection.rollback();
          return res.status(400).json({ error: 'Produccion y precio de leche requeridos para un lote lechero' });
        }
      } else {
        if (ganancia_kg_esperada === undefined || precio_kg_en_pie === undefined) {
          await connection.rollback();
          return res.status(400).json({ error: 'Ganancia de kg y precio por kg requeridos para un lote de engorde' });
        }
      }

      const [ingredientesPrevios] = await connection.query('SELECT insumo_id FROM dieta_ingredientes WHERE dieta_id = ?', [dietaId]);
      const insumoIdsAfectados = new Set(ingredientesPrevios.map(i => i.insumo_id));

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

      const costoPorVaca = costoTotal / cantidadAnimales;
      let prodLeche = 0, precioLeche = 0, costoPorLitro = 0, margenPorLitro = 0;
      let gananciaKg = 0, precioKg = 0, costoPorKgGanado = 0, margenPorKgGanado = 0;
      let ingresoPorVaca = 0;

      if (objetivoProductivo === 'leche') {
        prodLeche = parseFloat(produccion_leche_esperada) || 0;
        precioLeche = parseFloat(precio_leche_por_litro) || 0;
        ingresoPorVaca = prodLeche * precioLeche;
        costoPorLitro = prodLeche > 0 ? costoPorVaca / prodLeche : 0;
        margenPorLitro = prodLeche > 0 ? (ingresoPorVaca - costoPorVaca) / prodLeche : 0;
      } else {
        gananciaKg = parseFloat(ganancia_kg_esperada) || 0;
        precioKg = parseFloat(precio_kg_en_pie) || 0;
        ingresoPorVaca = gananciaKg * precioKg;
        costoPorKgGanado = gananciaKg > 0 ? costoPorVaca / gananciaKg : 0;
        margenPorKgGanado = gananciaKg > 0 ? (ingresoPorVaca - costoPorVaca) / gananciaKg : 0;
      }

      const margenAlimenticio = ingresoPorVaca - costoPorVaca;
      const porcentajeGasto = ingresoPorVaca > 0 ? (costoPorVaca / ingresoPorVaca) * 100 : 0;

      await connection.query(
        `UPDATE dietas SET nombre = ?, lote_id = ?, materia_seca_kg = ?, energia_mcal = ?, proteina_porcentaje = ?, fibra_porcentaje = ?, produccion_leche_esperada = ?, precio_leche_por_litro = ?, costo_total = ?, costo_por_vaca = ?, costo_por_litro = ?, ingreso_por_vaca = ?, margen_alimenticio = ?, margen_por_litro = ?, porcentaje_gasto_alimentacion = ?, ganancia_kg_esperada = ?, precio_kg_en_pie = ?, costo_por_kg_ganado = ?, margen_por_kg_ganado = ? WHERE id = ?`,
        [nombre, lote_id, materiaSecaTotal, energiaTotal, proteinaTotal, fibraTotal, prodLeche, precioLeche, costoTotal, costoPorVaca, costoPorLitro, ingresoPorVaca, margenAlimenticio, margenPorLitro, porcentajeGasto, gananciaKg, precioKg, costoPorKgGanado, margenPorKgGanado, dietaId]
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
        const porcentajeAm = Math.min(100, Math.max(0, parseFloat(ing.porcentaje_am ?? 50)));

        await connection.query(
          `INSERT INTO dieta_ingredientes (dieta_id, insumo_id, cantidad_kg, porcentaje_dieta, costo_parcial, materia_seca_aportada, energia_aportada, proteina_aportada, fibra_aportada, porcentaje_am) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [dietaId, insumoId, cantidadKg, porcentajeDieta, costoParcial, cantidadKg * (parseFloat(param.materia_seca_porcentaje) / 100), cantidadKg * parseFloat(param.energia_mcal_por_kg), cantidadKg * (parseFloat(param.proteina_porcentaje) / 100), cantidadKg * (parseFloat(param.fibra_porcentaje) / 100), porcentajeAm]
        );
        insumoIdsAfectados.add(insumoId);
      }

      await connection.commit();

      for (const insumoId of insumoIdsAfectados) {
        await verificarYGenerarAlertas(insumoId);
      }

      res.json({ message: 'Dieta actualizada exitosamente' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error al actualizar dieta:', error.message, error.code);
    res.status(500).json({ error: 'Error al actualizar la dieta: ' + error.message });
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('dueno', 'encargado'), async (req, res) => {
  try {
    const [ingredientes] = await pool.query('SELECT insumo_id FROM dieta_ingredientes WHERE dieta_id = ?', [req.params.id]);

    const [result] = await pool.query('UPDATE dietas SET activo = FALSE WHERE id = ? AND tambo_id = ?', [req.params.id, req.user.tambo_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Dieta no encontrada' });
    }

    for (const insumoId of new Set(ingredientes.map(i => i.insumo_id))) {
      await verificarYGenerarAlertas(insumoId);
    }

    res.json({ message: 'Dieta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar dieta:', error);
    res.status(500).json({ error: 'Error al eliminar la dieta' });
  }
});

module.exports = router;
