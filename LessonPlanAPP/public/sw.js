const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/?$/, "/");
const CACHE_NAME = "kcs-eduplanner-v4-reliable-documents";
const APP_SHELL = [
  BASE_PATH,
  BASE_PATH + "index.html",
  BASE_PATH + "access-guard.js",
  BASE_PATH + "manifest.webmanifest",
  BASE_PATH + "kcs.jpg",
  BASE_PATH + "kcs-icon-192.png",
  BASE_PATH + "kcs-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("kcs-eduplanner-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  // Private API replies, authenticated data and PDF capabilities must never enter Cache Storage.
  if(request.headers.has('Authorization')||/\/(?:api|auth|rest)(?:\/|$)/.test(url.pathname)||/\.pdf$/i.test(url.pathname))return;
  const relative=url.pathname.slice(BASE_PATH.length);
  const staticAsset=APP_SHELL.includes(url.pathname)||/^assets\/[^?]+\.(?:js|css|png|jpe?g|webp|svg|woff2?|ttf)$/i.test(relative);
  if(request.mode!=='navigate'&&!staticAsset)return;


  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if(response.ok&&(response.headers.get('Content-Type')||'').includes('text/html')){
            const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(BASE_PATH,copy));
          }
          return response;
        })
        .catch(() => caches.match(BASE_PATH).then((response) => response || caches.match(BASE_PATH + "index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});