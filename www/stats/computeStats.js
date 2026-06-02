// stats/computeStats.js - Sadece verilerden istatistik hesaplama (DOM/UI yok)
// ✅ GÜNCELLEME (Adım 5.1): computeLearningHeatmap eklendi
// ✅ GÜNCELLEME (Adım 5.4): getAvailableYears ve computeMonthlyData eklendi

// ─────────────────────────────────────────────────────────────
// Yardımcı: Tarih objesini yerel saat dilimiyle 'YYYY-MM-DD' formatına çevirir.
// ─────────────────────────────────────────────────────────────
function toLocalDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────────
// getAvailableYears(videos)  ✅ YENİ (Adım 5.4)
// Koleksiyondaki videolardan benzersiz yılları çıkarır.
// Döner: [2026, 2025, 2024, ...] — azalan sırada
// ─────────────────────────────────────────────────────────────
export function getAvailableYears(videos) {
    const yearsSet = new Set();
    videos.forEach(v => {
        if (v.created_at) {
            const d = new Date(v.created_at);
            if (!isNaN(d)) yearsSet.add(d.getFullYear());
        }
    });
    // Azalan sırada döndür (en yeni yıl başta)
    return Array.from(yearsSet).sort((a, b) => b - a);
}

// ─────────────────────────────────────────────────────────────
// computeMonthlyData(videos, year)  ✅ YENİ (Adım 5.4)
// Belirli bir yılın 12 aylık video ekleme verisini döndürür.
// ─────────────────────────────────────────────────────────────
export function computeMonthlyData(videos, year) {
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(year, i, 1);
        months.push({
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            label: `${d.getMonth() + 1}/${d.getFullYear()}`,
            count: 0
        });
    }
    videos.forEach(v => {
        if (v.created_at) {
            const date = new Date(v.created_at);
            if (!isNaN(date)) {
                const vy = date.getFullYear();
                const vm = date.getMonth() + 1;
                const found = months.find(m => m.year === vy && m.month === vm);
                if (found) found.count++;
            }
        }
    });
    return months;
}

// ─────────────────────────────────────────────────────────────
// computeLearningHeatmap(videos, year)  ✅ YENİ (Adım 5.1)
// Seçilen yıl için GitHub tarzı ısı haritası verisi üretir.
// Döner: { weeks: [[{date, addCount, practiceCount, total}|null]], year }
// ─────────────────────────────────────────────────────────────
export function computeLearningHeatmap(videos, year) {
    const dateMap = new Map();

    videos.forEach(v => {
        if (v.created_at) {
            const d = new Date(v.created_at);
            if (!isNaN(d) && d.getFullYear() === year) {
                const key = toLocalDateKey(d);
                if (!dateMap.has(key)) dateMap.set(key, { addCount: 0, practiceCount: 0 });
                dateMap.get(key).addCount++;
            }
        }
        if (v.last_reviewed_at) {
            const d = new Date(v.last_reviewed_at);
            if (!isNaN(d) && d.getFullYear() === year) {
                const key = toLocalDateKey(d);
                if (!dateMap.has(key)) dateMap.set(key, { addCount: 0, practiceCount: 0 });
                dateMap.get(key).practiceCount++;
            }
        }
    });

    const startDate = new Date(year, 0, 1);
    const firstDayOffset = (startDate.getDay() + 6) % 7;

    const days = [];
    const cursor = new Date(year, 0, 1);
    while (cursor.getFullYear() === year) {
        const key = toLocalDateKey(cursor);
        const data = dateMap.get(key) || { addCount: 0, practiceCount: 0 };
        days.push({
            date: key,
            addCount: data.addCount,
            practiceCount: data.practiceCount,
            total: data.addCount + data.practiceCount
        });
        cursor.setDate(cursor.getDate() + 1);
    }

    const cells = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push(null);
    days.forEach(d => cells.push(d));

    const weeks = [];
    for (let w = 0; w < 53; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            week.push(cells[w * 7 + d] || null);
        }
        const hasData = week.some(c => c !== null);
        if (hasData) weeks.push(week);
    }

    return { weeks, year };
}

// ─────────────────────────────────────────────────────────────
// computeStats(videos, instructors) — ana istatistik hesaplama
// ✅ GÜNCELLEME (Adım 5.4): monthlyData artık computeMonthlyData() kullanıyor
// ─────────────────────────────────────────────────────────────
export function computeStats(videos, instructors) {
    const totalVideos = videos.length;
    const totalInstructors = instructors.length;
    let leaderCount = 0, followerCount = 0, bothCount = 0;
    videos.forEach(v => {
        if (v.role_type === 'Leader') leaderCount++;
        else if (v.role_type === 'Follower') followerCount++;
        else bothCount++;
    });

    const platformCounts = {
        drive:     videos.filter(v => v.platform === 'drive').length,
        youtube:   videos.filter(v => v.platform === 'youtube').length,
        instagram: videos.filter(v => v.platform === 'instagram').length,
        facebook:  videos.filter(v => v.platform === 'facebook').length,
        other:     videos.filter(v => !v.platform || v.platform === 'other').length
    };

    const tagMap = new Map();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });
    const topTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));

    // ✅ Adım 5.4: Sabit tarih yerine mevcut yılı kullan, computeMonthlyData() çağır
    const currentYear = new Date().getFullYear();
    const monthlyData = computeMonthlyData(videos, currentYear);

    return {
        totalVideos, totalInstructors,
        leaderCount, followerCount, bothCount,
        platformCounts, topTags,
        monthlyData
    };
}