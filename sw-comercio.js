const CACHE_NAME = 'reparte-comercio-v4';

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

// Escuchar notificaciones para actualizar el Badge en el icono
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(event.data.count || 1);
    }
  } else if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge();
    }
  }
});

// ==========================================
// PASO 3: MANEJO DE NOTIFICACIONES PUSH EN SEGUNDO PLANO / PWA
// ==========================================

// 1. Escuchar el evento Push que llega desde la Edge Function
self.addEventListener('push', (event) => {
  let title = "🛍️ ¡Nuevo Pedido Recibido!";
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
    icon: '/icon-192.png',     // Icono de la PWA
    badge: '/badge.png',       // Icono monocromático para barra de estado en Android
    vibrate: [200, 100, 200, 100, 200],
    tag: 'nuevo-pedido-comercio',
    renotify: true,
    data: {
      url: '/comercio.html'
    }
  };

  // Actualizar la placa del icono al recibir la notificación
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1);
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 2. Manejar el clic sobre la notificación Push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Limpiar el badge al hacer clic
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge();
  }

  const targetUrl = event.notification.data?.url || '/comercio.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la PWA/ventana ya está abierta, enfocarte en ella
      for (const client of clientList) {
        if (client.url.includes('comercio.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si está cerrada, abrir la URL en una nueva ventana/instancia de PWA
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
