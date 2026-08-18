// Service Worker de Sicodiet — cache-first para assets estáticos, network-first
// para la API (con fallback a cache para poder mostrar la última data conocida
// sin conexión). El registro de consumos offline NO se maneja acá: esa cola vive
// en IndexedDB manejada desde la página (ver src/utils/offlineQueue.js) porque
// necesita acceso a la lógica de negocio (armar el payload) que ya vive ahí, y
// porque el reintento por evento "online" funciona en todos los browsers, a
// diferencia de la Background Sync API (sin soporte en Firefox/Safari). Este SW
// solo se suma como mejora progresiva: si el navegador soporta background sync,
// intenta despertar a una pestaña abierta para que dispare la sincronización.

const CACHE_VERSION = 'sicodiet-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith('sicodiet-') && !nombre.startsWith(CACHE_VERSION))
          .map((nombre) => caches.delete(nombre))
      );
      await self.clients.claim();
    })()
  );
});

function esAssetEstatico(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cacheado = await cache.match(request);
  if (cacheado) return cacheado;

  const respuesta = await fetch(request);
  if (respuesta.ok) cache.put(request, respuesta.clone());
  return respuesta;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) cache.put(request, respuesta.clone());
    return respuesta;
  } catch (err) {
    const cacheado = await cache.match(request);
    if (cacheado) return cacheado;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación (recargar la SPA estando offline): guarda cada visita exitosa como
  // "shell" y la sirve si no hay red -- así no depende de un precache fijo.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        try {
          const respuesta = await fetch(event.request);
          if (respuesta.ok) cache.put('/index.html', respuesta.clone());
          return respuesta;
        } catch (err) {
          const shell = await cache.match('/index.html');
          return shell || Response.error();
        }
      })()
    );
    return;
  }

  if (esAssetEstatico(url)) {
    event.respondWith(cacheFirst(event.request, STATIC_CACHE));
    return;
  }

  // Solo GET a la API se cachea (network-first); POST/PUT/DELETE pasan directo --
  // esos fallos los maneja la cola de IndexedDB del lado de la página.
  if (url.pathname.startsWith('/api/') && event.request.method === 'GET') {
    event.respondWith(networkFirst(event.request, API_CACHE));
  }
});

// Mejora progresiva: si el browser soporta Background Sync y el SW se despierta
// con la tag 'sync-consumos-pendientes', avisale a cualquier pestaña abierta que
// intente sincronizar ahora mismo (la cola y el POST real viven en la página).
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-consumos-pendientes') {
    event.waitUntil(
      (async () => {
        const clientes = await self.clients.matchAll({ type: 'window' });
        clientes.forEach((cliente) => cliente.postMessage({ type: 'sicodiet:sync-consumos' }));
      })()
    );
  }
});

// Push notifications (alertas de stock, recordatorio de consumo AM) -- el payload
// lo arma el backend (ver backend/src/utils/webpush.js), acá solo se muestra.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sicodiet', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/alertas' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = event.notification.data?.url || '/alertas';
      const clientes = await self.clients.matchAll({ type: 'window' });
      const existente = clientes.find((c) => c.url.includes(url));
      if (existente) return existente.focus();
      return self.clients.openWindow(url);
    })()
  );
});
