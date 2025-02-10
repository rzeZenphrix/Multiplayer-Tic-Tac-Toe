// Add basic service worker for PWA
const CACHE_NAME = 'tic-tac-toe-v1';
const urlsToCache = [
  '/',
  '/styles.css',
  '/script.js',
  '/favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
}); 