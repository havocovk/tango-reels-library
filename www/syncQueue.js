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
    let conflictCount = 0; // Adim 3.2: çakışma sayacı

    for (const action of queue) {
        try {
            await processAction(action);
            // Başarılı → kuyruktan çıkar (remaining'e ekleme)
        } catch (err) {
            // Adim 3.2: Çakışma hatası kalıcıdır — tekrar denemek anlamsız.
            // Sunucudaki kayıt daha yeni; offline değişikliği bilerek atlıyoruz.
            const isConflict = err.message && err.message.includes('ÇAKIŞMA');
            if (isConflict) {
                console.warn('[SyncQueue] Çakışma — işlem atlanıyor:', action.type, action.payload?.videoId);
                conflictCount++;
                // remaining'e EKLEMİYORUZ → kuyruktan kalıcı olarak çıkar
            } else {
                console.warn('[SyncQueue] İşlem gönderilemedi, kuyrukta kalıyor:', action.type, err.message);
                remaining.push(action); // Geçici hata → tekrar dene
            }
        }
    }

    // Kalan işlemleri kaydet
    if (remaining.length > 0) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
        clearQueue();
    }

    // Kullanıcıya bilgi ver (en az bir işlem gönderildiyse)
    const sentCount = queue.length - remaining.length - conflictCount;
    if (sentCount > 0) {
        import('./toast.js').then(({ showToast }) => {
            showToast(`✅ ${sentCount} bekleyen değişiklik sunucuya gönderildi`, 'success', 4000);
        });
    }

    // Adim 3.2: Çakışma olduysa kullanıcıyı uyar (veri kaybını sessizce yapma)
    if (conflictCount > 0) {
        import('./toast.js').then(({ showToast }) => {
            const lang = localStorage.getItem('tango_lang') || 'tr';
            const msg = lang === 'en'
                ? `⚠️ ${conflictCount} offline change(s) skipped — the item was updated elsewhere. The server version was kept.`
                : `⚠️ ${conflictCount} çevrimdışı değişiklik atlandı — kayıt başka bir yerde güncellenmişti. Sunucudaki sürüm korundu.`;
            showToast(msg, 'info', 7000);
        });
        // Çakışma sonrası sunucudaki güncel veriyi çekmek için sinyal gönder
        window.dispatchEvent(new CustomEvent('tango:sync-conflict'));
    }
}

// ─────────────────────────────────────────────────────────────
// processAction(action) — Tek bir işlemi ilgili DB fonksiyonuna yönlendir
// ─────────────────────────────────────────────────────────────
async function processAction(action) {
    const { type, payload } = action;

    switch (type) {
        case 'UPDATE_LEARNING_STATUS':
            // Adim 3.2: Çakışma kontrolü ARTIK yapılıyor.
            // baseUpdatedAt = offline iken videonun gördüğümüz son hali.
            // Sunucudaki kayıt bu tarihten farklıysa dbUpdateLearningStatus
            // "ÇAKIŞMA" hatası fırlatır; bu hatayı flushQueue özel olarak yakalar.
            await dbUpdateLearningStatus(
                payload.videoId,
                payload.status,
                payload.reviewCount || 0,
                payload.baseUpdatedAt || null
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

// getPendingCount() — Bekleyen işlem sayısını döner (Adim 4.5)
export function getPendingCount() {
    return getQueue().length;
}