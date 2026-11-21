/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = "re-finder-v3";
const ASSETS_TO_CACHE = [
	"/",
	"/index.html",
	"/main.js",
	"/styles.css",
	"/manifest.json",
	"/favicon.svg",
	"/favicon.png",
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
	if (event.request.method !== "GET") return;

	const { request } = event;
	const url = new URL(request.url);
	const isNavigation = request.mode === "navigate";

	if (url.origin === sw.location.origin && url.pathname.startsWith("/api/")) {
		event.respondWith(fetch(request));
		return;
	}

	if (isNavigation) {
		event.respondWith(
			fetch(request).catch(() => {
				return caches.match("/index.html").then((shell) => {
					return (
						shell ||
						new Response("Offline: App shell not found", {
							status: 503,
							headers: { "Content-Type": "text/plain" },
						})
					);
				});
			}),
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			const fetchPromise = fetch(request)
				.then((networkResponse) => {
					if (networkResponse?.ok) {
						const responseClone = networkResponse.clone();
						caches.open(CACHE_NAME).then((cache) => {
							cache.put(request, responseClone);
						});
					}
					return networkResponse;
				})
				.catch(() => {
					return (
						cachedResponse ||
						new Response("Network error occurred", {
							status: 408,
							headers: { "Content-Type": "text/plain" },
						})
					);
				});

			return cachedResponse || fetchPromise;
		}),
	);
});
