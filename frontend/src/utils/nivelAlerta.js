// Logica de nivel de alerta por dias restantes, usada por las tarjetas de insumo
// (Silos.jsx) y por el dashboard. Centralizada aca para no duplicarla por pagina
// (ya hay sistemas de color de alerta divergentes en otras partes del frontend).
export function getNivelAlerta(diasRestantes) {
  if (diasRestantes === 0 || diasRestantes === 999) return { nivel: 'sin_datos', color: '#6c757d', label: 'SIN DATOS', bgClass: 'bg-secondary' };
  if (diasRestantes <= 5) return { nivel: 'critico', color: '#dc3545', label: 'CRITICO', bgClass: 'bg-danger' };
  if (diasRestantes <= 7) return { nivel: 'precaucion', color: '#ffc107', label: 'PRECAUCION', bgClass: 'bg-warning text-dark' };
  if (diasRestantes <= 20) return { nivel: 'normal', color: '#28a745', label: 'NORMAL', bgClass: 'bg-success' };
  return { nivel: 'holgado', color: '#17a2b8', label: 'HOLGADO', bgClass: 'bg-info' };
}

export function getStockClass(porcentaje) {
  if (porcentaje <= 30) return 'stock-low';
  if (porcentaje <= 60) return 'stock-mid';
  return 'stock-high';
}
