-- Migration 024: Revierte la columna moneda de tambos (migration 023).
-- Un selector de moneda sin conversion real de los montos no tiene sentido -- todo
-- el sistema sigue operando en USD, que es lo que ya asumian los calculos de costos.
ALTER TABLE tambos DROP COLUMN moneda;
