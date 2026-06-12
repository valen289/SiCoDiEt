-- Migración: índices de rendimiento
-- Ejecutar una vez contra la base de datos de producción/desarrollo

-- insumos: filtros frecuentes por activo y tipo_insumo
ALTER TABLE insumos
  ADD INDEX IF NOT EXISTS idx_insumos_activo (activo),
  ADD INDEX IF NOT EXISTS idx_insumos_tipo (tipo_insumo),
  ADD INDEX IF NOT EXISTS idx_insumos_activo_tipo (activo, tipo_insumo);

-- lotes: filtro por activo
ALTER TABLE lotes
  ADD INDEX IF NOT EXISTS idx_lotes_activo (activo);

-- consumo_diario_lote: filtros por lote+fecha y por insumo+fecha
ALTER TABLE consumo_diario_lote
  ADD INDEX IF NOT EXISTS idx_cdl_lote_fecha (lote_id, fecha),
  ADD INDEX IF NOT EXISTS idx_cdl_insumo_fecha (insumo_id, fecha);

-- dieta_ingredientes: lookup por dieta (JOIN frecuente)
ALTER TABLE dieta_ingredientes
  ADD INDEX IF NOT EXISTS idx_di_dieta (dieta_id);

-- alertas: filtro por activo e insumo
ALTER TABLE alertas
  ADD INDEX IF NOT EXISTS idx_alertas_activo (activo),
  ADD INDEX IF NOT EXISTS idx_alertas_insumo (insumo_id);
