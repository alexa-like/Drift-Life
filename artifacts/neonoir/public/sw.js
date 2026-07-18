const CACHE_NAME = 'neonoir-v1';
const PRECACHE = ['/', '/index.html', '/favicon.svg', '/favicon.ico', '/manifest.json'];
const STATIC_EXTENSIONS = /\.(?:js|css|png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf|eot)$/;

// Install: cache the shell, then activate immediately so updates are not blocked.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches and claim clients without forcing a reload.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from this origin.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls: always go to the network. Never cache or intercept.
  if (url.pathname.startsWith('/api/')) return;

  // Navigation (HTML pages): network-first, fallback to cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Static assets: stale-while-revalidate. Serve from cache quickly, then refresh in background.
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});
