// tangoStats.js - İstatistik paneli hesaplama ve render

import { translations } from './config.js';

// Ana istatistikleri hesapla
export function computeStats(videos, instructors) {
    const totalVideos = videos.length;
    const totalInstructors = instructors.length;

    // Rol dağılımı
    let leaderCount = 0, followerCount = 0, bothCount = 0;
    videos.forEach(v => {
        const role = v.role_type;
        if (role === 'Leader') leaderCount++;
        else if (role === 'Follower') followerCount++;
        else bothCount++;
    });

    // Kaynak dağılımı (Drive / Sosyal)
    let driveCount = videos.filter(v => v.is_downloaded === true).length;
    let socialCount = totalVideos - driveCount;

    // En çok kullanılan 5 etiket
    const tagMap = new Map();
    videos.forEach(v => {
        if (v.tags) {
            const tags = v.tags.split(',').map(t => t.trim());
            tags.forEach(tag => {
                if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });
    const topTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count }));

    // Aylara göre video sayısı (son 12 ay)
    const now = new Date();
    const monthMap = new Map();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()+1}`;
        monthMap.set(key, { year: d.getFullYear(), month: d.getMonth()+1, count: 0 });
    }
    videos.forEach(v => {
        if (v.created_at) {
            const date = new Date(v.created_at);
            if (!isNaN(date)) {
                const key = `${date.getFullYear()}-${date.getMonth()+1}`;
                if (monthMap.has(key)) {
                    monthMap.get(key).count++;
                }
            }
        }
    });
    // Sıralı dizi (en eski -> en yeni) veya en yeni -> en eski, grafik için son 6 ay yeterli
    const monthlyData = Array.from(monthMap.values())
        .sort((a,b) => a.year - b.year || a.month - b.month)
        .slice(-6); // son 6 ay

    return {
        totalVideos,
        totalInstructors,
        leaderCount,
        followerCount,
        bothCount,
        driveCount,
        socialCount,
        topTags,
        monthlyData
    };
}

// İstatistik panelini HTML'e yerleştir (dil desteği ile)
export function renderStats(stats, currentLang) {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const lang = translations[currentLang];
    // Dil sözlüğünde istatistik başlıklarının olması gerekir (config.js'e ekleyeceğiz)
    // Şimdilik doğrudan yazalım ama config'den almak daha iyi. Aşağıda config.js güncellenecek.

    const roleTotal = stats.leaderCount + stats.followerCount + stats.bothCount;
    const rolePercent = (count) => roleTotal ? ((count / roleTotal) * 100).toFixed(0) : 0;

    const maxMonthly = Math.max(...stats.monthlyData.map(m => m.count), 1);
    
    // HTML oluştur
    let html = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.totalVideos}</div>
                <div class="stat-label">${lang.statsTotalVideos}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalInstructors}</div>
                <div class="stat-label">${lang.statsTotalInstructors}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.leaderCount} / ${stats.followerCount} / ${stats.bothCount}</div>
                <div class="stat-label">${lang.statsRoleDistribution}</div>
                <div class="stat-bar-group">
                    <span style="width:${rolePercent(stats.leaderCount)}%; background:#00f0ff;">${rolePercent(stats.leaderCount)}%</span>
                    <span style="width:${rolePercent(stats.followerCount)}%; background:#ff007f;">${rolePercent(stats.followerCount)}%</span>
                    <span style="width:${rolePercent(stats.bothCount)}%; background:#c084fc;">${rolePercent(stats.bothCount)}%</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.driveCount} / ${stats.socialCount}</div>
                <div class="stat-label">${lang.statsSourceDistribution}</div>
                <div class="stat-bar-group">
                    <span style="width:${(stats.driveCount/stats.totalVideos*100).toFixed(0)}%; background:#00f0ff;">💾</span>
                    <span style="width:${(stats.socialCount/stats.totalVideos*100).toFixed(0)}%; background:#ff007f;">🌐</span>
                </div>
            </div>
        </div>
        <div class="stats-tags">
            <div class="stat-label">${lang.statsTopTags}</div>
            <div class="top-tags-list">
                ${stats.topTags.map(t => `<span class="tag-badge">#${t.tag} (${t.count})</span>`).join('')}
                ${stats.topTags.length === 0 ? `<span class="tag-badge">${lang.statsNoTags}</span>` : ''}
            </div>
        </div>
        <div class="stats-chart">
            <div class="stat-label">${lang.statsMonthlyTrend}</div>
            <div class="monthly-bars">
                ${stats.monthlyData.map(m => `
                    <div class="month-bar-item">
                        <div class="bar" style="height: ${(m.count / maxMonthly) * 100}%;"></div>
                        <div class="month-label">${m.month}/${m.year}</div>
                        <div class="bar-count">${m.count}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    container.innerHTML = html;
}