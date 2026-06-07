-- ==========================================
-- SiCoDiEt - Migración a movimientos_stock
-- ==========================================
-- Ejecutar este script en bases de datos existentes
-- para migrar datos de las 3 tablas antiguas a la nueva
-- tabla unificada movimientos_stock.

USE gestion_tambo;

-- 1. Crear tabla movimientos_stock si no existe
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id INT AUTO_INCREMENT PRIMARY KEY,
    insumo_id INT NOT NULL,
    lote_id INT NULL,
    usuario_id INT NULL,
    tipo ENUM('ingreso', 'consumo', 'ajuste_positivo', 'ajuste_negativo') NOT NULL,
    cantidad DECIMAL(10,2) NOT NULL,
    stock_anterior DECIMAL(10,2) NOT NULL,
    stock_posterior DECIMAL(10,2) NOT NULL,
    comprobante_entrega VARCHAR(50) NULL,
    observaciones TEXT,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE,
    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_insumo_fecha (insumo_id, fecha),
    INDEX idx_fecha (fecha),
    INDEX idx_tipo (tipo),
    INDEX idx_lote_fecha (lote_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Migrar ingresos desde historial_cargas_alimentos
INSERT INTO movimientos_stock (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, comprobante_entrega, observaciones, fecha, hora)
SELECT
    h.insumo_id,
    h.usuario_id,
    'ingreso',
    h.cantidad,
    (SELECT i.stock_actual FROM insumos i WHERE i.id = h.insumo_id) - h.cantidad,
    (SELECT i.stock_actual FROM insumos i WHERE i.id = h.insumo_id),
    h.comprobante_entrega,
    h.observaciones,
    h.fecha,
    h.hora
FROM historial_cargas_alimentos h
WHERE NOT EXISTS (
    SELECT 1 FROM movimientos_stock ms
    WHERE ms.insumo_id = h.insumo_id
    AND ms.fecha = h.fecha
    AND ms.hora = h.hora
    AND ms.tipo = 'ingreso'
    AND ms.cantidad = h.cantidad
);

-- 3. Migrar consumos desde consumos
INSERT INTO movimientos_stock (insumo_id, lote_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, fecha, hora)
SELECT
    c.insumo_id,
    c.lote_id,
    c.usuario_id,
    'consumo',
    c.cantidad,
    (SELECT i.stock_actual FROM insumos i WHERE i.id = c.insumo_id) + c.cantidad,
    (SELECT i.stock_actual FROM insumos i WHERE i.id = c.insumo_id),
    c.observaciones,
    c.fecha,
    c.hora
FROM consumos c
WHERE NOT EXISTS (
    SELECT 1 FROM movimientos_stock ms
    WHERE ms.insumo_id = c.insumo_id
    AND ms.fecha = c.fecha
    AND ms.hora = c.hora
    AND ms.tipo = 'consumo'
    AND ms.cantidad = c.cantidad
);

-- 4. Migrar ajustes desde consumo_diario
INSERT INTO movimientos_stock (insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, fecha, hora)
SELECT
    cd.insumo_id,
    cd.usuario_id,
    cd.tipo_movimiento,
    cd.cantidad,
    CASE
        WHEN cd.tipo_movimiento IN ('consumo', 'ajuste_negativo')
        THEN (SELECT i.stock_actual FROM insumos i WHERE i.id = cd.insumo_id) + cd.cantidad
        ELSE (SELECT i.stock_actual FROM insumos i WHERE i.id = cd.insumo_id) - cd.cantidad
    END,
    (SELECT i.stock_actual FROM insumos i WHERE i.id = cd.insumo_id),
    cd.observaciones,
    cd.fecha,
    cd.hora
FROM consumo_diario cd
WHERE cd.tipo_movimiento IN ('ajuste_positivo', 'ajuste_negativo')
AND NOT EXISTS (
    SELECT 1 FROM movimientos_stock ms
    WHERE ms.insumo_id = cd.insumo_id
    AND ms.fecha = cd.fecha
    AND ms.hora = cd.hora
    AND ms.tipo = cd.tipo_movimiento
    AND ms.cantidad = cd.cantidad
);

-- 5. Verificar migración
SELECT
    'movimientos_stock' as tabla,
    COUNT(*) as registros
FROM movimientos_stock
UNION ALL
SELECT 'historial_cargas_alimentos', COUNT(*) FROM historial_cargas_alimentos
UNION ALL
SELECT 'consumos', COUNT(*) FROM consumos
UNION ALL
SELECT 'consumo_diario', COUNT(*) FROM consumo_diario;
