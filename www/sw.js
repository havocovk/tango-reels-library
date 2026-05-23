// Arka planda çalışan minimal servis yöneticisi
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// Supabase veri akışını engellememek için istekleri doğrudan internete bırakıyoruz
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});