/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = "re-finder-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/app.js",
  "/styles.css",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

sw.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
  sw.skipWaiting();
});

sw.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
    }),
  );
  sw.clients.claim();
});

sw.addEventListener("fetch", (event: FetchEvent) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Stale-While-Revalidate for app assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Cache the new response if it's valid (status 200-299)
          if (networkResponse?.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails and we have a cached version, return it
          if (cachedResponse) return cachedResponse;

          // Final fallback: return a generic offline response
          return new Response("Network error occurred", {
            status: 408, // Request Timeout
            headers: { "Content-Type": "text/plain" },
          });
        });

      // Return the cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    }),
  );
});
