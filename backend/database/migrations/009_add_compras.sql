-- Crea tablas para el módulo de compras: proveedores y registro de compras con impacto de stock.

CREATE TABLE IF NOT EXISTS proveedores (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tambo_id       INT          NOT NULL,
  nombre         VARCHAR(100) NOT NULL,
  contacto       VARCHAR(100) DEFAULT NULL,
  telefono       VARCHAR(30)  DEFAULT NULL,
  activo         TINYINT(1)   DEFAULT 1,
  fecha_creacion TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proveedores_tambo (tambo_id)
);

CREATE TABLE IF NOT EXISTS compras (
  id              INT           AUTO_INCREMENT PRIMARY KEY,
  tambo_id        INT           NOT NULL,
  proveedor_id    INT           DEFAULT NULL,
  insumo_id       INT           NOT NULL,
  usuario_id      INT           DEFAULT NULL,
  fecha           DATE          NOT NULL,
  cantidad        DECIMAL(10,2) NOT NULL,
  precio_unitario DECIMAL(10,4) NOT NULL,
  monto_total     DECIMAL(10,2) NOT NULL,
  numero_factura  VARCHAR(50)   DEFAULT NULL,
  movimiento_id   INT           DEFAULT NULL,
  observaciones   TEXT          DEFAULT NULL,
  fecha_creacion  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_compras_tambo_fecha (tambo_id, fecha),
  INDEX idx_compras_proveedor   (proveedor_id),
  INDEX idx_compras_insumo      (insumo_id)
);
