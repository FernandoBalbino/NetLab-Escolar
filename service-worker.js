const CACHE_VERSION = 'netlab-offline-v13';
const CACHE_PREFIX = 'netlab-offline-';

const CORE_FILES = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './precache-manifest.json',
  './service-worker.js'
];

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function getPrecacheUrls() {
  const response = await fetch(scopedUrl('./precache-manifest.json'), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao carregar o manifesto de cache: ${response.status}`);
  const projectFiles = await response.json();
  return [...new Set([...CORE_FILES, ...projectFiles])].map(scopedUrl);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    getPrecacheUrls()
      .then((urls) => caches.open(CACHE_VERSION).then((cache) => cache.addAll(urls)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);
  const isInternal = requestUrl.origin === scopeUrl.origin && requestUrl.pathname.startsWith(scopeUrl.pathname);
  if (!isInternal) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(event.request, { ignoreSearch: true }))
            || (await caches.match(scopedUrl('./index.html'), { ignoreSearch: true }))
            || caches.match(scopedUrl('./offline.html'), { ignoreSearch: true });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
