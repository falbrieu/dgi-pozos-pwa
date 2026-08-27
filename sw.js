// Service worker del app shell (html/css/js/manifest/iconos).
//
// Estrategia: network-first con fallback a cache.
//   - Con conexion: se intenta la red primero, y la respuesta fresca
//     actualiza el cache. El usuario siempre ve la version mas reciente
//     sin depender de que alguien se acuerde de subir CACHE_NAME en cada
//     commit - eso ya causo tres bugs reales (ver docs/architecture.md),
//     porque la estrategia anterior (cache-first) exigia ese paso manual
//     para que un dispositivo con el SW ya instalado dejara de servir
//     archivos viejos.
//   - Sin conexion: se responde lo ultimo que haya en cache.
//
// Nunca se cachean llamadas a Apps Script ni a Google - los datos y las
// imagenes de los pozos siempre requieren conexion, a proposito (y de
// todas formas viajan por POST, que esta explicitamente excluido).

var CACHE_NAME = 'dgi-pozos-shell';
var SHELL_FILES = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/api.js',
  './js/wellIdValidator.js',
  './js/errorMessages.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

function isExternalApi(url) {
  return url.indexOf('script.google.com') !== -1 || url.indexOf('accounts.google.com') !== -1;
}

// Guardado detras de "typeof self !== 'undefined'" para poder hacer
// require() de este archivo desde Jest (Node no tiene "self") sin que
// intente registrar listeners de verdad. En el navegador/Service Worker
// "self" siempre existe, asi que el comportamiento real no cambia.
if (typeof self !== 'undefined') {
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
    if (event.request.method !== 'GET' || isExternalApi(event.request.url)) {
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || Response.error();
          });
        })
    );
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SHELL_FILES: SHELL_FILES, CACHE_NAME: CACHE_NAME };
}
