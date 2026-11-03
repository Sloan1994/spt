/* SPT service worker. Bump CACHE_VERSION on every release. */
const CACHE_VERSION = 'v2.3.0-1';
const CACHE = 'spt-' + CACHE_VERSION;
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png', 'favicon-16.png', 'maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));   /* no skipWaiting: the app shows an update toast */
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('spt-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)(youtube-nocookie\.com|ytimg\.com|youtube\.com)$/.test(url.hostname)) return;   /* video: network only, never cached */
  if (url.hostname.endsWith('openfoodfacts.org')) {
    /* network first, cache only successful responses, fall back to cache when offline */
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then(r => r || Response.error())));
    return;
  }
  if (url.hostname.endsWith('jsdelivr.net')) {
    /* scanner library: cache-first after first successful load */
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  /* app shell: cache first. Navigations fall back to index.html offline. */
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
