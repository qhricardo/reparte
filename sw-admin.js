const CACHE_NAME = 'reparte-admin-v4';

// 1. Instalación e Invocación Inmediata
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// 2. Manejo de Peticiones y Caché (Network First)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Filtrar solo peticiones HTTP/HTTPS (ignora chrome-extension:// y esquemas propios)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Ignorar peticiones a Supabase y peticiones que no sean GET
  if (url.hostname.includes('supabase') || e.request.method !== 'GET') {
    return;
  }

  // Estrategia Network First con fallback a Cache
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Solo guardar en caché respuestas válidas (código 200)
        if (response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// 3. Manejar interacciones con Notificaciones Nativas en Móviles
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la app PWA ya está abierta, enfocarla
      for (const client of clientList) {
        if ((client.url.includes('index.html') || client.url.endsWith('/')) && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no está abierta, abrir una nueva ventana con el panel
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
