/* Service Worker — Parc Auto DRT Sfax */
// Avec la stratégie "réseau d'abord" ci-dessous, il n'est plus indispensable
// d'incrémenter ce numéro à chaque déploiement — le cache se met à jour tout
// seul dès qu'un fichier est fetché avec succès. Tu peux quand même
// l'incrémenter de temps en temps si tu veux forcer un nettoyage complet du
// cache (ex: après un gros ménage de fichiers renommés/supprimés).
const CACHE_NAME = 'parc-auto-v2';
const ASSETS = ['/', '/index.html', '/admin.html', '/app.js', '/demande_travaux_v2.js', '/styles.css', '/icon-192.png', '/icon-512.png'];

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
  // Ne pas intercepter les requêtes non-GET (POST/PATCH vers le Worker cloud)
  // ni les requêtes cross-origin (API externes)
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) {
    return; // laisser passer normalement, sans passer par le cache
  }

  // BLOC ADDITIF — Stratégie "réseau d'abord, cache en secours"
  // Remplace l'ancienne stratégie "cache d'abord" : on essaie toujours le
  // réseau en premier pour obtenir la dernière version des fichiers (app.js,
  // demande_travaux_v2.js, index.html...), et on met à jour le cache à chaque
  // succès. Le cache ne sert que si le réseau échoue (mode hors-ligne) ou est
  // trop lent. Avantage : plus besoin d'incrémenter CACHE_NAME à chaque
  // déploiement pour que les appareils voient les mises à jour.
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(e.request);
        // Ne mettre en cache que les réponses valides (évite de cacher des 404/erreurs)
        if (networkResponse && networkResponse.ok) {
          cache.put(e.request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch (err) {
        const cached = await cache.match(e.request);
        return cached || Response.error();
      }
    })()
  );
  // FIN BLOC ADDITIF
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
