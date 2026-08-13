// El consumo diario siempre se calcula en kg (segun la dieta formulada), pero el stock
// de un insumo puede llevarse en una unidad fisica distinta (fardos, bolsones, bolsas).
// insumo.peso_unidad (kg que pesa 1 unidad fisica) permite convertir entre ambos mundos.
// Si no esta configurado, se asume que la unidad del insumo ya es kg (conversion 1:1).

function kgAUnidadNativa(kg, insumo) {
  const pesoUnidad = parseFloat(insumo?.peso_unidad);
  if (!pesoUnidad || pesoUnidad <= 0) return kg;
  return kg / pesoUnidad;
}

function unidadNativaAKg(cantidad, insumo) {
  const pesoUnidad = parseFloat(insumo?.peso_unidad);
  if (!pesoUnidad || pesoUnidad <= 0) return cantidad;
  return cantidad * pesoUnidad;
}

module.exports = { kgAUnidadNativa, unidadNativaAKg };
