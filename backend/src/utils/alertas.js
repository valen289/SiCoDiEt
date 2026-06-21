const pool = require('../config/database');
const { sendStockCriticoEmail } = require('./email');

async function obtenerDestinatariosAlerta(tamboId, executor) {
  const [usuarios] = await executor(
    "SELECT email FROM usuarios WHERE tambo_id = ? AND rol IN ('dueno', 'encargado') AND activo = TRUE AND email IS NOT NULL",
    [tamboId]
  );
  return usuarios.map((u) => u.email);
}

async function calcularConsumoEstimado(insumoId) {
  try {
    const [consumo3d] = await pool.query(
      `SELECT COALESCE(SUM(cantidad_kg), 0) as total, COUNT(DISTINCT fecha) as dias
       FROM consumo_diario_lote
       WHERE insumo_id = ? AND fecha >= CURDATE() - INTERVAL 3 DAY`,
      [insumoId]
    );

    const [consumo7d] = await pool.query(
      `SELECT COALESCE(SUM(cantidad_kg), 0) as total, COUNT(DISTINCT fecha) as dias
       FROM consumo_diario_lote
       WHERE insumo_id = ? AND fecha >= CURDATE() - INTERVAL 7 DAY`,
      [insumoId]
    );

    const [consumo30d] = await pool.query(
      `SELECT COALESCE(SUM(cantidad_kg), 0) as total, COUNT(DISTINCT fecha) as dias
       FROM consumo_diario_lote
       WHERE insumo_id = ? AND fecha >= CURDATE() - INTERVAL 30 DAY`,
      [insumoId]
    );

    const avg3d = consumo3d[0].dias > 0 ? consumo3d[0].total / consumo3d[0].dias : 0;
    const avg7d = consumo7d[0].dias > 0 ? consumo7d[0].total / consumo7d[0].dias : 0;
    const avg30d = consumo30d[0].dias > 0 ? consumo30d[0].total / consumo30d[0].dias : 0;

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
async function calcularConsumoFormulado(insumoId) {
  try {
    const [filas] = await pool.query(
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

// Cadena de fallback: historico real (consumo_diario_lote) > formulado en dieta activa.
// No hay un campo de "consumo manual" real en ningun formulario hoy -- consumo_promedio_diario
// es solo el cache del ultimo calculo, asi que no se puede reusar como fuente independiente
// (si se reusara, al desaparecer la dieta quedaria un valor viejo etiquetado como "manual").
// Devuelve { consumo, origen } para que se pueda mostrar de donde viene la estimacion.
async function calcularConsumoConOrigen(insumoId) {
  const consumoHistorico = await calcularConsumoEstimado(insumoId);
  if (consumoHistorico > 0) {
    return { consumo: consumoHistorico, origen: 'historico' };
  }

  const consumoFormulado = await calcularConsumoFormulado(insumoId);
  if (consumoFormulado > 0) {
    return { consumo: consumoFormulado, origen: 'formulado' };
  }

  return { consumo: 0, origen: 'sin_datos' };
}

async function calcularDiasRestantes(stockActual, consumoEstimado) {
  if (!consumoEstimado || consumoEstimado <= 0) return 999;
  return Math.floor(stockActual / consumoEstimado);
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

    const { consumo: consumoPromedioDiario, origen } = await calcularConsumoConOrigen(insumoId);

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
  getNivelAlerta,
  verificarYGenerarAlertas,
};
