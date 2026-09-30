const CACHE_NAME = 'reparte-admin-v6';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.hostname.includes('supabase') || e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        if (response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

// Manejar la notificación entrante en segundo plano (pantalla bloqueada)
self.addEventListener('push', (event) => {
  let data = { title: 'Reparte Admin', body: '🛒 ¡Nuevo Pedido Recibido!' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // Activar el badge 1 en el icono
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(1).catch(() => {});
  }

  const options = {
    body: data.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: './index.html' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Limpiar badge al tocar la notificación
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ((client.url.includes('index.html') || client.url.endsWith('/')) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
