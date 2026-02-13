// QuizAyiti Service Worker - Version 1.0
const CACHE_NAME = 'quizayiti-v1';
const urlsToCache = [
  '/quizayiti1.0/',
  '/quizayiti1.0/index.html',
  '/quizayiti1.0/manifest.json',
  '/quizayiti1.0/icon-192.png',
  '/quizayiti1.0/icon-512.png'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Mise en cache des fichiers');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('[Service Worker] Erreur de cache:', err);
      })
  );
  self.skipWaiting();
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activation...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie Cache First pour les ressources statiques
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes vers Firebase et Google Sheets
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(response => {
        // Cache hit - retourner la réponse du cache
        if (response) {
          console.log('[Service Worker] Cache hit:', request.url);
          return response;
        }

        // Sinon, faire la requête réseau
        console.log('[Service Worker] Fetch réseau:', request.url);
        return fetch(request)
          .then(response => {
            // Vérifier si on a reçu une réponse valide
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Cloner la réponse
            const responseToCache = response.clone();

            // Mettre en cache
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(err => {
            console.log('[Service Worker] Fetch échoué:', err);
            // Retourner une page offline si disponible dans le cache
            return caches.match('/quizayiti1.0/');
          });
      })
  );
});

// Message du Service Worker
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
