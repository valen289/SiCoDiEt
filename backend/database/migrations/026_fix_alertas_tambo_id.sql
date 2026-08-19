-- Migration 026: corrige alertas.tambo_id mal atribuido.
--
-- verificarYGenerarAlertas() insertaba en `alertas` sin la columna tambo_id, asi
-- que cada fila caia en su DEFAULT 1 sin importar el tambo real del insumo. Efecto:
-- toda alerta de cualquier tambo != 1 quedaba (a) invisible en el /alertas de su
-- propio tambo, (b) visible por error en el /alertas del tambo 1 (fuga de datos
-- entre tenants), y (c) huerfana para el borrado del tambo real: "DELETE FROM
-- alertas WHERE tambo_id = <su id>" nunca las tocaba, y esas filas bloqueaban
-- despues "DELETE FROM insumos" por la FK alertas -> insumos.
--
-- Este UPDATE reasigna cada alerta al tambo real de su insumo (fuente de verdad).
UPDATE alertas a
JOIN insumos i ON a.insumo_id = i.id
SET a.tambo_id = i.tambo_id
WHERE a.tambo_id <> i.tambo_id;
