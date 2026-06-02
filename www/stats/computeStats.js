// stats/computeStats.js - Sadece verilerden istatistik hesaplama (DOM/UI yok)
// ✅ GÜNCELLEME (Adım 5.1): computeLearningHeatmap eklendi

// ─────────────────────────────────────────────────────────────
// Yardımcı: Tarih objesini yerel saat dilimiyle 'YYYY-MM-DD' formatına çevirir.
// toISOString() UTC kullandığı için gece yarısı civarında yanlış gün verebilir.
// ─────────────────────────────────────────────────────────────
function toLocalDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ─────────────────────────────────────────────────────────────
// computeLearningHeatmap(videos, year)  ✅ YENİ (Adım 5.1)
// Seçilen yıl için GitHub tarzı ısı haritası verisi üretir.
// Döner: { weeks: [[{date, addCount, practiceCount, total}|null]], year }
// ─────────────────────────────────────────────────────────────
export function computeLearningHeatmap(videos, year) {
    // Her güne ait aktiviteyi topla
    const dateMap = new Map(); // 'YYYY-MM-DD' → { addCount, practiceCount }

    videos.forEach(v => {
        // Video ekleme tarihi
        if (v.created_at) {
            const d = new Date(v.created_at);
            if (!isNaN(d) && d.getFullYear() === year) {
                const key = toLocalDateKey(d);
                if (!dateMap.has(key)) dateMap.set(key, { addCount: 0, practiceCount: 0 });
                dateMap.get(key).addCount++;
            }
        }
        // Pratik tarihi
        if (v.last_reviewed_at) {
            const d = new Date(v.last_reviewed_at);
            if (!isNaN(d) && d.getFullYear() === year) {
                const key = toLocalDateKey(d);
                if (!dateMap.has(key)) dateMap.set(key, { addCount: 0, practiceCount: 0 });
                dateMap.get(key).practiceCount++;
            }
        }
    });

    // Yılın ilk günü
    const startDate = new Date(year, 0, 1);
    // Pazartesi = 0, Pazar = 6 olacak şekilde haftanın gününü hesapla
    // JS: 0=Pazar, 1=Pazartesi → (getDay() + 6) % 7 = Pazartesi=0
    const firstDayOffset = (startDate.getDay() + 6) % 7;

    // Yılın tüm günleri
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

    // Hücre dizisi: başa boş hücreler ekle, sonra günler
    const cells = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push(null);
    days.forEach(d => cells.push(d));

    // 53 haftalık gruplara böl
    const weeks = [];
    for (let w = 0; w < 53; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            week.push(cells[w * 7 + d] || null);
        }
        // Tamamen boş haftayı dahil etme (yılın sonunda olabilir)
        const hasData = week.some(c => c !== null);
        if (hasData) weeks.push(week);
    }

    return { weeks, year };
}

// ─────────────────────────────────────────────────────────────
// computeStats(videos, instructors) — ana istatistik hesaplama
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

    // 12 aylık periyot (Mayıs 2026'dan itibaren)
    const startDate = new Date(2026, 4, 1);
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
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
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const found = months.find(m => m.year === year && m.month === month);
                if (found) found.count++;
            }
        }
    });

    return {
        totalVideos, totalInstructors,
        leaderCount, followerCount, bothCount,
        platformCounts, topTags,
        monthlyData: months
    };
}