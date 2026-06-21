-- Agrega columna categoria para separar la categoría alimentaria del tipo de contenedor físico.
-- categoria = qué tipo de alimento ES (reserva_forrajera, concentrado, sales)
-- tipo_insumo = cómo está almacenado físicamente (silo, fardo, bolsón)

ALTER TABLE insumos ADD COLUMN categoria VARCHAR(100) DEFAULT NULL AFTER tipo_insumo;
ALTER TABLE insumos ADD INDEX idx_categoria (categoria);

UPDATE insumos SET categoria = CASE
  WHEN tipo_insumo IN ('silo', 'fardo', 'bolson', 'forraje') THEN 'reserva_forrajera'
  WHEN tipo_insumo IN ('grano', 'concentrado', 'aditivo')    THEN 'concentrado'
  WHEN tipo_insumo = 'sales'                                  THEN 'sales'
  ELSE 'reserva_forrajera'
END WHERE categoria IS NULL;
