-- Migration 022: Email opcional del invitado, para poder enviarle el link por correo
-- ademas de mostrarlo como QR/link para copiar.
ALTER TABLE invitaciones ADD COLUMN email VARCHAR(255) NULL DEFAULT NULL;
