/* ═══════════════════════════════════════════
   SCS Service Worker — Push Notifications + Offline PWA Cache
═══════════════════════════════════════════ */

const SCS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='36' fill='%23080808'/%3E%3Ctext x='96' y='125' text-anchor='middle' font-family='Georgia,serif' font-size='90' font-weight='700' fill='%23c9a84c'%3E§%3C/text%3E%3C/svg%3E";
const CACHE_NAME = 'scs-cache-v8';
const urlsToCache = [
  '/Mf/',
  '/Mf/index.html',
  '/Mf/styles.css',
  '/Mf/app.js',
  '/Mf/notifications.js',
  '/Mf/admin.html',
  '/Mf/admin.css',
  '/Mf/admin.js',
  '/Mf/mapa.html',
  '/Mf/mapa.css',
  '/Mf/mapa.js',
  '/Mf/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // If it's an API request or external URL (supabase, fonts), skip cache
  if (e.request.url.includes('supabase.co') || e.request.url.includes('google') || e.request.url.includes('gstatic') || e.request.url.includes('openlibrary')) {
    return;
  }
  // Network-first strategy: always try fresh, fall back to cache for offline
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Update cache with fresh response
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    self.registration.showNotification(title, {
      body: body,
      icon: SCS_ICON,
      badge: SCS_ICON,
      tag: tag || 'scs-' + Date.now(),
      vibrate: [100, 50, 100],
      requireInteraction: false,
      actions: [{ action: 'open', title: 'Abrir SCS' }, { action: 'dismiss', title: 'Cerrar' }]
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/Mf/') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/Mf/');
    })
  );
});
