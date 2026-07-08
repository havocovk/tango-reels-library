// learning/spacedRepetition.js
// SM-2 tabanlı aralıklı tekrar algoritması.
// Her videonun "sonraki tekrar tarihi"ni hesaplar ve
// bugün çalışılması gereken videoları döner.

// ─────────────────────────────────────────────────────────────
// calculateNextReviewDate(video)
//
// video.learning_status, video.review_count ve
// video.last_reviewed_at değerlerine bakarak
// bir sonraki tekrar tarihini (Date nesnesi) döner.
//
// Kural tablosu:
//   new        → hiç bakılmamış → bugün (acil)
//   learning   review_count 1-3 → 2 gün sonra
//   learning   review_count 4-6 → 4 gün sonra
//   learning   review_count 7+  → 7 gün sonra
//   mastered   review_count 1-5 → 14 gün sonra
//   mastered   review_count 6+  → 30 gün sonra
// ─────────────────────────────────────────────────────────────
export function calculateNextReviewDate(video) {
    const status = video.learning_status || 'new';
    const count  = video.review_count    || 0;
    const lastReviewed = video.last_reviewed_at
        ? new Date(video.last_reviewed_at)
        : null;

    // Hiç bakılmamış → hemen bugün
    if (!lastReviewed || status === 'new') {
        return new Date();
    }

    let intervalDays = 1; // varsayılan

    if (status === 'learning') {
        if (count <= 3)      intervalDays = 2;
        else if (count <= 6) intervalDays = 4;
        else                 intervalDays = 7;
    } else if (status === 'mastered') {
        intervalDays = count <= 5 ? 14 : 30;
    }

    const nextDate = new Date(lastReviewed);
    nextDate.setDate(nextDate.getDate() + intervalDays);
    return nextDate;
}

// ─────────────────────────────────────────────────────────────
// getDueVideos(videos)
//
// ⛔ ADIM 4: SM-2 algoritması devre dışı bırakıldı.
// Pratik Başlat artık Pratik Listesi'ndeki videoları kullanır.
// Geçmiş veriler ve tablo korunmaktadır.
// ─────────────────────────────────────────────────────────────
export function getDueVideos(videos) {
    return [];
}

// ─────────────────────────────────────────────────────────────
// getDueTodayCount(videos)
// ⛔ ADIM 4: Devre dışı — her zaman 0 döner.
// ─────────────────────────────────────────────────────────────
export function getDueTodayCount(videos) {
    return 0;
}