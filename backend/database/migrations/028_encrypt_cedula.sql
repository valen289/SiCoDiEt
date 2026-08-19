-- Cifrado de cedula en reposo: `cedula` pasa a guardar el valor cifrado (AES-256-GCM,
-- ver utils/cedulaCrypto.js) y `cedula_hash` guarda un HMAC deterministico que se usa
-- para buscar por igualdad (login, chequeo de unicidad al registrar) ya que el texto
-- cifrado cambia cada vez aunque la cedula sea la misma.
-- El backfill de las filas existentes (cedula en texto plano -> cifrada + hash) corre
-- en el arranque del server (scripts/backfillCedulaEncryption.js), no en este SQL.
ALTER TABLE usuarios ADD COLUMN cedula_hash CHAR(64) NULL AFTER cedula;
ALTER TABLE usuarios DROP INDEX cedula;
ALTER TABLE usuarios MODIFY COLUMN cedula VARCHAR(255) NOT NULL;
ALTER TABLE usuarios ADD UNIQUE INDEX idx_usuarios_cedula_hash (cedula_hash);
