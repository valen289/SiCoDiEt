-- Migration 015: agrega 'pastura' como tipo de contenedor/alimento valido.
-- historial_cargas_alimentos.tipo_alimento es un ENUM estricto; sin este cambio,
-- registrar una carga de stock para un insumo tipo 'pastura' rompe el INSERT.

ALTER TABLE historial_cargas_alimentos
  MODIFY COLUMN tipo_alimento ENUM('silo','bolson','fardo','sales','pastura') NOT NULL;
