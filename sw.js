// 오프라인에서도 열리게 앱 파일만 저장. 데이터는 localStorage에 있음.
const CACHE = 'money-v2-17';
const OCR = 'money-ocr-5.1.1'; // 글자 읽기 파일은 크고 잘 안 바뀌어서 한 번 받으면 계속 씀
const FILES = ['./', 'index.html', 'style.css', 'core.js', 'main.js', 'manifest.webmanifest', 'icons/icon-180.png',
  ...['kb', 'shinhan', 'hana', 'woori', 'nh', 'ibk', 'kakao', 'toss', 'kbank', 'sc', 'citi', 'busan', 'im', 'kyongnam', 'kwangju', 'jeonbuk', 'jeju', 'suhyup', 'post', 'mg', 'cu', 'kdb'].map((b) => 'banks/' + b + '.png')];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== OCR).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// 새 버전이 있으면 받아오고, 인터넷이 없으면 저장본으로
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/vendor/')) { e.respondWith(caches.open(OCR).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })))); return; }
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
