// Service Worker — offline shell + cache-bust for app shell
const CACHE = 'alaric-voice-v1';
const SHELL = [
  '/alaric-voice/',
  '/alaric-voice/index.html',
  '/alaric-voice/app.js',
  '/alaric-voice/styles.css',
  '/images/alaricai-logo.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Don't cache TTS or API calls
  if (url.pathname.includes('/api/tts') || url.pathname.includes('/zo/ask')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((resp) => {
        if (resp.ok && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
