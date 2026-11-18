/* Service worker: permite instalar la app y abrirla sin conexión */
const CACHE = 'rio-v1';
const SHELL = ['./', 'index.html', 'ancianos.html', 'styles.css', 'config.js', 'core.js', 'publicadores.js', 'ancianos.js',
  'manifest.json', 'manifest-ancianos.json', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/admin-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red (para ver siempre lo más nuevo); si no hay internet, lo guardado.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
