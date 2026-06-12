
CREATE DATABASE IF NOT EXISTS gestion_tambo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestion_tambo;

SET FOREIGN_KEY_CHECKS=0;

-- ─── tambos debe ir primero: el resto de las tablas lo referencian ────────────

CREATE TABLE IF NOT EXISTS tambos (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    nombre         VARCHAR(150) NOT NULL,
    activo         BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    cedula         VARCHAR(20) UNIQUE NOT NULL,
    nombre         VARCHAR(100) NOT NULL,
    password       VARCHAR(255) NOT NULL,
    email          VARCHAR(150) NULL,
    telefono       VARCHAR(30) NULL,
    rol            ENUM('dueno', 'encargado', 'trabajador') NOT NULL DEFAULT 'trabajador',
    activo         BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso  TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS insumos (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id                INT NOT NULL DEFAULT 1,
    nombre                  VARCHAR(100) NOT NULL,
    tipo_insumo             VARCHAR(100) NOT NULL DEFAULT '',
    unidad                  VARCHAR(50) NOT NULL,
    capacidad_maxima        DECIMAL(10,2) NOT NULL,
    stock_actual            DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_minimo            DECIMAL(10,2) NOT NULL,
    consumo_promedio_diario DECIMAL(10,2) DEFAULT 0,
    dias_restantes          INT DEFAULT 0,
    ultimo_alerta_critica   TIMESTAMP NULL,
    activo                  BOOLEAN DEFAULT TRUE,
    fecha_creacion          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id) REFERENCES tambos(id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lotes (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id                INT NOT NULL DEFAULT 1,
    nombre                  VARCHAR(100) NOT NULL,
    tipo_animal             VARCHAR(100) NOT NULL,
    cantidad_animales       INT NOT NULL DEFAULT 0,
    consumo_estimado_diario DECIMAL(10,2) DEFAULT 0,
    observaciones           TEXT,
    activo                  BOOLEAN DEFAULT TRUE,
    fecha_creacion          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id) REFERENCES tambos(id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consumos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id      INT NOT NULL DEFAULT 1,
    lote_id       INT NOT NULL,
    insumo_id     INT NOT NULL,
    usuario_id    INT NULL,
    cantidad      DECIMAL(10,2) NOT NULL,
    fecha         DATE NOT NULL,
    hora          TIME NOT NULL,
    observaciones TEXT,
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (lote_id)    REFERENCES lotes(id) ON DELETE CASCADE,
    FOREIGN KEY (insumo_id)  REFERENCES insumos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consumo_diario (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id        INT NOT NULL DEFAULT 1,
    insumo_id       INT NOT NULL,
    usuario_id      INT NOT NULL,
    cantidad        DECIMAL(10,2) NOT NULL,
    fecha           DATE NOT NULL,
    hora            TIME NOT NULL,
    observaciones   TEXT,
    tipo_movimiento ENUM('consumo', 'ingreso', 'ajuste_positivo', 'ajuste_negativo') DEFAULT 'consumo',
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (insumo_id)  REFERENCES insumos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ganado (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id       INT NOT NULL DEFAULT 1,
    total_vacas    INT NOT NULL DEFAULT 0,
    vacas_lechera  INT DEFAULT 0,
    vacas_seco     INT DEFAULT 0,
    terneros       INT DEFAULT 0,
    fecha_registro DATE NOT NULL,
    usuario_id     INT,
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alertas (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id       INT NOT NULL DEFAULT 1,
    insumo_id      INT NULL,
    tipo           ENUM('stock_bajo', 'stock_critico', 'vencimiento') NOT NULL,
    mensaje        TEXT NOT NULL,
    leida          BOOLEAN DEFAULT FALSE,
    activo         BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id)  REFERENCES tambos(id),
    FOREIGN KEY (insumo_id) REFERENCES insumos(id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs_actividad (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id    INT NOT NULL DEFAULT 1,
    usuario_id  INT,
    accion      VARCHAR(100) NOT NULL,
    descripcion TEXT,
    fecha_hora  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS historial_cargas_alimentos (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id            INT NOT NULL DEFAULT 1,
    tipo_alimento       ENUM('silo', 'bolson', 'fardo', 'sales') NOT NULL,
    insumo_id           INT NOT NULL,
    usuario_id          INT NULL,
    cantidad            DECIMAL(10,2) NOT NULL,
    comprobante_entrega VARCHAR(50) NULL,
    fecha               DATE NOT NULL,
    hora                TIME NOT NULL,
    observaciones       TEXT,
    fecha_creacion      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (insumo_id)  REFERENCES insumos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos_stock (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id            INT NOT NULL DEFAULT 1,
    insumo_id           INT NOT NULL,
    lote_id             INT NULL,
    usuario_id          INT NULL,
    tipo                ENUM('ingreso', 'consumo', 'ajuste_positivo', 'ajuste_negativo') NOT NULL,
    cantidad            DECIMAL(10,2) NOT NULL,
    stock_anterior      DECIMAL(10,2) NOT NULL,
    stock_posterior     DECIMAL(10,2) NOT NULL,
    comprobante_entrega VARCHAR(50) NULL,
    observaciones       TEXT,
    fecha               DATE NOT NULL,
    hora                TIME NOT NULL,
    fecha_creacion      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (insumo_id)  REFERENCES insumos(id) ON DELETE CASCADE,
    FOREIGN KEY (lote_id)    REFERENCES lotes(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_tambo (tambo_id),
    INDEX idx_insumo_fecha (insumo_id, fecha),
    INDEX idx_fecha (fecha),
    INDEX idx_tipo (tipo),
    INDEX idx_lote_fecha (lote_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migración: poblar movimientos_stock desde tablas existentes
-- Ingresos desde historial_cargas_alimentos
INSERT INTO movimientos_stock (tambo_id, insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, comprobante_entrega, observaciones, fecha, hora)
SELECT
    1,
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
FROM historial_cargas_alimentos h;

-- Consumos desde consumos
INSERT INTO movimientos_stock (tambo_id, insumo_id, lote_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, fecha, hora)
SELECT
    1,
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
FROM consumos c;

-- Movimientos desde consumo_diario (ajustes)
INSERT INTO movimientos_stock (tambo_id, insumo_id, usuario_id, tipo, cantidad, stock_anterior, stock_posterior, observaciones, fecha, hora)
SELECT
    1,
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
WHERE cd.tipo_movimiento IN ('ajuste_positivo', 'ajuste_negativo');

CREATE TABLE IF NOT EXISTS lote_insumos (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    lote_id            INT NOT NULL,
    insumo_id          INT NOT NULL,
    cantidad_requerida DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (lote_id)   REFERENCES lotes(id) ON DELETE CASCADE,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS costos_ingredientes (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    insumo_id           INT NOT NULL,
    precio_por_kg       DECIMAL(10,4) NOT NULL,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_insumo (insumo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dietas (
    id                            INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id                      INT NOT NULL DEFAULT 1,
    nombre                        VARCHAR(150) NOT NULL,
    lote_id                       INT NOT NULL,
    materia_seca_kg               DECIMAL(10,2) NOT NULL DEFAULT 0,
    energia_mcal                  DECIMAL(10,2) NOT NULL DEFAULT 0,
    proteina_porcentaje           DECIMAL(5,2) NOT NULL DEFAULT 0,
    fibra_porcentaje              DECIMAL(5,2) NOT NULL DEFAULT 0,
    produccion_leche_esperada     DECIMAL(10,2) NOT NULL DEFAULT 0,
    precio_leche_por_litro        DECIMAL(10,4) NOT NULL DEFAULT 0,
    costo_total                   DECIMAL(10,4) NOT NULL DEFAULT 0,
    costo_por_vaca                DECIMAL(10,4) NOT NULL DEFAULT 0,
    costo_por_litro               DECIMAL(10,4) NOT NULL DEFAULT 0,
    ingreso_por_vaca              DECIMAL(10,4) NOT NULL DEFAULT 0,
    margen_alimenticio            DECIMAL(10,4) NOT NULL DEFAULT 0,
    margen_por_litro              DECIMAL(10,4) NOT NULL DEFAULT 0,
    porcentaje_gasto_alimentacion DECIMAL(5,2) NOT NULL DEFAULT 0,
    activo                        BOOLEAN DEFAULT TRUE,
    fecha_creacion                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id) REFERENCES tambos(id),
    FOREIGN KEY (lote_id)  REFERENCES lotes(id) ON DELETE CASCADE,
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dieta_ingredientes (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    dieta_id              INT NOT NULL,
    insumo_id             INT NOT NULL,
    cantidad_kg           DECIMAL(10,2) NOT NULL,
    porcentaje_dieta      DECIMAL(5,2) NOT NULL DEFAULT 0,
    costo_parcial         DECIMAL(10,4) NOT NULL DEFAULT 0,
    materia_seca_aportada DECIMAL(10,2) NOT NULL DEFAULT 0,
    energia_aportada      DECIMAL(10,2) NOT NULL DEFAULT 0,
    proteina_aportada     DECIMAL(10,2) NOT NULL DEFAULT 0,
    fibra_aportada        DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (dieta_id)  REFERENCES dietas(id) ON DELETE CASCADE,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parametros_nutricionales (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    insumo_id               INT NOT NULL,
    materia_seca_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
    energia_mcal_por_kg     DECIMAL(5,2) NOT NULL DEFAULT 0,
    proteina_porcentaje     DECIMAL(5,2) NOT NULL DEFAULT 0,
    fibra_porcentaje        DECIMAL(5,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (insumo_id) REFERENCES insumos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_insumo (insumo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS registro_diario_animales (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    lote_id           INT NOT NULL,
    fecha             DATE NOT NULL,
    cantidad_animales INT NOT NULL DEFAULT 0,
    usuario_id        INT NULL,
    fecha_creacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lote_id)    REFERENCES lotes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE KEY unique_lote_fecha (lote_id, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS consumo_diario_lote (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id          INT NOT NULL DEFAULT 1,
    fecha             DATE NOT NULL,
    lote_id           INT NOT NULL,
    insumo_id         INT NOT NULL,
    cantidad_kg       DECIMAL(10,2) NOT NULL,
    cantidad_animales INT NOT NULL DEFAULT 0,
    kg_por_animal     DECIMAL(10,2) NOT NULL DEFAULT 0,
    usuario_id        INT NULL,
    fecha_creacion    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tambo_id)   REFERENCES tambos(id),
    FOREIGN KEY (lote_id)    REFERENCES lotes(id) ON DELETE CASCADE,
    FOREIGN KEY (insumo_id)  REFERENCES insumos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    UNIQUE KEY unique_fecha_lote_insumo (fecha, lote_id, insumo_id),
    INDEX idx_tambo (tambo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;

-- ─── Datos iniciales ──────────────────────────────────────────────────────────

INSERT INTO tambos (id, nombre) VALUES (1, 'Tambo Principal');

INSERT INTO usuarios (cedula, nombre, password, rol) VALUES
('12345678', 'Administrador', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'dueno');

INSERT INTO insumos (tambo_id, nombre, tipo_insumo, unidad, capacidad_maxima, stock_actual, stock_minimo) VALUES
(1, 'Silo de Maiz',    'silo',   'kg', 40000, 25000, 5000),
(1, 'Bolson de Maiz',  'bolson', 'kg', 10000,  8500, 2000),
(1, 'Fardo de Alfalfa','fardo',  'kg',  5000,  4200, 1000),
(1, 'Sales Minerales', 'sales',  'kg',  4000,  2000,  500);

INSERT INTO ganado (tambo_id, total_vacas, vacas_lechera, vacas_seco, terneros, fecha_registro) VALUES
(1, 198, 150, 30, 18, CURDATE());

INSERT INTO lotes (tambo_id, nombre, tipo_animal, cantidad_animales, consumo_estimado_diario, observaciones) VALUES
(1, 'Lote A - Vacas Lechera', 'Vaca Lechera', 50, 150.00, 'Lote principal de vacas lecheras'),
(1, 'Lote B - Terneros',      'Ternero',      20,  50.00, 'Lote de terneros jovenes');

INSERT INTO lote_insumos (lote_id, insumo_id, cantidad_requerida) VALUES
(1, 1, 200.00),
(1, 2, 100.00),
(2, 3,  30.00),
(2, 4,  10.00);

INSERT INTO costos_ingredientes (insumo_id, precio_por_kg) VALUES
(1, 0.1500),
(2, 0.1800),
(3, 0.2200),
(4, 0.4500);

INSERT INTO parametros_nutricionales (insumo_id, materia_seca_porcentaje, energia_mcal_por_kg, proteina_porcentaje, fibra_porcentaje) VALUES
(1, 88.00, 2.35,  8.50,  2.80),
(2, 88.00, 2.35,  8.50,  2.80),
(3, 90.00, 1.85, 15.00, 28.00),
(4, 95.00, 0.00,  0.00,  0.00);

-- Parámetros nutricionales de referencia (valores de planilla del nutricionista)
INSERT INTO parametros_nutricionales (insumo_id, materia_seca_porcentaje, energia_mcal_por_kg, proteina_porcentaje, fibra_porcentaje)
SELECT id, 15.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%limon%'   AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 88.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%maiz%'    AND LOWER(nombre) LIKE '%canola%' AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 88.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%exp%'     AND LOWER(nombre) LIKE '%canola%' AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 88.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%exp%'     AND LOWER(nombre) LIKE '%soja%'   AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 88.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%maiz%'    AND LOWER(nombre) LIKE '%grano%'  AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 88.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%cebada%'  AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 99.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%urea%'    AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 35.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%spem%'    AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 50.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%alfalfa%' AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 50.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%rg%'      AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 99.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%sales%'   AND LOWER(nombre) LIKE '%alta%' AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 99.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%sales%'   AND LOWER(nombre) LIKE '%baja%' AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales)
UNION ALL
SELECT id, 20.00, 0.00, 0.00, 0.00 FROM insumos WHERE LOWER(nombre) LIKE '%pastura%' AND id NOT IN (SELECT insumo_id FROM parametros_nutricionales);
