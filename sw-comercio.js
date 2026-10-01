const CACHE_NAME = 'reparte-comercio-v5';

// Usamos self.registration.scope para construir rutas dinámicas y evitar errores 404 en subdirectorios
const BASE_PATH = self.registration.scope;
const APP_URL = new URL('comercio.html', BASE_PATH).href;
const ICON_URL = new URL('https://cdn-icons-png.flaticon.com/512/2981/2981312.png', BASE_PATH).href;

// 1. Instalación del Service Worker (Precarga del HTML principal)
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([APP_URL]);
    })
  );
});

// 2. Activación: Limpieza de cachés antiguas y toma de control inmediata
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// 3. Estrategia de Caché: Network First con fallback a Caché dinámico
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
      .catch(async () => {
        const cachedResponse = await caches.match(e.request);
        if (cachedResponse) return cachedResponse;
        
        // Si falla la red y es una navegación HTML, retornar la app precachada (evita 404 en iOS)
        if (e.request.mode === 'navigate') {
          return caches.match(APP_URL);
        }
      })
  );
});

// 4. Escuchar mensajes internos para Badges
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(event.data.count || 1).catch(() => {});
    }
  } else if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});

// ==========================================
// PASO 5: MANEJO DE NOTIFICACIONES PUSH EN SEGUNDO PLANO (PWA / iOS)
// ==========================================

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
    icon: ICON_URL,
    badge: ICON_URL,
    vibrate: [200, 100, 200, 100, 200],
    tag: 'pedido-' + Date.now(),
    renotify: true,
    data: {
      url: APP_URL
    }
  };

  if ('setAppBadge' in navigator) {
    navigator.setAppBadge(1).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manejar clic sobre la notificación Push
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || APP_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. Si la ventana ya está abierta (incluso en segundo plano), enfocarla y navegar
      for (const client of clientList) {
        if ('focus' in client && client.url.includes('comercio.html')) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // 2. Si está completamente cerrada, abrir nueva ventana con la URL dinámica correcta
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
