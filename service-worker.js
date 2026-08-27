const CACHE_NAME = 'mesenterica-litert-2026-08-27-v10';
const LOCAL_ASSETS = [
  './', './index.html', './analysis.html', './assets/js/analysis.js?v=20260826.4', './assets/js/yolo-inference.js?v=20260826.4', './assets/js/clinical-guidance.js?v=20260826.4',
  './report.html', './assets/js/report-state.js?v=20260826.4', './assets/css/styles.css?v=20260826.4', './assets/images/screen.png', './model/manifest.json?v=20260826.4', './model/checksums.sha256', './model/parity-fixtures.json',
  './model/detector/model.tflite', './model/detector/metadata.json', './model/classifier/model.tflite', './model/classifier/metadata.json',
  './vendor/litert/litert-core.js', './vendor/litert/wasm-utils.js',
  './vendor/litert/wasm/litert_wasm_compat_internal.js', './vendor/litert/wasm/litert_wasm_compat_internal.wasm',
  './vendor/litert/wasm/litert_wasm_internal.js', './vendor/litert/wasm/litert_wasm_internal.wasm',
  './vendor/litert/wasm/litert_wasm_jspi_internal.js', './vendor/litert/wasm/litert_wasm_jspi_internal.wasm',
  './vendor/litert/wasm/litert_wasm_threaded_internal.js', './vendor/litert/wasm/litert_wasm_threaded_internal.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(LOCAL_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('mesenterica-litert-') && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
