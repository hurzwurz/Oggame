// Service Worker für NEXARION (PWA, Offline-Fähigkeit).
// Strategie: Network-First für eigene GET-Anfragen, Fallback auf Cache.
// So bleibt die App aktuell (neue Deploys greifen sofort) und funktioniert
// trotzdem offline. Fremde Hosts (Supabase/CDN) werden nicht angefasst.

const CACHE = 'nexarion-v1';

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
  if (url.origin !== self.location.origin) return; // nur eigene Dateien cachen

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match('index.html')))
  );
});
