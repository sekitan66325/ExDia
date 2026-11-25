const CACHE_PREFIX = "exdia-cache-";
const CACHE_NAME = "exdia-cache-v1.2.9-beta";

const CORE_SHELL_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./exdia-icon.svg",
  "./exdia-logo.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_SHELL_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNavigationOrManifest(request, url) {
  if (request.mode === "navigate") return true;
  if (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) return true;
  if (url.pathname.endsWith("/manifest.json")) return true;
  return false;
}

function isHashedBuildAsset(url) {
  return url.pathname.includes("/assets/");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const networkResponse = await fetch(request, { cache: "no-cache" });
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shellFallback = await cache.match("./index.html");
      if (shellFallback) return shellFallback;
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const networkResponse = await fetch(request);
  if (networkResponse && networkResponse.ok) {
    cache.put(request, networkResponse.clone());
  }
  return networkResponse;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => undefined);

  if (cached) {
    return cached;
  }
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (isNavigationOrManifest(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isHashedBuildAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
