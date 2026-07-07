/* ShelfLife — sw.js
   Offline app shell: cache-first for the app's own files, network for the
   rest (fonts and the OCR engine still need a connection the first time).
   Relative paths keep this working at https://user.github.io/repo/. */
const CACHE = 'shelflife-v9';

const CORE = [
  './',
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/util.js',
  './js/config.js',
  './js/data/foods.js',
  './js/data/recipes.js',
  './js/data/stores.js',
  './js/db.js',
  './js/auth.js',
  './js/auth-cloud.js',
  './js/expiry.js',
  './js/nutrition.js',
  './js/nonfood.js',
  './js/inventory.js',
  './js/planner.js',
  './js/shopping.js',
  './js/receipt.js',
  './js/agent.js',
  './js/cartlink.js',
  './js/kroger.js',
  './js/views/views-common.js',
  './js/views/views-plan.js',
  './js/views/views-recipes.js',
  './js/views/views-shop.js',
  './js/views/views-pantry.js',
  './js/views/views-account.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Same-origin: cache-first, fall back to network, fall back to shell for navigations.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((hit) => {
        if (hit) return hit;
        return fetch(event.request)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            return res;
          })
          .catch(() => (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
      })
    );
  }
  // Cross-origin (fonts, CDN): try network, quietly fall back to cache if present.
  else {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
