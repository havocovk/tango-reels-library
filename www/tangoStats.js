// tangoStats.js - İstatistik paneli (gelişmiş)

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
        .slice(0, 10)  // daha fazla gösterelim
        .map(([tag, count]) => ({ tag, count }));

    // Aylara göre video sayısı (tüm aylar, en eskiden en yeniye)
    const monthMap = new Map(); // key: "YYYY-MM"
    videos.forEach(v => {
        if (v.created_at) {
            const date = new Date(v.created_at);
            if (!isNaN(date)) {
                const key = `${date.getFullYear()}-${date.getMonth()+1}`;
                const existing = monthMap.get(key) || { year: date.getFullYear(), month: date.getMonth()+1, count: 0 };
                existing.count++;
                monthMap.set(key, existing);
            }
        }
    });
    // Sıralı dizi (en eski -> en yeni)
    let monthlyData = Array.from(monthMap.values())
        .sort((a,b) => a.year - b.year || a.month - b.month);
    
    // Eğer hiç veri yoksa boş dizi döndür
    if (monthlyData.length === 0) {
        const now = new Date();
        monthlyData = [{ year: now.getFullYear(), month: now.getMonth()+1, count: 0 }];
    }

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

// Pie chart için conic-gradient oluştur
function getPieGradient(drivePercent, socialPercent) {
    // drivePercent ve socialPercent yüzde (0-100)
    const driveDeg = (drivePercent / 100) * 360;
    return `conic-gradient(#00f0ff 0deg ${driveDeg}deg, #ff007f ${driveDeg}deg 360deg)`;
}

// İstatistik panelini HTML'e yerleştir (dil desteği ile)
export function renderStats(stats, currentLang) {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const lang = translations[currentLang];
    
    const roleTotal = stats.leaderCount + stats.followerCount + stats.bothCount;
    const leaderPercent = roleTotal ? (stats.leaderCount / roleTotal) * 100 : 0;
    const followerPercent = roleTotal ? (stats.followerCount / roleTotal) * 100 : 0;
    const bothPercent = roleTotal ? (stats.bothCount / roleTotal) * 100 : 0;
    
    const drivePercent = stats.totalVideos ? (stats.driveCount / stats.totalVideos) * 100 : 0;
    const socialPercent = stats.totalVideos ? (stats.socialCount / stats.totalVideos) * 100 : 0;
    
    // Bar grafik için max değer (en yüksek aylık video sayısı)
    const maxMonthly = Math.max(...stats.monthlyData.map(m => m.count), 1);
    
    // Pie chart gradient
    const pieStyle = `background: ${getPieGradient(drivePercent, socialPercent)};`;
    
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
                <div class="stat-bar-group" style="margin-top: 6px;">
                    <span style="width:${leaderPercent}%; background:#00f0ff;" title="Leader ${leaderPercent.toFixed(0)}%"></span>
                    <span style="width:${followerPercent}%; background:#ff007f;" title="Follower ${followerPercent.toFixed(0)}%"></span>
                    <span style="width:${bothPercent}%; background:#c084fc;" title="Both ${bothPercent.toFixed(0)}%"></span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.driveCount} / ${stats.socialCount}</div>
                <div class="stat-label">${lang.statsSourceDistribution}</div>
                <div class="pie-chart-container">
                    <div class="pie-chart" style="${pieStyle}"></div>
                </div>
                <div class="pie-legend">
                    <span style="color:#00f0ff;">💾 ${stats.driveCount}</span> / <span style="color:#ff007f;">🌐 ${stats.socialCount}</span>
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
                ${stats.monthlyData.map(m => {
                    const heightPercent = (m.count / maxMonthly) * 100;
                    const barHeight = heightPercent > 0 ? `${Math.max(heightPercent, 4)}%` : '2px';
                    return `
                        <div class="month-bar-item">
                            <div class="bar" style="height: ${barHeight};"></div>
                            <div class="bar-count">${m.count}</div>
                            <div class="month-label">${m.month}/${m.year}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    container.innerHTML = html;
}