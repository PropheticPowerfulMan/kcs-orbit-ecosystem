const CACHE_NAME = 'kcs-nexus-shell-school-documents-20261121-v50'
const SIBLING_APP_PREFIXES = ['/kitchen/', '/sentinel/', '/academy/', '/eduplanner/', '/edupay/', '/savanex/']

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => (cacheName.startsWith('kcs-nexus-shell-') || cacheName.startsWith('kcs-nexus-senior-teacher-')) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Ne pas intercepter les applications indÃ©pendantes.
  if (
    url.origin === self.location.origin &&
    SIBLING_APP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    return;
  }

  // A PDF is a document, never the application shell. Cache only complete PDFs.
  if (url.origin === self.location.origin && ((url.pathname.includes('/documents/handbooks/') && url.pathname.endsWith('.pdf')) || /^\/(?:nexus\/)?api\/school-documents\/files\/[a-f0-9-]{36}$/.test(url.pathname))) {
    if (request.headers.has('range')) return;
    event.respondWith(fetch(request).then((response) => {
      if (response.status === 200 && response.headers.get('Content-Type')?.includes('application/pdf')) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => undefined));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || new Response('Manuel indisponible hors connexion. Reconnectez-vous puis réessayez. / Handbook unavailable offline. Please reconnect and retry.', {status: 503})));
    return;
  }

  // Ne jamais mettre les API en cache.
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/')
  ) {
    return;
  }

  // Navigation : toujours privilÃ©gier la version rÃ©seau.
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

  // Ressources statiques : cache prioritaire, puis rÃ©seau.
  // Public images may be replaced by the school; always revalidate them online.
  if (url.pathname.startsWith('/images/')) {
    event.respondWith(fetch(request, {cache:'no-cache'}).then(response => {
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(request,copy)).catch(()=>undefined))}
      return response
    }).catch(async()=>await caches.match(request)||new Response('Image unavailable',{status:503})));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (response.ok) {
          // Cloner immÃ©diatement, avant toute opÃ©ration asynchrone.
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
