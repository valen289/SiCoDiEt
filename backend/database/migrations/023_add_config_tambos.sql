-- Migration 023: Configuracion de tambo (perfil de cuenta) - logo, moneda y zona horaria.
ALTER TABLE tambos ADD COLUMN logo MEDIUMTEXT NULL DEFAULT NULL;
ALTER TABLE tambos ADD COLUMN moneda VARCHAR(3) NOT NULL DEFAULT 'UYU';
ALTER TABLE tambos ADD COLUMN zona_horaria VARCHAR(50) NOT NULL DEFAULT 'America/Montevideo';
