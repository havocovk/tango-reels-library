import { translations } from './config.js';

let platformChart = null;
let monthlyChart = null;

export function computeStats(videos, instructors) {
    const totalVideos = videos.length;
    const totalInstructors = instructors.length;
    let leaderCount = 0, followerCount = 0, bothCount = 0;
    videos.forEach(v => {
        if (v.role_type === 'Leader') leaderCount++;
        else if (v.role_type === 'Follower') followerCount++;
        else bothCount++;
    });
    // Sabit sıra: facebook, instagram, youtube, drive (saat kadranı sırası)
    const platformOrder = ['facebook', 'instagram', 'youtube', 'drive'];
    const platformCounts = {};
    platformOrder.forEach(p => platformCounts[p] = 0);
    platformCounts.other = 0;
    videos.forEach(v => {
        const plat = v.platform || 'other';
        if (platformCounts.hasOwnProperty(plat)) platformCounts[plat]++;
        else platformCounts.other++;
    });
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
    // Aylar: mayıs 2026'dan itibaren tüm aylar (bugün mayıs 2026, ileride otomatik artacak)
    const now = new Date();
    const startMonth = new Date(2026, 4, 1); // Mayıs 2026 (ay 0 indeks)
    const monthMap = new Map();
    let current = new Date(startMonth);
    while (current <= now) {
        const key = `${current.getFullYear()}-${current.getMonth()+1}`;
        monthMap.set(key, { year: current.getFullYear(), month: current.getMonth()+1, count: 0, label: `${current.toLocaleString('default', { month: 'long' })} ${current.getFullYear()}` });
        current.setMonth(current.getMonth() + 1);
    }
    videos.forEach(v => {
        if (v.created_at) {
            const date = new Date(v.created_at);
            if (!isNaN(date) && date >= startMonth) {
                const key = `${date.getFullYear()}-${date.getMonth()+1}`;
                if (monthMap.has(key)) monthMap.get(key).count++;
            }
        }
    });
    const monthlyData = Array.from(monthMap.values()).sort((a,b) => a.year - b.year || a.month - b.month);
    return { totalVideos, totalInstructors, leaderCount, followerCount, bothCount, platformCounts, topTags, monthlyData };
}

