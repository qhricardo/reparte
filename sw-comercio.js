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
// MANEJO DE NOTIFICACIONES PUSH EN SEGUNDO PLANO (iOS / PWA)
// ==========================================

// 1. Escuchar evento Push
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

  // Opciones ajustadas específicamente para el motor WebPush de iOS Safari
  const options = {
    body: body,
    icon: '/icon-192.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200, 100, 200],
    // Tag único indispensable para obligar a iOS a mostrar tiras emergentes en segundo plano
    tag: 'pedido-' + Date.now(),
    renotify: true,
    data: {
      url: '/comercio.html'
    }
  };

  // Intentar actualizar el Badge del ícono sin bloquear la notificación
  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(() => {});
  }

  // La promesa enviada a waitUntil debe ser directa y limpia
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 2. Manejar clic sobre la notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || '/comercio.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si la PWA ya está abierta, enfocarse en ella
      for (const client of clientList) {
        if (client.url.includes('comercio.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si está cerrada en segundo plano, abrir la PWA
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
