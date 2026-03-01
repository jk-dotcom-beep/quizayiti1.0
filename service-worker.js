// QuizAyiti Service Worker - Version 2.0 (Notifications intelligentes)
const CACHE_NAME = 'quizayiti-v2';
const urlsToCache = [
  '/quizayiti1.0/',
  '/quizayiti1.0/index.html',
  '/quizayiti1.0/manifest.json',
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
  ],
  newQuestions: [
    { title: "🆕 Nouvelles questions disponibles !", body: "De nouvelles questions ont été ajoutées. Teste tes connaissances !" }
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

// ACTIVATION
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => Promise.all(
      names.map(name => name !== CACHE_NAME ? caches.delete(name) : null)
    ))
  );
  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic')) return;
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
    checkNewQuestions(event.data.lastQuestionsCount);
    checkAndSendNotification();
  }
});

// VÉRIFIER NOUVELLES QUESTIONS
async function checkNewQuestions(lastCount) {
  if (!lastCount || lastCount === 0) return;
  try {
    const SPREADSHEET_ID = '1exBmy58PSeStY04L9-j3YHgrfnbVSYwB9Aw0cQ95FKI';
    const API_KEY = 'AIzaSyA125rJg-7CExfMd9LePRGAQwS4bHMWoDQ';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Questions!A:A?key=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    const currentCount = data.values ? data.values.length - 1 : 0;
    if (currentCount > lastCount) {
      const msg = getRandomMessage('newQuestions');
      await self.registration.showNotification(msg.title, {
        body: msg.body,
        icon: '/quizayiti1.0/icon-192.png',
        badge: '/quizayiti1.0/icon-192.png',
        tag: 'new-questions',
        vibrate: [200, 100, 200],
        data: { url: '/quizayiti1.0/' }
      });
    }
  } catch(e) { console.log('[SW] Vérif questions:', e); }
}

// ENVOYER NOTIFICATION RAPPEL
async function checkAndSendNotification() {
  const data = self.notifData;
  if (!data) return;

  const now = Date.now();
  const lastPlayed = data.lastPlayed ? new Date(data.lastPlayed).getTime() : 0;
  const daysSince = lastPlayed ? Math.floor((now - lastPlayed) / 86400000) : 999;
  const hoursSinceLast = (now - self.lastNotifDate) / 3600000;

  // Max 1 notification toutes les 20h
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

// PUSH (compatible FCM/OneSignal futur)
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
