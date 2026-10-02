const CACHE_NAME = 'reparte-repartidor-v5';

const BASE_PATH = self.registration.scope;
const APP_URL = new URL('repartidor.html', BASE_PATH).href;
const ICON_URL = new URL('icon.png', BASE_PATH).href;

// 1. Instalación
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// 2. Activación
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => key !== CACHE_NAME && caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estrategia Network First con fallback a Cache
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Filtrar solo peticiones HTTP/HTTPS (ignora chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Ignorar peticiones a Supabase y peticiones que no sean GET
  if (url.hostname.includes('supabase') || e.request.method !== 'GET') {
    return;
  }

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
      .catch(async () => {
        const cachedResponse = await caches.match(e.request);
        if (cachedResponse) return cachedResponse;
        if (e.request.mode === 'navigate') {
          return caches.match(APP_URL);
        }
      })
  );
});

// 4. Manejo de Badges
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_BADGE' && 'setAppBadge' in navigator) {
    navigator.setAppBadge(event.data.count || 1).catch(() => {});
  } else if (event.data?.type === 'CLEAR_BADGE' && 'clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
});

// 5. Recepción de Notificaciones Push
self.addEventListener('push', (event) => {
  console.log('📬 Evento Push interceptado en el Service Worker:', event);

  let title = "🛵 ¡Nuevo Pedido en el Radar!";
  let body = "Hay un pedido listo para entregar.";
  let payloadData = {};

  if (event.data) {
    try {
      payloadData = event.data.json();
      title = payloadData.title || title;
      body = payloadData.body || body;
    } catch (err) {
      body = event.data.text();
    }
  }

  const options = {
    body: body,
    icon: ICON_URL,
    badge: ICON_URL,
    vibrate: [200, 100, 200, 100, 200],
    tag: 'pedido-repartidor-' + Date.now(),
    renotify: true,
    requireInteraction: true, // Mantiene la notificación visible hasta que el repartidor interactúe
    data: {
      url: payloadData.url || APP_URL
    }
  };

  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(() => {});
  }

  // Notificar a las pestañas activas si la pantalla está abierta
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({
          type: 'NUEVO_PEDIDO_PUSH',
          title: title,
          body: body
        });
      });

      // Muestra la notificación nativa en el sistema
      return self.registration.showNotification(title, options);
    })
  );
});

// 6. Clic en la Notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || APP_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.includes('repartidor.html')) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
