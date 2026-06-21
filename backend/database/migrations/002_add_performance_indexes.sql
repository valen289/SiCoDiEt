-- Migración: índices de rendimiento

CREATE INDEX idx_insumos_activo      ON insumos (activo);
CREATE INDEX idx_insumos_tipo         ON insumos (tipo_insumo);
CREATE INDEX idx_insumos_activo_tipo  ON insumos (activo, tipo_insumo);

CREATE INDEX idx_lotes_activo         ON lotes (activo);

CREATE INDEX idx_cdl_lote_fecha       ON consumo_diario_lote (lote_id, fecha);
CREATE INDEX idx_cdl_insumo_fecha     ON consumo_diario_lote (insumo_id, fecha);

CREATE INDEX idx_di_dieta             ON dieta_ingredientes (dieta_id);

CREATE INDEX idx_alertas_activo       ON alertas (activo);
CREATE INDEX idx_alertas_insumo       ON alertas (insumo_id);
