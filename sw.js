// sw.js — service worker prioritizando tiles cache-first
const CACHE_STATIC = 'safe-turn-static-v1';
const CACHE_TILES = 'tiles-cache-v1';

// Precaching minimal static assets on install
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

// helper to detect Esri tile urls (tile/{z}/{y}/{x})
function isEsriTile(url){
  return /arcgisonline\.com.*\/tile\/\d+\/\d+\/\d+/i.test(url);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // If request is to Esri tile service -> try cache first for that exact provider URL
  if (isEsriTile(req.url)){
    event.respondWith(
      caches.open(CACHE_TILES).then(async cache => {
        const cached = await cache.match(req.url);
        if (cached) return cached;
        try {
          const netResp = await fetch(req);
          if (netResp && netResp.status === 200){
            try { cache.put(req.url, netResp.clone()); } catch(e){ console.warn('cache put fail', e); }
            return netResp;
          }
        } catch (e) {
          console.warn('tile network failed', e);
        }
        const fallback = await caches.match('/offline-tile.png');
        if (fallback) return fallback;
        return new Response('', { status: 204, statusText: 'No tile' });
      })
    );
    return;
  }

  // If request is for local /tiles/... -> let network serve static file or fallback to cache (useful if you pre-uploaded tiles)
  if (url.pathname.startsWith('/tiles/')){
    event.respondWith(
      fetch(req).catch(()=> caches.match(req).then(c=> c || new Response('', { status:404 })))
    );
    return;
  }

  // default: network-first fallback to cache static
  event.respondWith(
    fetch(req).then(response => {
      // optionally cache dynamically: skip for large resources
      return response;
    }).catch(()=> caches.match(req).then(cached => cached || caches.match('/index.html')))
  );
});