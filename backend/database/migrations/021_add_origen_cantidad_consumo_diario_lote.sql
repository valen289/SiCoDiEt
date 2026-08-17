-- Migration 021: Trazabilidad de si la cantidad registrada vino de la dieta formulada
-- o fue editada manualmente por el trabajador.
ALTER TABLE consumo_diario_lote ADD COLUMN origen_cantidad ENUM('dieta', 'manual') NULL DEFAULT NULL;
