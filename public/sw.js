const CACHE_NAME = 'factorotc-v1';

// On install: skip waiting so the new SW activates immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// On activate: take control of all open tabs immediately
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first strategy: always try network, fall back to cache
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin navigation
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // API routes: network only, no cache
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        // Cache successful HTML/JS/CSS responses
        if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen for skipWaiting message from the client
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
