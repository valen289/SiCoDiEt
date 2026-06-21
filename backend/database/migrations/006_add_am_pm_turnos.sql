-- Migration 006: Soporte AM/PM en dietas y consumos
-- La dieta almacena la ración DIARIA total; porcentaje_am indica qué fracción se da a la mañana.
-- PM se calcula como (100 - porcentaje_am).

-- 1. Distribución AM/PM por ingrediente en cada dieta
ALTER TABLE dieta_ingredientes
  ADD COLUMN porcentaje_am DECIMAL(5,2) NOT NULL DEFAULT 50;

-- 2. Turno en el registro de consumo diario por lote
ALTER TABLE consumo_diario_lote
  ADD COLUMN turno ENUM('AM', 'PM') NOT NULL DEFAULT 'AM';

-- La clave única pasa a incluir el turno: ahora se permiten dos registros
-- por día/lote/insumo (uno AM y uno PM)
-- Se separan en dos statements para que el runner pueda skipear cada uno de forma independiente
ALTER TABLE consumo_diario_lote DROP INDEX unique_fecha_lote_insumo;
ALTER TABLE consumo_diario_lote ADD UNIQUE KEY unique_fecha_lote_insumo_turno (fecha, lote_id, insumo_id, turno);

-- 3. Turno en movimientos_stock para trazabilidad completa
ALTER TABLE movimientos_stock
  ADD COLUMN turno VARCHAR(5) NULL DEFAULT NULL;

-- 4. Observaciones en consumo_diario_lote (para correcciones y sustituciones)
ALTER TABLE consumo_diario_lote
  ADD COLUMN observaciones TEXT NULL DEFAULT NULL;
