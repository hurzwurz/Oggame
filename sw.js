// Service Worker für NEXARION (PWA).
// WICHTIG: Holt eigene Dateien IMMER frisch vom Server (umgeht den HTTP-Cache),
// damit neue Deploys sofort ankommen. Cache dient nur als Offline-Fallback.

const CACHE = 'nexarion-v17';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // nur eigene Dateien

  // Bilder/Assets: CACHE-FIRST (einmal laden, dann blitzschnell aus dem Cache).
  // Verhindert, dass große PNGs bei jedem Neuzeichnen neu geladen werden.
  if (/\.(png|jpg|jpeg|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
      )
    );
    return;
  }

  // App-Dateien (HTML/JS/CSS): NETWORK-FIRST mit 'reload' -> neue Deploys sofort.
  event.respondWith(
    fetch(req, { cache: 'reload' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('index.html')))
  );
});
