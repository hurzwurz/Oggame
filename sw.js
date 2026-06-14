// Service Worker für NEXARION (PWA).
// WICHTIG: Holt eigene Dateien IMMER frisch vom Server (umgeht den HTTP-Cache),
// damit neue Deploys sofort ankommen. Cache dient nur als Offline-Fallback.

const CACHE = 'nexarion-v4';

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

  event.respondWith(
    // 'reload' = Browser-HTTP-Cache komplett umgehen -> immer aktuelle Datei
    fetch(req, { cache: 'reload' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('index.html')))
  );
});
