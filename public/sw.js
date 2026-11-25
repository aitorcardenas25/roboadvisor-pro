// Service worker de Factor OTC — només perquè l'app es pugui instal·lar (PWA).
//
// Abans interceptava totes les navegacions (fetch(event.request)) i desava l'HTML.
// A l'iPhone (WebKit, també dins del Gmail), quan la pàgina responia amb una
// redirecció (p. ex. /client/informe-inicial → inici de sessió), Safari rebutjava
// la resposta del service worker («Response served by service worker has
// redirections») i la pàgina quedava totalment en blanc. Ara no intercepta res:
// totes les peticions van directes a la xarxa, i en activar-se esborra la memòria
// cau antiga.
const CACHE_VERSION = 'factorotc-v3-sense-cache';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// Sense controlador de 'fetch': el navegador fa totes les peticions ell mateix.
void CACHE_VERSION;
