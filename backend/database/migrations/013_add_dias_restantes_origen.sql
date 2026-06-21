-- Origen de la estimacion de "dias restantes": historico (consumo real registrado),
-- formulado (derivado de una dieta activa sin consumo aun), manual (consumo_promedio_diario
-- ingresado a mano) o sin_datos (no hay ninguna fuente).
ALTER TABLE insumos
  ADD COLUMN dias_restantes_origen ENUM('historico','formulado','manual','sin_datos')
  NOT NULL DEFAULT 'sin_datos';
