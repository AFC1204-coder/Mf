/* ═══════════════════════════════════════════
   SCS Service Worker — Push Notifications
   Minimal: only handles push + notification click
   No caching (GitHub Pages handles that)
═══════════════════════════════════════════ */

const SCS_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='36' fill='%23080808'/%3E%3Ctext x='96' y='125' text-anchor='middle' font-family='Georgia,serif' font-size='90' font-weight='700' fill='%23c9a84c'%3E§%3C/text%3E%3C/svg%3E";

// Install — activate immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Receive push from the page via postMessage
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
      actions: [
        { action: 'open', title: 'Abrir SCS' },
        { action: 'dismiss', title: 'Cerrar' }
      ]
    });
  }
});

// Click on notification — open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes('/Mf/') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open it
      return self.clients.openWindow('/Mf/');
    })
  );
});
