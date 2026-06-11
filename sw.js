/* Service Worker — Parc Auto DRT Sfax */
const CACHE_NAME = 'parc-auto-v1';
const ASSETS = ['/', '/index.html', '/admin.html', '/app.js', '/styles.css', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: '🚨 Parc Auto DRT Sfax', body: 'Nouvelle alerte' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'parc-alert',
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/admin.html'));
});

// 🔧 FIX: Gestionnaire de messages pour éviter l'erreur Chrome
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
