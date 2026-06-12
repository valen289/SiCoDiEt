-- Migración 003: Preparación para multi-tenant
-- Agrega la tabla `tambos` y la columna `tambo_id` a todas las tablas de datos.
-- Todos los registros existentes quedan asignados al tambo id=1 (Tambo Principal).
-- Los routes NO necesitan cambios aún; tambo_id = 1 por DEFAULT.
--
-- Ejecutar UNA SOLA VEZ contra la base de datos existente:
--   mysql -u usuario -p gestion_tambo < backend/database/migrations/003_add_tambo_id.sql

-- ─── 1. Tabla tambos ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tambos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(150) NOT NULL,
    activo         BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tambos (id, nombre) VALUES (1, 'Tambo Principal')
ON DUPLICATE KEY UPDATE nombre = nombre;

-- ─── 2. tambo_id en tablas de datos (raíz) ───────────────────────────────────
-- Las tablas hijas (lote_insumos, dieta_ingredientes, etc.) heredan el tambo
-- a través de su FK al padre; no necesitan columna propia.

ALTER TABLE insumos
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_insumos_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE lotes
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_lotes_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE consumos
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_consumos_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE consumo_diario
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_consumo_diario_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE ganado
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_ganado_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE alertas
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_alertas_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE logs_actividad
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_logs_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE historial_cargas_alimentos
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_historial_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE movimientos_stock
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_movimientos_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE dietas
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_dietas_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);

ALTER TABLE consumo_diario_lote
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_cdl_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);
