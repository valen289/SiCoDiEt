-- Migration 014: etapa de lactancia del lote (solo aplica a lotes con objetivo_productivo='leche')
-- Permite distinguir vacas en lactancia temprana (mas tolerantes a sobra de comedero
-- mientras suben a pico de produccion), media, tardia, o secas.

ALTER TABLE lotes
  ADD COLUMN etapa_lactancia ENUM('temprana','media','tardia','seca') NULL DEFAULT NULL;
