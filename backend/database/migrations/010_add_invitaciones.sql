-- Migration 010: Tabla de invitaciones para registro de usuarios por token
CREATE TABLE IF NOT EXISTS invitaciones (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  tambo_id          INT NOT NULL,
  token             VARCHAR(64) NOT NULL UNIQUE,
  rol               ENUM('trabajador', 'encargado') NOT NULL DEFAULT 'trabajador',
  creado_por        INT NOT NULL,
  usado             TINYINT(1) NOT NULL DEFAULT 0,
  usuario_id        INT DEFAULT NULL,
  fecha_expiracion  TIMESTAMP NOT NULL,
  fecha_creacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invitaciones_token (token),
  INDEX idx_invitaciones_tambo (tambo_id)
);
