-- Migration 012: Dietas segun objetivo del lote (leche vs engorde)
-- No todo lote es lechero (vacas de cria, novillos de engorde, terneros).
-- objetivo_productivo determina si la dieta usa metricas de leche o de ganancia de peso.

ALTER TABLE lotes
  ADD COLUMN objetivo_productivo ENUM('leche', 'engorde') NOT NULL DEFAULT 'leche';

ALTER TABLE dietas
  ADD COLUMN ganancia_kg_esperada DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN precio_kg_en_pie     DECIMAL(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN costo_por_kg_ganado  DECIMAL(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN margen_por_kg_ganado DECIMAL(10,4) NOT NULL DEFAULT 0;
