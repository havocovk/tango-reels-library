// syncQueue.js - Offline işlem kuyruğu
// ✅ YENİ DOSYA (Adım 2.3)
// İnternet yokken yapılan değişiklikleri localStorage'da biriktirir.
// Bağlantı gelince flushQueue() ile sunucuya gönderir.

import { dbUpdateLearningStatus, dbAddFavorite, dbRemoveFavorite } from './tangoVeritabani.js';

const QUEUE_KEY = 'tango_sync_queue';

// ─────────────────────────────────────────────────────────────
// enqueue(action) — Yeni bir işlemi kuyruğa ekle
// action: { type, payload, timestamp }
// ─────────────────────────────────────────────────────────────
export function enqueue(action) {
    try {
        const queue = getQueue();
        queue.push({
            ...action,
            timestamp: action.timestamp || Date.now()
        });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.warn('[SyncQueue] Kuyruğa eklenemedi:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────
// getQueue() — Bekleyen işlemleri dizi olarak döner
// ─────────────────────────────────────────────────────────────
export function getQueue() {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
// clearQueue() — Tüm kuyruğu sil
// ─────────────────────────────────────────────────────────────
export function clearQueue() {
    try {
        localStorage.removeItem(QUEUE_KEY);
    } catch (e) {}
}

// ─────────────────────────────────────────────────────────────
// flushQueue() — Online olunca çağrılır
// Kuyruktaki her işlemi sunucuya göndermeye çalışır.
// Başarılı olanları çıkarır, başarısız olanlar sonraki flush'a kalır.
// ─────────────────────────────────────────────────────────────
export async function flushQueue() {
    if (!navigator.onLine) return;

    const queue = getQueue();
    if (queue.length === 0) return;

    const remaining = [];

    for (const action of queue) {
        try {
            await processAction(action);
            // Başarılı → kuyruktan çıkar (remaining'e ekleme)
        } catch (err) {
            console.warn('[SyncQueue] İşlem gönderilemedi, kuyrukta kalıyor:', action.type, err.message);
            remaining.push(action); // Başarısız → tekrar dene
        }
    }

    // Kalan işlemleri kaydet
    if (remaining.length > 0) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
        clearQueue();
    }

    // Kullanıcıya bilgi ver (en az bir işlem gönderildiyse)
    const sentCount = queue.length - remaining.length;
    if (sentCount > 0) {
        import('./toast.js').then(({ showToast }) => {
            showToast(`✅ ${sentCount} bekleyen değişiklik sunucuya gönderildi`, 'success', 4000);
        });
    }
}

// ─────────────────────────────────────────────────────────────
// processAction(action) — Tek bir işlemi ilgili DB fonksiyonuna yönlendir
// ─────────────────────────────────────────────────────────────
async function processAction(action) {
    const { type, payload } = action;

    switch (type) {
        case 'UPDATE_LEARNING_STATUS':
            await dbUpdateLearningStatus(
                payload.videoId,
                payload.status,
                payload.reviewCount || 0,
                null // çakışma kontrolü offline senkronda atlanır
            );
            break;

        case 'ADD_FAVORITE':
            await dbAddFavorite(payload.videoId);
            break;

        case 'REMOVE_FAVORITE':
            await dbRemoveFavorite(payload.videoId);
            break;

        default:
            console.warn('[SyncQueue] Bilinmeyen işlem tipi:', type);
    }
}

// ─────────────────────────────────────────────────────────────
// hasPendingItems() — Bekleyen işlem var mı?
// ─────────────────────────────────────────────────────────────
export function hasPendingItems() {
    return getQueue().length > 0;
}