export function renderStats(stats, currentLang) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    const lang = translations[currentLang];
    const roleCardsHtml = `
        <div class="role-cards">
            <div class="role-card leader">
                <div class="role-count">${stats.leaderCount}</div>
                <div class="role-name">${lang.roleLeader}</div>
            </div>
            <div class="role-card follower">
                <div class="role-count">${stats.followerCount}</div>
                <div class="role-name">${lang.roleFollower}</div>
            </div>
            <div class="role-card both">
                <div class="role-count">${stats.bothCount}</div>
                <div class="role-name">${lang.roleBoth}</div>
            </div>
        </div>
    `;
    const topTagsHtml = `
        <div class="stats-tags">
            <div class="stat-label">${lang.statsTopTags}</div>
            <div class="top-tags-list">
                ${stats.topTags.map(t => `<span class="tag-badge">#${t.tag} (${t.count})</span>`).join('')}
                ${stats.topTags.length === 0 ? `<span class="tag-badge">${lang.statsNoTags}</span>` : ''}
            </div>
        </div>
    `;
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.totalVideos}</div>
                <div class="stat-label">${lang.statsTotalVideos}</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalInstructors}</div>
                <div class="stat-label">${lang.statsTotalInstructors}</div>
            </div>
        </div>
        ${roleCardsHtml}
        <div class="platform-chart-container">
            <div class="stat-label">${lang.statsPlatformDistribution}</div>
            <canvas id="platform-pie-chart" width="400" height="300" style="max-width:100%; height:auto;"></canvas>
        </div>
        ${topTagsHtml}
        <div class="monthly-chart-container">
            <div class="stat-label">${lang.statsMonthlyTrend}</div>
            <div class="scrollable-chart" style="overflow-x: auto; width: 100%;">
                <canvas id="monthly-bar-chart" width="${Math.max(500, stats.monthlyData.length * 80)}" height="300" style="height:300px; width:auto;"></canvas>
            </div>
        </div>
    `;
    // Pie chart sabit sıra: facebook, instagram, youtube, drive (renkler ve logolar)
    const platformOrder = ['facebook', 'instagram', 'youtube', 'drive'];
    const labels = platformOrder.map(p => lang.platformLabels[p]);
    const data = platformOrder.map(p => stats.platformCounts[p] || 0);
    const colors = {
        facebook: '#1877F2',
        instagram: '#E4405F',
        youtube: '#FF0000',
        drive: '#4285F4'
    };
    const bgColors = platformOrder.map(p => colors[p]);
    const iconUrls = platformOrder.map(p => lang.platformIconUrls[p]);
    const ctxPie = document.getElementById('platform-pie-chart').getContext('2d');
    if (platformChart) platformChart.destroy();
    platformChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 1 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} video` } }, legend: { display: false } },
            animation: {
                onComplete: function() {
                    const canvas = document.getElementById('platform-pie-chart');
                    const ctx = canvas.getContext('2d');
                    const meta = platformChart.getDatasetMeta(0);
                    const arcs = meta.data;
                    // Saat kadranı açıları: 12'den başlayıp saat yönünde: facebook (12-2), instagram (2-6), youtube (6-9), drive (9-12)
                    // Açılar radyan: 0 radyan = 3 yönü, biz saat 12'yi -PI/2 olarak alacağız.
                    // Her parçanın orta açısını hesaplayıp logoyu dışarıya koymak için yarıçapın 1.2 katı
                    const centerX = canvas.width / 2;
                    const centerY = canvas.height / 2;
                    const radius = arcs[0]?.outerRadius || 120;
                    const outerRadius = radius + 15;
                    platformOrder.forEach((p, idx) => {
                        if (data[idx] === 0) return;
                        const arc = arcs[idx];
                        const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
                        const x = centerX + Math.cos(midAngle) * outerRadius;
                        const y = centerY + Math.sin(midAngle) * outerRadius;
                        const imgUrl = iconUrls[idx];
                        if (imgUrl) {
                            const img = new Image();
                            img.src = imgUrl;
                            img.onload = () => {
                                ctx.drawImage(img, x - 16, y - 16, 32, 32);
                            };
                            img.onerror = () => {
                                ctx.fillStyle = '#fff';
                                ctx.font = 'bold 16px sans-serif';
                                ctx.fillText(p.charAt(0).toUpperCase(), x - 8, y + 8);
                            };
                        } else {
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 16px sans-serif';
                            ctx.fillText(p.charAt(0).toUpperCase(), x - 8, y + 8);
                        }
                    });
                }
            }
        }
    });
    // Bar chart
    const ctxBar = document.getElementById('monthly-bar-chart').getContext('2d');
    if (monthlyChart) monthlyChart.destroy();
    const months = stats.monthlyData.map(m => m.label);
    const counts = stats.monthlyData.map(m => m.count);
    monthlyChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                data: counts,
                backgroundColor: '#ff007f',
                borderRadius: 8,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { display: false, beginAtZero: true }, x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45 } } },
            plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.raw} video` } }, legend: { display: false } },
            onComplete: function() {
                const chart = monthlyChart;
                const ctx = chart.ctx;
                const dataset = chart.data.datasets[0];
                const yScale = chart.scales.y;
                const xScale = chart.scales.x;
                dataset.data.forEach((value, index) => {
                    const x = xScale.getPixelForValue(index);
                    const y = yScale.getPixelForValue(value);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 14px sans-serif';
                    ctx.shadowBlur = 0;
                    ctx.fillText(value, x - 10, y - 8);
                });
            }
        }
    });
}