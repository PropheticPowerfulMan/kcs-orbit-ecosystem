const CACHE_NAME = 'kcs-nexus-shell-v3'
const SHELL = ['./', './manifest.webmanifest', './icons/nexus-192.png', './icons/nexus-512.png', './icons/nexus-apple-180.png']
const SIBLING_APP_PREFIXES = ['/kitchen/', '/sentinel/', '/academy/', '/eduplanner/', '/edupay/', '/savanex/']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('kcs-nexus-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Nexus is installed from the domain root, but it must never serve its shell
  // for another KCS application hosted under a dedicated path.
  if (url.origin === self.location.origin && SIBLING_APP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('./', copy))
          return response
        })
        .catch(() => caches.match('./'))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      return response
    }))
  )
})
