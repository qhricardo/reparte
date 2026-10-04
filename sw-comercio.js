const CACHE_NAME = 'reparte-comercio-v8'; // Incrementamos la versión de la caché

const BASE_PATH = self.registration.scope;
const APP_URL = new URL('comercio.html', BASE_PATH).href;
const ICON_URL = new URL('icon.png', BASE_PATH).href; 

// 1. Instalación robusta
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usar catch para evitar que un fallo de caché cierre la app
      return cache.addAll([APP_URL, ICON_URL]).catch((err) => {
        console.error('Error precachando recursos PWA:', err);
      });
    })
  );
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

// 3. Estrategia Network First segura
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (!url.protocol.startsWith('http') || url.hostname.includes('supabase') || e.request.method !== 'GET') {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response && response.status === 200) {
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
        return new Response('Sin conexión a internet', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

// 4. Badges
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_BADGE' && 'setAppBadge' in navigator) {
    navigator.setAppBadge(event.data.count || 1).catch(() => {});
  } else if (event.data?.type === 'CLEAR_BADGE' && 'clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }
});

// 5. Push Notifications
self.addEventListener('push', (event) => {
  let title = "🛍️️ ¡Nuevo Pedido Recibido!";
  let body = "Tienes una nueva orden en tu comercio.";

  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      body = payload.body || body;
    } catch (err) {
      body = event.data.text();
    }
  }

  const options = {
    body: body,
    icon: ICON_URL,
    badge: ICON_URL,
    vibrate: [200, 100, 200, 100, 200],
    tag: 'pedido-' + Date.now(),
    renotify: true,
    data: { url: APP_URL }
  };

  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 6. Clic en Notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || APP_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.includes('comercio.html')) {
          client.focus();
          return 'navigate' in client ? client.navigate(targetUrl) : null;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
