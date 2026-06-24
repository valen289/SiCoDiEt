// Construye el SET de un UPDATE dinamico a partir de un objeto { columna: valor }.
// Las claves cuyo valor sea undefined se omiten (significa "no se quiere tocar ese campo");
// usar null explicito si la intencion es limpiar la columna.
function buildUpdateSet(fields) {
  const columns = [];
  const values = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    columns.push(`${column} = ?`);
    values.push(value);
  }

  return { setClause: columns.join(', '), values, hasUpdates: columns.length > 0 };
}

module.exports = { buildUpdateSet };
