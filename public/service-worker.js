const CACHE_NAME = 'watchvault-shell-v5';
const API_CACHE_NAME = 'watchvault-tmdb-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/favicon-32.png',
  '/apple-touch-icon.png',
  '/logo192.png',
  '/logo512.png',
  '/avatars/hero.svg',
  '/avatars/dreamer.svg',
  '/avatars/detective.svg',
  '/avatars/explorer.svg',
  '/avatars/action.svg',
  '/avatars/ghost.svg'
];

// Install event: Pre-cache standard shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(STATIC_ASSETS.map(asset => cache.add(asset)));
      // Production bundle names contain content hashes. Discover the current
      // scripts and styles from the shell instead of caching obsolete names.
      const shell = await cache.match('/index.html');
      if (shell) {
        const html = await shell.text();
        const bundleUrls = Array.from(html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css)(?:\?[^"\s]*)?)"/g))
          .map(match => new URL(match[1], self.location.origin))
          .filter(url => url.origin === self.location.origin);
        await Promise.allSettled(bundleUrls.map(url => cache.add(url.href)));
      }
    })
  );
  self.skipWaiting();
});

// Activate event: Sweep and clean up expired caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            console.log('[Service Worker] Deleting outdated cache key:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: Apply specific caching strategies
self.addEventListener('fetch', (event) => {
  // Only intercept HTTP/HTTPS (ignore chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Strategy A: TMDb API Queries (Network-First with Cache-Fallback)
  if (requestUrl.hostname.includes('api.themoviedb.org')) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) => {
        return fetch(event.request)
          .then((response) => {
            if (response.status === 200) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => {
            return cache.match(event.request).then((cachedResponse) => {
              if (cachedResponse) return cachedResponse;
              
              // If not found in cache and offline, return a friendly JSON response
              return new Response(
                JSON.stringify({
                  results: [],
                  success: false,
                  status_message: "Offline: This content isn't cached yet.",
                  page: 1
                }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            });
          });
      })
    );
    return;
  }

  // Cache public app assets and posters, leaving account/auth requests alone.
  if (requestUrl.origin !== self.location.origin && requestUrl.hostname !== 'image.tmdb.org') return;

  // Strategy B: App Shell Assets (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh version in the background to update the cache for future visits
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => { /* Silent ignore of background fetch failures */ });
        
        return cachedResponse;
      }

      // Return network response for non-cached files, fallback to index.html for React Router routing
      return fetch(event.request).then(async response => {
        if (response.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Skip waiting listener (for standard update workflows)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
