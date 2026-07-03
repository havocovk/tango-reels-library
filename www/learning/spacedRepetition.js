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
// Tüm video listesini alır; bugün veya daha önce
// tekrar edilmesi gereken videoları filtreler ve
// en acil olandan (en eski last_reviewed_at) başa
// sıralayarak döner.
// ─────────────────────────────────────────────────────────────
export function getDueVideos(videos) {
    if (!videos || videos.length === 0) return [];

    const now = new Date();
    // Günün başlangıcı (saat 00:00:00) — "bugün olan" karşılaştırması için
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const due = videos.filter(video => {
        // Tango Şov videoları pratik listesine dahil edilmez
        if (video.content_type === 'show') return false;
        const nextReview = calculateNextReviewDate(video);
        // nextReview bugün veya geçmişte ise listeye al
        return nextReview <= todayStart || 
               (nextReview.toDateString() === now.toDateString());
    });

    // En acil sıralama: last_reviewed_at en eski olan (veya hiç bakılmamış) önce
    due.sort((a, b) => {
        const aTime = a.last_reviewed_at ? new Date(a.last_reviewed_at).getTime() : 0;
        const bTime = b.last_reviewed_at ? new Date(b.last_reviewed_at).getTime() : 0;
        return aTime - bTime; // küçükten büyüğe → en eski en başta
    });

    return due;
}

// ─────────────────────────────────────────────────────────────
// getDueTodayCount(videos)
//
// Bugün çalışılması gereken video sayısını döner.
// Sol menüdeki badge sayısı için kullanılır.
// ─────────────────────────────────────────────────────────────
export function getDueTodayCount(videos) {
    return getDueVideos(videos).length;
}