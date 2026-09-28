const CACHE_NAME = 'reparte-comercio-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // 1. Filtrar solo peticiones HTTP/HTTPS (ignora chrome-extension://)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 2. Ignorar peticiones a Supabase y peticiones que no sean GET
  if (url.hostname.includes('supabase') || e.request.method !== 'GET') {
    return;
  }

  // 3. Estrategia Network First con fallback a Cache
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
