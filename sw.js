self.addEventListener("install", e => {
    e.waitUntil(
        caches.open("safe-turn-v1").then(cache => {
            return cache.addAll([
                "./",
                "./index.html",
                "./manifest.json",
                "./icons/icon-192.png",
                "./icons/icon-512.png",
                "./offline-tile.png"
            ]);
        })
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if (/tile|tile\.openstreetmap/i.test(request.url)) {
        event.respondWith(
            caches.open("tiles").then(cache =>
                fetch(request)
                    .then(response => {
                        cache.put(request, response.clone());
                        return response;
                    })
                    .catch(() => cache.match(request).then(res => res || caches.match("./offline-tile.png")))
            )
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cached =>
            cached || fetch(request).then(resp => {
                return caches.open("dynamic").then(cache => {
                    cache.put(request, resp.clone());
                    return resp;
                });
            })
        )
    );
});