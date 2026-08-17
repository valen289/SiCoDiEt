// Fecha/hora "de negocio" (que dia/hora es para el productor), calculada en la zona
// horaria del tambo en vez de la del servidor -- evita que un consumo registrado cerca
// de medianoche quede fechado un dia distinto al real cuando el servidor corre en UTC.

function hoyEnZona(zonaHoraria) {
  // locale 'en-CA' formatea nativamente como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function horaEnZona(zonaHoraria) {
  // locale 'en-GB' + hour12:false formatea como HH:mm:ss
  return new Intl.DateTimeFormat('en-GB', { timeZone: zonaHoraria, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}

// Resta N dias a una fecha YYYY-MM-DD anclando en UTC medianoche, para que la aritmetica
// de dias no dependa del timezone del proceso Node (evita el mismo bug que se esta arreglando).
function restarDiasFecha(fechaYMD, dias) {
  const d = new Date(fechaYMD + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().split('T')[0];
}

module.exports = { hoyEnZona, horaEnZona, restarDiasFecha };
