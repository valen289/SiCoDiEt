const pool = require('../config/database');
const { sendStockCriticoEmail } = require('./email');

async function obtenerDestinatariosAlerta(tamboId, executor) {
  const [usuarios] = await executor(
    "SELECT email FROM usuarios WHERE tambo_id = ? AND rol IN ('dueno', 'encargado') AND activo = TRUE AND email IS NOT NULL",
    [tamboId]
  );
  return usuarios.map((u) => u.email);
}

async function calcularConsumoEstimado(insumoId, executor = (sql, params) => pool.query(sql, params)) {
  try {
    const [consumo3d] = await executor(
      `SELECT COALESCE(SUM(cantidad_kg), 0) as total, COUNT(DISTINCT fecha) as dias
       FROM consumo_diario_lote
       WHERE insumo_id = ? AND fecha >= CURDATE() - INTERVAL 3 DAY`,
      [insumoId]
    );

    const [consumo7d] = await executor(
      `SELECT COALESCE(SUM(cantidad_kg), 0) as total, COUNT(DISTINCT fecha) as dias
       FROM consumo_diario_lote
       WHERE insumo_id = ? AND fecha >= CURDATE() - INTERVAL 7 DAY`,
      [insumoId]
    );

    const [consumo30d] = await executor(
      `SELECT COALESCE(SUM(cantidad_kg), 0) as total, COUNT(DISTINCT fecha) as dias
       FROM consumo_diario_lote
       WHERE insumo_id = ? AND fecha >= CURDATE() - INTERVAL 30 DAY`,
      [insumoId]
    );

    // Se divide por la cantidad real de dias con registros dentro de la ventana (con tope
    // en el tamaño de la ventana), no por el tamaño fijo: con poco historial (tambo nuevo),
    // dividir por el tamaño fijo aplasta artificialmente la tasa diaria estimada. A medida que
    // se acumulan dias con datos, esto converge al comportamiento de diluir picos aislados.
    const avg3d = consumo3d[0].dias > 0 ? consumo3d[0].total / Math.min(consumo3d[0].dias, 3) : 0;
    const avg7d = consumo7d[0].dias > 0 ? consumo7d[0].total / Math.min(consumo7d[0].dias, 7) : 0;
    const avg30d = consumo30d[0].dias > 0 ? consumo30d[0].total / Math.min(consumo30d[0].dias, 30) : 0;

    let consumoEstimado = 0;
    if (avg3d > 0 && avg7d > 0 && avg30d > 0) {
      consumoEstimado = (avg3d * 0.5) + (avg7d * 0.3) + (avg30d * 0.2);
    } else if (avg3d > 0 && avg7d > 0) {
      consumoEstimado = (avg3d * 0.6) + (avg7d * 0.4);
    } else if (avg3d > 0) {
      consumoEstimado = avg3d;
    } else if (avg7d > 0) {
      consumoEstimado = avg7d;
    } else if (avg30d > 0) {
      consumoEstimado = avg30d;
    }

    return consumoEstimado;
  } catch (error) {
    console.error('Error calculando consumo estimado:', error);
    return 0;
  }
}

// Estima el consumo diario a partir de las dietas activas que formulan este insumo,
// para lotes que todavia no tienen historial real en consumo_diario_lote.
// Por cada lote, usa la dieta activa mas reciente que lo formule (evita sumar duplicado
// si hubiera mas de una dieta activa para el mismo lote).
async function calcularConsumoFormulado(insumoId, executor = (sql, params) => pool.query(sql, params)) {
  try {
    const [filas] = await executor(
      `SELECT di.cantidad_kg, l.cantidad_animales
       FROM dieta_ingredientes di
       JOIN dietas d ON d.id = di.dieta_id
       JOIN lotes l ON l.id = d.lote_id
       WHERE di.insumo_id = ? AND d.activo = TRUE AND l.activo = TRUE
         AND d.id = (
           SELECT MAX(d2.id) FROM dietas d2
           WHERE d2.lote_id = d.lote_id AND d2.activo = TRUE
         )`,
      [insumoId]
    );

    return filas.reduce((total, f) => total + (parseFloat(f.cantidad_kg) * parseInt(f.cantidad_animales)), 0);
  } catch (error) {
    console.error('Error calculando consumo formulado:', error);
    return 0;
  }
}

// Usa el mayor entre el consumo historico real (consumo_diario_lote) y el formulado en la
// dieta activa. Subestimar el consumo es el error caro en un sistema de alertas de stock
// (te quedas sin alimento sin aviso), asi que nunca se reporta menos de lo que la dieta activa
// ya garantiza. Si el historico (con suficientes dias de datos) supera al formulado -- por
// desperdicio/sobras, por ejemplo -- se usa ese, ya que es el mas conservador en ese caso.
// Devuelve { consumo, origen } para que se pueda mostrar de donde viene la estimacion.
async function calcularConsumoConOrigen(insumoId, executor) {
  const consumoHistorico = await calcularConsumoEstimado(insumoId, executor);
  const consumoFormulado = await calcularConsumoFormulado(insumoId, executor);

  if (consumoHistorico === 0 && consumoFormulado === 0) {
    return { consumo: 0, origen: 'sin_datos' };
  }

  return consumoHistorico >= consumoFormulado
    ? { consumo: consumoHistorico, origen: 'historico' }
    : { consumo: consumoFormulado, origen: 'formulado' };
}

