// sw.js - Service Worker
// ✅ GÜNCELLEME (Adım 2.1): Uygulama kabuğu önbelleğe alınıyor
//    Strateji: Network First + Cache Fallback
//    - Supabase API çağrıları → her zaman ağdan git (önbelleğe alma)
//    - Uygulama dosyaları (HTML/CSS/JS/Font) → önce ağdan dene, ağ yoksa önbellekten sun

const CACHE_NAME = 'tango-app-v6';

// Önbelleğe alınacak uygulama dosyaları (uygulama kabuğu)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/buttons.css',
  '/styles/cards.css',
  '/styles/forms.css',
  '/styles/modals.css',
  '/styles/stats-tagmanager.css',
  '/styles/practice-session.css',
  '/styles/playlists.css',
  '/styles/dashboard.css',
  // Fontlar — kendi sunucumuzdan servis ediliyor, precache garantili
  '/assets/fonts/plus-jakarta-sans-latin.woff2',
  '/assets/fonts/plus-jakarta-sans-latin-ext.woff2',
  '/assets/fonts/space-grotesk-latin.woff2',
  '/assets/fonts/space-grotesk-latin-ext.woff2'
];

// ─────────────────────────────────────────────────────────────
// INSTALL — Service Worker kurulurken uygulama kabuğunu önbelleğe al
// ─────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Her dosyayı tek tek dene; biri başarısız olursa diğerleri etkilenmesin
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Önbelleğe alınamadı:', url, err.message);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Kurulum tamamlandı, önbellek hazır.');
        // Yeni SW hemen aktif olsun, eski SW'yi bekleme
        return self.skipWaiting();
      })
  );
});

// ─────────────────────────────────────────────────────────────
// ACTIVATE — Eski önbellekleri temizle
// ─────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME) // Eski önbellekler
            .map(name => {
              console.log('[SW] Eski önbellek siliniyor:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Aktivasyon tamamlandı, kontrol alındı.');
        return self.clients.claim();
      })
  );
});

// ─────────────────────────────────────────────────────────────
// FETCH — Ağ isteği geldiğinde ne yapılacağını belirle
// ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = e.request.url;

  // ── 1. Supabase API çağrıları → HER ZAMAN AĞDAN GİT ──────
  // Veritabanı isteklerini asla önbellekten sunma; canlı veri şart.
  if (url.includes('supabase.co') || url.includes('supabase.in')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // ── 2. YouTube / Google / CDN → HER ZAMAN AĞDAN GİT ─────
  // Dış kaynakları önbelleğe almıyoruz (güvenlik + boyut riski).
  if (
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('googleapis.com/youtube') ||
    url.includes('drive.google.com') ||
    url.includes('cdn.jsdelivr.net') ||
    url.includes('cdnjs.cloudflare.com') ||
    url.includes('vis-network')
  ) {
    e.respondWith(fetch(e.request));
    return;
  }

  // ── 3. Uygulama dosyaları → NETWORK FIRST + CACHE FALLBACK ─
  // Önce ağdan taze veri almayı dene.
  // İnternet yoksa (offline) önbellekten sun.
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Ağdan gelen yanıtı önbelleğe de kaydet (güncel kalsın)
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type !== 'opaque' // CORS engelli kaynakları kaydetme
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Ağ yok → önbellekten sun
        return caches.match(e.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Önbellekten sunuluyor (offline):', url);
              return cachedResponse;
            }
            // Ne ağda ne önbellekte var → index.html'i sun (SPA fallback)
            // Böylece uygulama en azından açılır
            if (e.request.destination === 'document') {
              return caches.match('/index.html');
            }
            // Diğer kaynaklar için boş yanıt döndür
            return new Response('', { status: 408, statusText: 'Offline' });
          });
      })
  );
});