import api from '../services/api';

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// La Push API espera la VAPID public key como Uint8Array, no como el string
// base64url que devuelve el backend -- conversion estandar, sin libreria.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function getSuscripcionActual() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function activarNotificaciones() {
  if (!isPushSupported()) {
    throw new Error('Este navegador no soporta notificaciones push');
  }

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') {
    throw new Error('Permiso de notificaciones denegado');
  }

  const { data } = await api.get('/notificaciones/vapid-public-key');
  if (!data.publicKey) {
    throw new Error('El servidor no tiene configuradas las notificaciones push');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });

  await api.post('/notificaciones/suscribir', subscription.toJSON());
  return subscription;
}

export async function desactivarNotificaciones() {
  const subscription = await getSuscripcionActual();
  if (!subscription) return;

  await api.delete('/notificaciones/suscribir', { data: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}
