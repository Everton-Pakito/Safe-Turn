// sw.js — cache strategy: tiles cache-first, static network-first fallback
const CACHE_STATIC = 'safe-turn-static-v1';
const CACHE_TILES = 'tiles-cache-v1';

// Install: precache minimal app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll([
        '/', '/index.html', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/offline-tile.png'
      ]).catch(()=>{});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function isEsriTile(url){
  return /arcgisonline\.com.*\/tile\/\d+\/\d+\/\d+/i.test(url);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // If request is Esri tile pattern, try cache-first (from client precache)
  if (isEsriTile(req.url)){
    event.respondWith(
      caches.open(CACHE_TILES).then(async cache => {
        const cached = await cache.match(req.url);
        if (cached) return cached;
        try {
          const resp = await fetch(req);
          if (resp && resp.status === 200){
            try { cache.put(req.url, resp.clone()); } catch(e) { console.warn('cache put fail', e); }
            return resp;
          }
        } catch (e) {
          console.warn('tile fetch network failed', e);
        }
        // fallback offline tile
        const fallback = await caches.match('/offline-tile.png');
        if (fallback) return fallback;
        return new Response('', { status: 204, statusText: 'No tile' });
      })
    );
    return;
  }

  // If local static tiles path is requested (/tiles/...), let network handle (if you uploaded tiles) else fallback to cache
  if (url.pathname.startsWith('/tiles/')){
    event.respondWith(
      fetch(req).catch(()=> caches.match(req).then(c => c || new Response('', { status: 404 })))
    );
    return;
  }

  // Default: network-first for app shell, fallback to cache
  event.respondWith(
    fetch(req).then(response => response).catch(() => caches.match(req).then(cached => cached || caches.match('/index.html')))
  );
});