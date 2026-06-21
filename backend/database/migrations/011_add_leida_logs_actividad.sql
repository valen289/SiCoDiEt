-- Migración 011: marcar actividades como leídas
-- Ejecutar UNA SOLA VEZ:
--   mysql -u usuario -p gestion_tambo < backend/database/migrations/011_add_leida_logs_actividad.sql

ALTER TABLE logs_actividad
    ADD COLUMN leida BOOLEAN NOT NULL DEFAULT FALSE AFTER fecha_hora,
    ADD INDEX idx_logs_actividad_tambo_leida (tambo_id, leida);
