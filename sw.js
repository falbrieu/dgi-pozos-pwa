// Service worker minimo: solo cachea el "app shell" (html/css/js/manifest).
// Nunca cachea llamadas al backend (Apps Script) ni a Google - los datos y
// las imagenes de los pozos siempre requieren conexion, a proposito.
var CACHE_NAME = 'dgi-pozos-shell-v1';
var SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/wellIdValidator.js',
  './js/errorMessages.js',
  './manifest.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = event.request.url;
  if (url.indexOf('script.google.com') !== -1 || url.indexOf('accounts.google.com') !== -1) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
