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
    const platformCounts = {
        drive: videos.filter(v => v.platform === 'drive').length,
        youtube: videos.filter(v => v.platform === 'youtube').length,
        instagram: videos.filter(v => v.platform === 'instagram').length,
        facebook: videos.filter(v => v.platform === 'facebook').length,
        other: videos.filter(v => !v.platform || v.platform === 'other').length
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
    // Sadece son 6 ay, en yeniden eskiye doğru sıralı (son ay en sağda)
    const now = new Date();
    const monthMap = new Map();
    for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()+1}`;
        monthMap.set(key, { year: d.getFullYear(), month: d.getMonth()+1, count: 0, label: `${d.getMonth()+1}/${d.getFullYear()}` });
    }
    videos.forEach(v => {
        if (v.created_at) {
            const date = new Date(v.created_at);
            if (!isNaN(date)) {
                const key = `${date.getFullYear()}-${date.getMonth()+1}`;
                if (monthMap.has(key)) monthMap.get(key).count++;
            }
        }
    });
    // Ayları kronolojik sıraya koy (eski -> yeni)
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
            <div class="scrollable-chart">
                <canvas id="monthly-bar-chart" width="${Math.max(400, stats.monthlyData.length * 80)}" height="300" style="width:100%; height:auto;"></canvas>
            </div>
        </div>
    `;
    // Pie chart
    const ctxPie = document.getElementById('platform-pie-chart').getContext('2d');
    if (platformChart) platformChart.destroy();
    const platformKeys = [];
    const platformCounts = [];
    const platformColors = [];
    const platformIconUrls = [];
    for (const [key, count] of Object.entries(stats.platformCounts)) {
        if (count > 0) {
            platformKeys.push(key);
            platformCounts.push(count);
            switch(key) {
                case 'drive': platformColors.push('#4285F4'); platformIconUrls.push(lang.platformIconUrls.drive); break;
                case 'youtube': platformColors.push('#FF0000'); platformIconUrls.push(lang.platformIconUrls.youtube); break;
                case 'instagram': platformColors.push('#E4405F'); platformIconUrls.push(lang.platformIconUrls.instagram); break;
                case 'facebook': platformColors.push('#1877F2'); platformIconUrls.push(lang.platformIconUrls.facebook); break;
                default: platformColors.push('#00f0ff'); platformIconUrls.push('');
            }
        }
    }
    platformChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: platformKeys.map(k => lang.platformLabels[k] || k),
            datasets: [{
                data: platformCounts,
                backgroundColor: platformColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw} video` } },
                legend: { position: 'bottom' }
            },
            animation: {
                onComplete: function() {
                    // Pie chart üzerine resim çiz
                    const canvas = document.getElementById('platform-pie-chart');
                    const ctx = canvas.getContext('2d');
                    const meta = platformChart.getDatasetMeta(0);
                    const arcs = meta.data;
                    arcs.forEach((arc, index) => {
                        const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
                        const radius = arc.outerRadius * 0.6;
                        const x = arc.x + Math.cos(midAngle) * radius;
                        const y = arc.y + Math.sin(midAngle) * radius;
                        const imgUrl = platformIconUrls[index];
                        if (imgUrl) {
                            const img = new Image();
                            img.src = imgUrl;
                            img.onload = () => {
                                ctx.drawImage(img, x - 12, y - 12, 24, 24);
                            };
                        } else {
                            // Eğer resim yoksa sayı yaz
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 14px sans-serif';
                            ctx.shadowBlur = 0;
                            ctx.fillText(platformCounts[index], x - 7, y + 5);
                        }
                    });
                }
            }
        }
    });
    // Bar chart (y ekseni yok, üzerinde sayı)
    const ctxBar = document.getElementById('monthly-bar-chart').getContext('2d');
    if (monthlyChart) monthlyChart.destroy();
    const months = stats.monthlyData.map(m => m.label);
    const counts = stats.monthlyData.map(m => m.count);
    const maxCount = Math.max(...counts, 1);
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
            maintainAspectRatio: true,
            scales: {
                y: { display: false, beginAtZero: true },
                x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 } }
            },
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} video` } },
                legend: { display: false }
            },
            onComplete: function() {
                // Çubukların üstüne sayı yaz
                const chart = monthlyChart;
                const ctx = chart.ctx;
                const dataset = chart.data.datasets[0];
                const yScale = chart.scales.y;
                const xScale = chart.scales.x;
                dataset.data.forEach((value, index) => {
                    const x = xScale.getPixelForValue(index);
                    const y = yScale.getPixelForValue(value);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.shadowBlur = 0;
                    ctx.fillText(value, x - 10, y - 5);
                });
            }
        }
    });
}