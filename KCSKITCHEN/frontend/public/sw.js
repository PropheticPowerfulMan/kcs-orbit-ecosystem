const CACHE = 'kcs-kitchen-shell-v3'
const SCOPE_PATH = new URL('./', self.location.href).pathname
const SHELL = [
  './',
  './manifest.webmanifest',
  './icons/kitchen-192.png',
  './icons/kitchen-512.png',
  './icons/kitchen-maskable-512.png',
  './icons/kitchen-apple-180.png',
  './images/kcs-logo.png'
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('kcs-kitchen-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH) || url.pathname.startsWith(SCOPE_PATH + 'api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./')))
    return
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) void caches.open(CACHE).then(cache => cache.put(request, response.clone()))
    return response
  })))
})
