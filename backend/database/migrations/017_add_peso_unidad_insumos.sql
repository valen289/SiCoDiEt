-- Migration 017: agrega peso_unidad (kg por unidad fisica) a insumos.
-- El stock y el consumo diario historicamente se manejaban en la misma "unidad"
-- del insumo, pero el consumo se calcula siempre en kg (segun la dieta formulada).
-- Si la unidad del insumo no es kg (ej. fardos, bolsones, bolsas), restar kg
-- directamente del stock fisico lo descuadra. peso_unidad permite convertir.

ALTER TABLE insumos ADD COLUMN peso_unidad DECIMAL(10,3) DEFAULT NULL AFTER unidad;

-- Valores por defecto razonables para insumos existentes cuya unidad ya no sea kg.
UPDATE insumos SET peso_unidad = 25
  WHERE tipo_insumo = 'fardo' AND peso_unidad IS NULL AND LOWER(TRIM(unidad)) NOT IN ('kg', 'kilogramo', 'kilogramos');

UPDATE insumos SET peso_unidad = 1000
  WHERE tipo_insumo = 'bolson' AND peso_unidad IS NULL AND LOWER(TRIM(unidad)) NOT IN ('kg', 'kilogramo', 'kilogramos');

UPDATE insumos SET peso_unidad = 25
  WHERE tipo_insumo = 'bolsa' AND peso_unidad IS NULL AND LOWER(TRIM(unidad)) NOT IN ('kg', 'kilogramo', 'kilogramos');
