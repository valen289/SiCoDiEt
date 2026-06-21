-- Migración 005: asociar usuarios a un tambo
-- Ejecutar UNA SOLA VEZ:
--   mysql -u usuario -p gestion_tambo < backend/database/migrations/005_add_tambo_id_usuarios.sql

ALTER TABLE usuarios
    ADD COLUMN tambo_id INT NOT NULL DEFAULT 1 AFTER id,
    ADD CONSTRAINT fk_usuarios_tambo FOREIGN KEY (tambo_id) REFERENCES tambos(id);
