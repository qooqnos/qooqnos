const CACHE_NAME = "phoenix-web-v20261012";
const STATIC_ASSETS = [
  "/",
  "/styles.css?v=20261012",
  "/dist/main.js?v=20261012",
  "/manifest.webmanifest",
  "/fonts/Vazirmatn-RD[wght].woff2",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isApi = pathname.startsWith("/api/")
    || pathname === "/health"
    || pathname === "/ready"
    || pathname === "/sitemap.xml"
    || pathname === "/robots.txt";

  if (isApi) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/")),
    );
    return;
  }

  // Network-First strategy to ensure fresh preview and avoid stale cached assets
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
