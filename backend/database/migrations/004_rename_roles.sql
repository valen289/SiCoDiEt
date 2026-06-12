-- Migración 004: Renombrar roles
-- admin → dueno | usuario → encargado | operario → trabajador
--
-- Ejecutar UNA SOLA VEZ:
--   mysql -u usuario -p gestion_tambo < backend/database/migrations/004_rename_roles.sql

-- Paso 1: ampliar el ENUM para que acepte temporalmente ambos conjuntos de valores
ALTER TABLE usuarios MODIFY rol
    ENUM('admin', 'usuario', 'operario', 'dueno', 'encargado', 'trabajador')
    NOT NULL DEFAULT 'trabajador';

-- Paso 2: renombrar los datos existentes
UPDATE usuarios SET rol = 'dueno'      WHERE rol = 'admin';
UPDATE usuarios SET rol = 'encargado'  WHERE rol = 'usuario';
UPDATE usuarios SET rol = 'trabajador' WHERE rol = 'operario';

-- Paso 3: restringir el ENUM solo a los nuevos valores
ALTER TABLE usuarios MODIFY rol
    ENUM('dueno', 'encargado', 'trabajador')
    NOT NULL DEFAULT 'trabajador';
