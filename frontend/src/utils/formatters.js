export function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

const SIMBOLOS_MONEDA = { UYU: '$U', ARS: '$', USD: 'US$' };
let monedaActual = 'USD'; // preserva el comportamiento actual hasta que AuthContext haga su fetch

// Se llama desde AuthContext cuando cambia el tambo logueado, para que formatMoney
// use la moneda configurada por el establecimiento sin tener que pasarla en cada llamado.
export function setMonedaTambo(codigo) {
  if (SIMBOLOS_MONEDA[codigo]) monedaActual = codigo;
}

export function formatMoney(num) {
  const symbol = SIMBOLOS_MONEDA[monedaActual];
  if (num === null || num === undefined) return `${symbol} 0,00`;
  return `${symbol} ` + new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
}

// Alias historico usado en Dietas.jsx.
export const fmtUSD = formatMoney;

export function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '0,00';
  return parseFloat(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Parsea la fecha como local (no UTC) para evitar el off-by-one-day en timezones UTC-3.
export function formatDate(date) {
  if (!date) return '';
  const str = date.toString().split('T')[0];
  const [anio, mes, dia] = str.split('-');
  return `${dia}/${mes}/${anio}`;
}

// Alias historico usado en Consumos.jsx.
export const formatFecha = formatDate;

export function fmt(num, dec = 0) {
  const n = parseFloat(String(num).replace(',', '.'));
  if (isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function todayLabel() {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}
