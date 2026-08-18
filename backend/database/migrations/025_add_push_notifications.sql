-- Migration 025: Push notifications (Web Push) - suscripciones del navegador y
-- tabla de idempotencia para avisos programados (evita mandar el mismo aviso
-- mas de una vez por tambo/dia, ej. el recordatorio de consumo AM pendiente).
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id     INT NOT NULL,
    endpoint       VARCHAR(500) NOT NULL,
    keys_p256dh    VARCHAR(255) NOT NULL,
    keys_auth      VARCHAR(255) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE KEY uq_usuario_endpoint (usuario_id, endpoint(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones_programadas_enviadas (
    id        INT AUTO_INCREMENT PRIMARY KEY,
    tambo_id  INT NOT NULL,
    tipo      VARCHAR(50) NOT NULL,
    fecha     DATE NOT NULL,
    FOREIGN KEY (tambo_id) REFERENCES tambos(id),
    UNIQUE KEY uq_tambo_tipo_fecha (tambo_id, tipo, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
