const pool = require('../config/database');

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

    const consumoEstimado = await calcularConsumoEstimado(insumoId);

    const consumoPromedioDiario = consumoEstimado > 0 ? consumoEstimado : parseFloat(insumo.consumo_promedio_diario);

    const diasRestantes = await calcularDiasRestantes(stockActual, consumoPromedioDiario);

    await executor(
      'UPDATE insumos SET dias_restantes = ?, consumo_promedio_diario = ? WHERE id = ?',
      [diasRestantes, consumoPromedioDiario, insumoId]
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

module.exports = { calcularConsumoEstimado, calcularDiasRestantes, getNivelAlerta, verificarYGenerarAlertas };
