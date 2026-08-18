// Orquesta la sincronización de la cola de consumos offline (offlineQueue.js).
// El disparador principal y confiable es el evento "online" del navegador --
// funciona en todos los browsers, a diferencia de la Background Sync API (sin
// soporte en Firefox/Safari), que acá se usa solo como mejora progresiva.
import api from '../services/api';
import { listarPendientes, eliminarPendiente, marcarIntento, contarPendientes } from './offlineQueue';

export const OFFLINE_QUEUE_EVENT = 'sicodiet:offline-queue-changed';

let sincronizando = false;

function notificarCambio(pendientes) {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail: { pendientes } }));
}

// Reintenta cada consumo encolado. Si un item vuelve a fallar por red (seguimos
// offline o la conexión es intermitente), se deja en la cola para el próximo
// intento. Si el servidor responde con un error real (400, etc.), también se
// deja -- no se descarta silenciosamente un consumo que el trabajador cargó.
export async function intentarSincronizar() {
  if (sincronizando) return { sincronizados: 0, restantes: await contarPendientes() };
  sincronizando = true;

  let sincronizados = 0;
  try {
    const pendientes = await listarPendientes();
    for (const registro of pendientes) {
      try {
        await api.post('/insumos/consumo-diario', registro.payload);
        await eliminarPendiente(registro.id);
        sincronizados += 1;
      } catch (err) {
        // Sin respuesta del servidor (offline real): cortar el loop, seguimos sin red.
        if (!err.response) break;
        // Con respuesta (ej. 400 por datos ya obsoletos): registrar el intento y seguir con el resto.
        await marcarIntento(registro.id, registro);
      }
    }
  } finally {
    sincronizando = false;
  }

  const restantes = await contarPendientes();
  notificarCambio(restantes);
  return { sincronizados, restantes };
}

let inicializado = false;

// Se llama una sola vez (desde main.jsx) para dejar armados los disparadores
// automáticos de sincronización. Es seguro llamarla más de una vez.
export function iniciarSincronizacionAutomatica() {
  if (inicializado) return;
  inicializado = true;

  window.addEventListener('online', () => { intentarSincronizar(); });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'sicodiet:sync-consumos') intentarSincronizar();
    });
  }

  // Si ya había pendientes de una sesión anterior y arrancamos con conexión, sincronizar ya.
  if (navigator.onLine) intentarSincronizar();
  else contarPendientes().then(notificarCambio);
}

// Pide al Service Worker que intente Background Sync (mejora progresiva, no
// garantizada). El reintento real cuando vuelva la señal lo cubre igual el
// listener de "online" de arriba, incluso si esto no está soportado.
export async function registrarBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-consumos-pendientes');
  } catch {
    // No soportado o falló el registro -- no es crítico, el listener de "online" alcanza.
  }
}
