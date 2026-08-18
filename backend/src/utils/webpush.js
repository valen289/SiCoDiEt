const webpush = require('web-push');
const pool = require('../config/database');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:sicodietapp@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Manda una notificacion push a todos los usuarios de un tambo con alguno de los
// roles indicados. Fire-and-forget por diseño (igual que sendStockCriticoEmail en
// utils/email.js) -- un fallo de push nunca debe tumbar el flujo que la dispara.
// Si una suscripcion devuelve 404/410 (endpoint vencido o revocado por el navegador,
// forma estandar de Web Push), se borra de la DB en vez de seguir reintentando.
async function enviarPushATambo(tamboId, roles, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return; // VAPID no configurado (dev sin .env completo) -- no-op, igual que el email
  }

  const placeholders = roles.map(() => '?').join(', ');
  const [suscripciones] = await pool.query(
    `SELECT ps.id, ps.endpoint, ps.keys_p256dh, ps.keys_auth
     FROM push_subscriptions ps
     JOIN usuarios u ON ps.usuario_id = u.id
     WHERE u.tambo_id = ? AND u.rol IN (${placeholders}) AND u.activo = TRUE`,
    [tamboId, ...roles]
  );

  const body = JSON.stringify(payload);

  await Promise.all(suscripciones.map(async (sub) => {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };
    try {
      await webpush.sendNotification(pushSubscription, body);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      } else {
        console.error('Error enviando push notification:', error.message);
      }
    }
  }));
}

module.exports = { enviarPushATambo };
