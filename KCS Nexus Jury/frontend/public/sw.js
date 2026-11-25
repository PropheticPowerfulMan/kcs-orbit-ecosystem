const PREFIX='kcs-nexus-jury-assets-';
const CACHE=PREFIX+'__JURY_VERSION__';
const FILES=/*__JURY_ASSETS__*/;
const BASE=new URL(self.registration.scope);
const ALLOWED=new Set(FILES.map(path=>new URL(path,BASE).href));
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(FILES.map(async file=>{const url=new URL(file,BASE);const response=await fetch(url,{credentials:'omit',cache:'reload'});if(!response.ok)throw Error('Jury shell unavailable');await cache.put(url,response.clone());}));})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_JURY_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname)||url.pathname.includes('/api/')||url.search||request.headers.has('authorization'))return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(async()=>{const cached=await caches.match(BASE.href,{cacheName:CACHE});return cached||new Response('Reconnect to open KCS Nexus Jury.',{status:503,headers:{'Content-Type':'text/plain'}});}));return;}if(!ALLOWED.has(url.href))return;event.respondWith((async()=>{const cached=await caches.match(url.href,{cacheName:CACHE});if(cached)return cached;const response=await fetch(request);if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(url.href,copy)));}return response;})());});
