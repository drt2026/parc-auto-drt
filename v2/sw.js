const CACHE_NAME = 'parc-auto-tt-v1';
const urlsToCache = [
  '/parc-auto-drt/',
  '/parc-auto-drt/index.html',
  '/parc-auto-drt/style.css',
  '/parc-auto-drt/logo-192.png',
  '/parc-auto-drt/logo-512.png'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Stratégie Cache First
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseToCache));
            return response;
          });
      })
  );
});

// Notifications Push
self.addEventListener('push', event => {
  const title = 'Parc Auto TT Sfax';
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification',
    icon: 'logo-192.png',
    badge: 'logo-192.png',
    tag: 'parc-auto-notification',
    requireInteraction: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/parc-auto-drt/')
  );
});