async function calcularDiasRestantes(stockActual, consumoEstimado) {
  if (!consumoEstimado || consumoEstimado <= 0) return 999;
  return Math.floor(stockActual / consumoEstimado);
}

// Recalcula dias_restantes/consumo_promedio_diario/origen "al vuelo" para mostrar,
// sin el efecto secundario de insertar alertas ni mandar emails (eso lo sigue haciendo
// solo verificarYGenerarAlertas). Evita que lo que se muestra dependa de que la columna
// cacheada en `insumos` haya sido recalculada correctamente en el ultimo evento que la toco.
async function calcularEstadoActual(insumo, executor = (sql, params) => pool.query(sql, params)) {
  const stockActual = parseFloat(insumo.stock_actual);
  const { consumo, origen } = await calcularConsumoConOrigen(insumo.id, executor);
  const diasRestantes = await calcularDiasRestantes(stockActual, consumo);
  return { dias_restantes: diasRestantes, consumo_promedio_diario: consumo, dias_restantes_origen: origen };
}

function getNivelAlerta(diasRestantes) {
  if (diasRestantes <= 5) return { nivel: 'critico', tipo: 'stock_critico', color: '#dc3545', label: 'CRITICO', mensaje: 'dias restantes' };
  if (diasRestantes <= 7) return { nivel: 'precaucion', tipo: 'stock_bajo', color: '#ffc107', label: 'PRECAUCION', mensaje: 'dias restantes' };
  if (diasRestantes <= 20) return { nivel: 'normal', tipo: null, color: '#28a745', label: 'NORMAL', mensaje: 'dias restantes' };
  return { nivel: 'holgado', tipo: null, color: '#17a2b8', label: 'HOLGADO', mensaje: 'dias restantes' };
}

async function verificarYGenerarAlertas(insumoId, connection) {
  try {
    const query = connection ? connection.query.bind(connection) : pool.query.bind(pool);
    const executor = connection
      ? (sql, params) => connection.query(sql, params)
      : (sql, params) => pool.query(sql, params);

    const [insumos] = await executor('SELECT * FROM insumos WHERE id = ?', [insumoId]);
    if (insumos.length === 0) return null;

    const insumo = insumos[0];
    const stockActual = parseFloat(insumo.stock_actual);

    const { consumo: consumoPromedioDiario, origen } = await calcularConsumoConOrigen(insumoId, executor);

    const diasRestantes = await calcularDiasRestantes(stockActual, consumoPromedioDiario);

    await executor(
      'UPDATE insumos SET dias_restantes = ?, consumo_promedio_diario = ?, dias_restantes_origen = ? WHERE id = ?',
      [diasRestantes, consumoPromedioDiario, origen, insumoId]
    );

    const alerta = getNivelAlerta(diasRestantes);

    if (alerta.tipo) {
      const [alertasExistentes] = await executor(
        'SELECT id FROM alertas WHERE insumo_id = ? AND tipo = ? AND leida = FALSE',
        [insumoId, alerta.tipo]
      );

      if (alertasExistentes.length === 0) {
        await executor(
          'INSERT INTO alertas (insumo_id, tipo, mensaje) VALUES (?, ?, ?)',
          [insumoId, alerta.tipo, `${insumo.nombre}: ${alerta.label} - ${diasRestantes} ${alerta.mensaje} (stock: ${stockActual.toFixed(2)} ${insumo.unidad})`]
        );

        if (alerta.tipo === 'stock_critico') {
          obtenerDestinatariosAlerta(insumo.tambo_id, executor)
            .then((destinatarios) => {
              if (destinatarios.length > 0) {
                return sendStockCriticoEmail(destinatarios, {
                  nombreInsumo: insumo.nombre,
                  diasRestantes,
                  stockActual,
                  unidad: insumo.unidad,
                });
              }
            })
            .catch((err) => console.error('Error enviando email de stock critico:', err));
        }
      }
    }

    if (!alerta.tipo) {
      await executor(
        'UPDATE alertas SET leida = TRUE WHERE insumo_id = ? AND leida = FALSE',
        [insumoId]
      );
    }

    return {
      diasRestantes,
      consumoEstimado: consumoPromedioDiario,
      nivel: alerta.nivel,
      tipo: alerta.tipo,
      color: alerta.color,
      label: alerta.label,
    };
  } catch (error) {
    console.error('Error verificando alertas:', error);
    return null;
  }
}

module.exports = {
  calcularConsumoEstimado,
  calcularConsumoFormulado,
  calcularConsumoConOrigen,
  calcularDiasRestantes,
  calcularEstadoActual,
  getNivelAlerta,
  verificarYGenerarAlertas,
};
