// Columnas que pueden aparecer en un SET clause dinamico.
// Cualquier key fuera de esta lista se ignora silenciosamente,
// evitando que un error de llamador inyecte nombres de columna arbitrarios.
const COLUMNAS_PERMITIDAS = new Set([
  // usuarios
  'nombre', 'email', 'telefono', 'password', 'rol', 'activo', 'ultimo_acceso',
  'intentos_fallidos', 'bloqueado_hasta',
  // insumos
  'stock_actual', 'precio_por_kg', 'stock_minimo', 'capacidad_maxima',
  'dias_restantes', 'consumo_promedio_diario', 'dias_restantes_origen',
  'unidad', 'tipo_insumo', 'categoria',
  // lotes
  'cantidad_animales', 'etapa_lactancia', 'objetivo_productivo', 'descripcion',
  // dietas
  'activo',
  // compras / proveedores
  'precio_unitario', 'cantidad', 'total', 'contacto',
]);

// Construye el SET de un UPDATE dinamico a partir de un objeto { columna: valor }.
// Las claves cuyo valor sea undefined se omiten (significa "no se quiere tocar ese campo");
// usar null explicito si la intencion es limpiar la columna.
// Las claves que no esten en COLUMNAS_PERMITIDAS se ignoran como medida de defensa.
function buildUpdateSet(fields) {
  const columns = [];
  const values = [];

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!COLUMNAS_PERMITIDAS.has(column)) continue;
    columns.push(`${column} = ?`);
    values.push(value);
  }

  return { setClause: columns.join(', '), values, hasUpdates: columns.length > 0 };
}

module.exports = { buildUpdateSet };
