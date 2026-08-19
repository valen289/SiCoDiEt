-- Migration 027: mismo bug que 026 pero en las 3 tablas que llena POST /insumos/:id/cargar
-- (historial_cargas_alimentos, consumo_diario, movimientos_stock) -- los INSERT no incluian
-- tambo_id, asi que cada carga de stock quedaba mal atribuida al tambo 1 (DEFAULT de la
-- columna) sin importar el tambo real del insumo cargado. Reasigna cada fila al tambo
-- real de su insumo.
UPDATE historial_cargas_alimentos h
JOIN insumos i ON h.insumo_id = i.id
SET h.tambo_id = i.tambo_id
WHERE h.tambo_id <> i.tambo_id;

UPDATE consumo_diario c
JOIN insumos i ON c.insumo_id = i.id
SET c.tambo_id = i.tambo_id
WHERE c.tambo_id <> i.tambo_id;

UPDATE movimientos_stock m
JOIN insumos i ON m.insumo_id = i.id
SET m.tambo_id = i.tambo_id
WHERE m.tambo_id <> i.tambo_id;
