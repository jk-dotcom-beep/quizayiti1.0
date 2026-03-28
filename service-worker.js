// QuizAyiti Service Worker - Version 3.0 (Offline-first, questions.json local)
const CACHE_NAME = 'quizayiti-v3';
const urlsToCache = [
  '/quizayiti1.0/',
  '/quizayiti1.0/index.html',
  '/quizayiti1.0/manifest.json',
  '/quizayiti1.0/questions.json',
  '/quizayiti1.0/icon-192.png',
  '/quizayiti1.0/icon-512.png'
];

const MESSAGES = {
  daily: [
    { title: "🧠 QuizAyiti t'attend !", body: "Ton défi du jour est prêt. Montre qui est le meilleur d'Ayiti !" },
    { title: "🔥 C'est l'heure de jouer !", body: "Tes rivaux s'entraînent en ce moment. Et toi ?" },
    { title: "⚡ Défi quotidien disponible !", body: "Réponds aux questions du jour et grimpe dans le classement !" },
    { title: "🏆 La compétition t'attend !", body: "Un seul quiz peut tout changer dans le classement. Lance-toi !" },
    { title: "💡 Apprends quelque chose aujourd'hui !", body: "QuizAyiti : apprendre en jouant, progresser chaque jour." },
    { title: "🎯 Objectif du jour !", body: "Fais un quiz parfait aujourd'hui et gagne des bonus !" }
  ],
  inactive3: [
    { title: "😢 QuizAyiti s'ennuie sans toi...", body: "3 jours sans jouer ! Tes points t'attendent toujours." },
    { title: "📉 Attention au classement !", body: "Tu n'as pas joué depuis 3 jours. Tes rivaux avancent !" }
  ],
  inactive7: [
    { title: "🚨 Tu nous manques !", body: "7 jours d'absence... Reviens défendre ta place !" },
    { title: "⏰ Il n'est pas trop tard !", body: "Tes badges et points t'attendent. Reviens jouer !" }
  ]
};

function getRandomMessage(type) {
  const list = MESSAGES[type];
  return list[Math.floor(Math.random() * list.length)];
}

// INSTALLATION
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).catch(err => console.log('[SW] Cache err:', err))
  );
  self.skipWaiting();
});

// ACTIVATION - Supprimer anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
    ))
  );
  self.clients.claim();
});

// FETCH - Offline-first pour fichiers locaux, network-first pour Firebase
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase, gstatic → toujours réseau (pas de cache)
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic')) return;

  // questions.json → network-first pour avoir les mises à jour, fallback cache
  if (url.pathname.includes('questions.json')) {
    event.respondWith(
      fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Autres fichiers → cache-first
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      }).catch(() => caches.match('/quizayiti1.0/'));
    })
  );
});

// MESSAGES DEPUIS L'APP
self.notifData = null;
self.lastNotifDate = 0;

self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    self.notifData = event.data;
    checkAndSendNotification();
  }
});

// ENVOYER NOTIFICATION RAPPEL
async function checkAndSendNotification() {
  const data = self.notifData;
  if (!data) return;

  const now = Date.now();
  const lastPlayed = data.lastPlayed ? new Date(data.lastPlayed).getTime() : 0;
  const daysSince = lastPlayed ? Math.floor((now - lastPlayed) / 86400000) : 999;
  const hoursSinceLast = (now - self.lastNotifDate) / 3600000;

  if (hoursSinceLast < 20) return;

  let msg = null;
  if (daysSince >= 7) msg = getRandomMessage('inactive7');
  else if (daysSince >= 3) msg = getRandomMessage('inactive3');
  else if (daysSince >= 1) msg = getRandomMessage('daily');

  if (msg) {
    await self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: '/quizayiti1.0/icon-192.png',
      badge: '/quizayiti1.0/icon-192.png',
      tag: 'quizayiti-reminder',
      vibrate: [200, 100, 200],
      data: { url: '/quizayiti1.0/' }
    });
    self.lastNotifDate = now;
  }
}

// CLIC → OUVRE L'APP
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/quizayiti1.0/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('quizayiti') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// PUSH (compatible FCM futur)
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'QuizAyiti', {
      body: data.body || '',
      icon: '/quizayiti1.0/icon-192.png',
      badge: '/quizayiti1.0/icon-192.png',
      data: { url: '/quizayiti1.0/' }
    })
  );
});
