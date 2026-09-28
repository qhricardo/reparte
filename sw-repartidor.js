const CACHE_NAME = 'reparte-repartidor-v1';
const ASSETS = ['./repartidor.html', './manifest-repartidor.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});
