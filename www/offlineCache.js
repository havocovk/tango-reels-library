// offlineCache.js - IndexedDB tabanlı offline video önbelleği
// ✅ YENİ DOSYA (Adım 2.2)
// Son başarılı Supabase çekimini IndexedDB'e kaydeder.
// İnternet yokken bu önbellekten veri gösterilir.

const DB_NAME = 'tango-offline';
const DB_VERSION = 1;
const STORE_VIDEOS = 'videos';
const STORE_INSTRUCTORS = 'instructors';

let _db = null;

// ─────────────────────────────────────────────────────────────
// initOfflineCache — Uygulama başlarken bir kez çağrılır
// ─────────────────────────────────────────────────────────────
export function initOfflineCache() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.warn('[OfflineCache] IndexedDB desteklenmiyor.');
            resolve(false);
            return;
        }

        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            // videos store
            if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
                db.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
            }
            // instructors store
            if (!db.objectStoreNames.contains(STORE_INSTRUCTORS)) {
                db.createObjectStore(STORE_INSTRUCTORS, { keyPath: 'id' });
            }
        };

        req.onsuccess = (e) => {
            _db = e.target.result;
            resolve(true);
        };

        req.onerror = (e) => {
            console.warn('[OfflineCache] IndexedDB açılamadı:', e.target.error);
            resolve(false);
        };
    });
}

// ─────────────────────────────────────────────────────────────
// cacheVideos — Video listesini IndexedDB'e yaz (tam yenileme)
// ─────────────────────────────────────────────────────────────
export function cacheVideos(videos) {
    if (!_db || !Array.isArray(videos)) return Promise.resolve();
    return new Promise((resolve) => {
        try {
            const tx = _db.transaction(STORE_VIDEOS, 'readwrite');
            const store = tx.objectStore(STORE_VIDEOS);
            store.clear();
            videos.forEach(v => store.put(v));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve(); // Hata sessizce geç
        } catch (e) {
            resolve();
        }
    });
}

// ─────────────────────────────────────────────────────────────
// cacheInstructors — Eğitmen listesini IndexedDB'e yaz
// ─────────────────────────────────────────────────────────────
export function cacheInstructors(instructors) {
    if (!_db || !Array.isArray(instructors)) return Promise.resolve();
    return new Promise((resolve) => {
        try {
            const tx = _db.transaction(STORE_INSTRUCTORS, 'readwrite');
            const store = tx.objectStore(STORE_INSTRUCTORS);
            store.clear();
            instructors.forEach(i => store.put(i));
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch (e) {
            resolve();
        }
    });
}

// ─────────────────────────────────────────────────────────────
// getCachedVideos — IndexedDB'den video listesini oku
// Önbellek boşsa null döner
// ─────────────────────────────────────────────────────────────
export function getCachedVideos() {
    if (!_db) return Promise.resolve(null);
    return new Promise((resolve) => {
        try {
            const tx = _db.transaction(STORE_VIDEOS, 'readonly');
            const store = tx.objectStore(STORE_VIDEOS);
            const req = store.getAll();
            req.onsuccess = () => {
                const result = req.result;
                resolve(result && result.length > 0 ? result : null);
            };
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// getCachedInstructors — IndexedDB'den eğitmen listesini oku
// ─────────────────────────────────────────────────────────────
export function getCachedInstructors() {
    if (!_db) return Promise.resolve(null);
    return new Promise((resolve) => {
        try {
            const tx = _db.transaction(STORE_INSTRUCTORS, 'readonly');
            const store = tx.objectStore(STORE_INSTRUCTORS);
            const req = store.getAll();
            req.onsuccess = () => {
                const result = req.result;
                resolve(result && result.length > 0 ? result : null);
            };
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// isCacheAvailable — Önbellek kullanılabilir mi?
// ─────────────────────────────────────────────────────────────
export function isCacheAvailable() {
    return _db !== null;
}