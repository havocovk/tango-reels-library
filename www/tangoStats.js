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
    const now = new Date();
    const monthMap = new Map();
    for (let i = 0; i < 24; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()+1}`;
        monthMap.set(key, { year: d.getFullYear(), month: d.getMonth()+1, count: 0 });
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
    const monthlyData = Array.from(monthMap.values())
        .sort((a,b) => a.year - b.year || a.month - b.month);
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
                <div class="monthly-bars-wrapper" style="min-width: ${Math.max(600, stats.monthlyData.length * 80)}px; height: 300px;">
                    <canvas id="monthly-bar-chart" width="${Math.max(600, stats.monthlyData.length * 80)}" height="300" style="width:100%; height:100%;"></canvas>
                </div>
            </div>
        </div>
    `;
    // Pie chart (platform)
    const ctxPie = document.getElementById('platform-pie-chart').getContext('2d');
    if (platformChart) platformChart.destroy();
    const platformLabels = [];
    const platformCounts = [];
    const platformColors = [];
    for (const [key, count] of Object.entries(stats.platformCounts)) {
        if (count > 0) {
            platformLabels.push(lang.platformLabels[key] || key);
            platformCounts.push(count);
            switch(key) {
                case 'drive': platformColors.push('#4285F4'); break;
                case 'youtube': platformColors.push('#FF0000'); break;
                case 'instagram': platformColors.push('#E4405F'); break;
                case 'facebook': platformColors.push('#1877F2'); break;
                default: platformColors.push('#00f0ff');
            }
        }
    }
    platformChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: platformLabels,
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
            }
        }
    });
    // Bar chart (aylık)
    const ctxBar = document.getElementById('monthly-bar-chart').getContext('2d');
    if (monthlyChart) monthlyChart.destroy();
    const months = stats.monthlyData.map(m => `${m.month}/${m.year}`);
    const counts = stats.monthlyData.map(m => m.count);
    monthlyChart = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: lang.statsMonthlyTrend,
                data: counts,
                backgroundColor: '#ff007f',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Video Sayısı', color: '#94a3b8' } },
                x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 } }
            },
            plugins: {
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw} video` } }
            }
        }
    });
}