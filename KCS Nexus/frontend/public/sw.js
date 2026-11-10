const CACHE_NAME = 'kcs-nexus-shell-teacher-reports-certificates-20261110-v10'
const SIBLING_APP_PREFIXES = ['/kitchen/', '/sentinel/', '/academy/', '/eduplanner/', '/edupay/', '/savanex/']

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('kcs-nexus-shell-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ne pas intercepter les applications indépendantes.
  if (
    url.origin === self.location.origin &&
    SIBLING_APP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return;
  }

  // Ne jamais mettre les API en cache.
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  // Navigation : toujours privilégier la version réseau.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();

            event.waitUntil(
              caches.open(CACHE_NAME)
                .then((cache) => cache.put('./', copy))
                .catch((error) => {
                  console.error('[KCS SW] Navigation cache error:', error);
                })
            );
          }

          return response;
        })
        .catch(async () => {
          return (await caches.match('./')) ||
            new Response('Application temporairement indisponible.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
        })
    );

    return;
  }

  // Ressources statiques : cache prioritaire, puis réseau.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          // Cloner immédiatement, avant toute opération asynchrone.
          const copy = response.clone();

          event.waitUntil(
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch((error) => {
                console.error('[KCS SW] Resource cache error:', error);
              })
          );
        }

        return response;
      });
    })
  );
});
