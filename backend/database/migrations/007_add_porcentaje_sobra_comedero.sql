-- Migration 007: Lectura del comedero (% de sobra) en consumo_diario_lote
-- porcentaje_sobra: % de alimento que quedó en el comedero antes de dar ESTE turno
-- (= observación de lo que dejó el turno anterior)
-- 0% = vacío (posible hambre), ≤5% = normal, >10% = riesgo de pudrición

ALTER TABLE consumo_diario_lote
  ADD COLUMN porcentaje_sobra DECIMAL(5,2) NULL DEFAULT NULL;
