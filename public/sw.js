const CACHE_NAME = 'factorotc-v2';

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
        // Cache successful HTML responses only
        if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() =>
        // Try cache first; if not cached return a proper offline response
        // (never return undefined — that causes a TypeError in Safari)
        caches.match(event.request).then(cached =>
          cached ?? new Response('Sense connexió. Torna-ho a intentar.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        )
      )
  );
});

// Listen for skipWaiting message from the client
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
