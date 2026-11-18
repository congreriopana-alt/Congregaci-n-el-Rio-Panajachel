/* Service worker: permite instalar la app y usarla sin internet.
   - La app, el mapa de territorios y la librería del mapa se guardan al instalar.
   - Las calles del fondo (OpenStreetMap) se guardan cada vez que se ven con internet. */
const CACHE = 'rio-v7';
const CACHE_MAPA = 'rio-mapa-v1';
const MAX_TILES = 3000;
const SHELL = ['./', 'index.html', 'publicadores/', 'publicadores/index.html', 'publicadores/manifest.json',
  'ancianos/', 'ancianos/index.html', 'ancianos/manifest.json',
  'styles.css', 'config.js', 'core.js', 'mapa.js', 'publicadores.js', 'ancianos.js',
  'territorios.geojson', 'lib/leaflet.js', 'lib/leaflet.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-encabezado.png', 'icons/admin-192.png', 'icons/admin-encabezado.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CACHE_MAPA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function recortarMapa() {
  const c = await caches.open(CACHE_MAPA);
  const ks = await c.keys();
  for (let i = 0; i < ks.length - MAX_TILES; i++) await c.delete(ks[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Calles del mapa: primero lo guardado, si no hay, internet (y se guarda).
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith(caches.open(CACHE_MAPA).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok) { c.put(req, r.clone()); recortarMapa(); }
        return r;
      } catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;
  // Archivos de la app: primero internet (lo más nuevo); sin internet, lo guardado.
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r ||
      caches.match(url.pathname.includes('/ancianos') ? 'ancianos/index.html' : 'publicadores/index.html')))
  );
});
