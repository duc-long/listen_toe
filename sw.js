const CACHE_NAME = 'toeic-master-v1';
const ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/main.js',
  './data/tests.js',
  './logo.png'
];

// Install Event
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (evt) => {
  // Only cache GET requests
  if (evt.request.method !== 'GET') return;
  // Ignore audio files from cache to save space, let them load dynamically
  if (evt.request.url.includes('.mp3')) return;
  
  evt.respondWith(
    caches.match(evt.request).then(cacheRes => {
      return cacheRes || fetch(evt.request);
    })
  );
});
