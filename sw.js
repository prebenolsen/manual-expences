const CACHE = 'utgifter-v1';
const ASSETS = [
  '/manual-expences/',
  '/manual-expences/index.html',
  '/manual-expences/app.js',
  '/manual-expences/config.js',
  '/manual-expences/style.css',
  '/manual-expences/manifest.json',
  '/manual-expences/env.js',
  '/manual-expences/icons/icon-192.png',
  '/manual-expences/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co') || e.request.url.includes('jsdelivr.net')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
