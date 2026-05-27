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
    
    // 12 aylık periyot: Mayıs 2026'dan Nisan 2027'ye kadar
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
    return { totalVideos, totalInstructors, leaderCount, followerCount, bothCount, platformCounts, topTags, monthlyData: months };
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
        <div class="platform-chart-container" style="min-height: 500px; margin-bottom: 20px; position: relative;">
            <div class="stat-label stat-label-centered" style="margin-bottom: 15px;">${lang.statsPlatformDistribution}</div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                <canvas id="platform-pie-chart" width="400" height="400" style="max-width: 400px; width: 100%; height: auto; margin: 0 auto;"></canvas>
                <div id="pie-legend-container" style="margin-top: 40px; text-align: center; width: 100%;"></div>
            </div>
        </div>
        ${topTagsHtml}
        <div class="monthly-chart-container">
            <div class="stat-label stat-label-centered">${lang.statsMonthlyTrend}</div>
            <div class="scrollable-chart" style="overflow-x: auto; width: 100%;">
                <canvas id="monthly-bar-chart" width="${Math.max(700, stats.monthlyData.length * 80)}" height="350" style="width: auto; height: auto; display: block;"></canvas>
            </div>
        </div>
    `;
    
    // Pie chart verilerini hazırla
    const platformKeys = [];
    const platformCounts = [];
    const platformColors = [];
    const platformIconUrls = [];
    for (const [key, count] of Object.entries(stats.platformCounts)) {
        if (count > 0) {
            platformKeys.push(key);
            platformCounts.push(count);
            switch (key) {
                case 'drive': platformColors.push('#4285F4'); platformIconUrls.push(lang.platformIconUrls.drive); break;
                case 'youtube': platformColors.push('#FF0000'); platformIconUrls.push(lang.platformIconUrls.youtube); break;
                case 'instagram': platformColors.push('#E4405F'); platformIconUrls.push(lang.platformIconUrls.instagram); break;
                case 'facebook': platformColors.push('#1877F2'); platformIconUrls.push(lang.platformIconUrls.facebook); break;
                default: platformColors.push('#00f0ff'); platformIconUrls.push('');
            }
        }
    }
    
    // Özel legend oluştur (container'ın altına)
    const legendContainer = document.getElementById('pie-legend-container');
    if (legendContainer) {
        legendContainer.innerHTML = '';
        platformKeys.forEach((key, idx) => {
            const label = lang.platformLabels[key] || key;
            const count = platformCounts[idx];
            const color = platformColors[idx];
            const iconUrl = platformIconUrls[idx];
            const legendItem = document.createElement('div');
            legendItem.style.display = 'inline-block';
            legendItem.style.margin = '0 12px 10px 0';
            legendItem.style.fontSize = '14px';
            legendItem.style.color = '#f1f5f9';
            if (iconUrl && iconUrl !== '') {
                const img = document.createElement('img');
                img.src = iconUrl;
                img.style.width = '20px';
                img.style.height = '20px';
                img.style.verticalAlign = 'middle';
                img.style.marginRight = '6px';
                legendItem.appendChild(img);
            } else {
                const colorBox = document.createElement('span');
                colorBox.style.display = 'inline-block';
                colorBox.style.width = '16px';
                colorBox.style.height = '16px';
                colorBox.style.backgroundColor = color;
                colorBox.style.borderRadius = '4px';
                colorBox.style.marginRight = '6px';
                colorBox.style.verticalAlign = 'middle';
                legendItem.appendChild(colorBox);
            }
            const textSpan = document.createElement('span');
            textSpan.innerText = `${label} (${count})`;
            legendItem.appendChild(textSpan);
            legendContainer.appendChild(legendItem);
        });
    }
    
    // Pie chart çizimi (Chart.js ile, ancak legend'ı göstermeden)
    const ctxPie = document.getElementById('platform-pie-chart').getContext('2d');
    if (platformChart) platformChart.destroy();
    platformChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: platformKeys.map(k => ''), // label gösterme, kendi legend'ımız var
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
                tooltip: { callbacks: { label: (ctx) => `${lang.platformLabels[platformKeys[ctx.dataIndex]] || platformKeys[ctx.dataIndex]}: ${ctx.raw} video` } },
                legend: { display: false }  // Chart.js legend'ını kapat
            },
            layout: {
                padding: 10
            },
            animation: {
                onComplete: function() {
                    const canvas = document.getElementById('platform-pie-chart');
                    const ctx = canvas.getContext('2d');
                    const meta = platformChart.getDatasetMeta(0);
                    const arcs = meta.data;
                    arcs.forEach((arc, index) => {
                        const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
                        // Eski mesafe (daha dışarıda) için radius = arc.outerRadius + 25
                        const radius = arc.outerRadius + 25;
                        const x = arc.x + Math.cos(midAngle) * radius;
                        const y = arc.y + Math.sin(midAngle) * radius;
                        const imgUrl = platformIconUrls[index];
                        if (imgUrl && imgUrl !== '') {
                            const img = new Image();
                            img.src = imgUrl;
                            img.onload = () => {
                                ctx.drawImage(img, x - 22, y - 22, 44, 44);
                            };
                        } else {
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 16px sans-serif';
                            ctx.shadowBlur = 0;
                            ctx.fillText(platformCounts[index], x - 12, y + 6);
                        }
                    });
                }
            }
        }
    });
    
    // Bar chart - aynı kalacak
    const canvasBar = document.getElementById('monthly-bar-chart');
    if (canvasBar) {
        const ctxBar = canvasBar.getContext('2d');
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
                    barPercentage: 0.7,
                    categoryPercentage: 0.8
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: true,
                scales: {
                    y: { display: false },
                    x: {
                        ticks: {
                            autoSkip: false,
                            maxRotation: 45,
                            minRotation: 45,
                            font: { size: 11 }
                        }
                    }
                },
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: false }
                },
                layout: { padding: { top: 25 } }
            }
        });
        
        setTimeout(() => {
            const ctx = canvasBar.getContext('2d');
            const chart = monthlyChart;
            if (!chart) return;
            const meta = chart.getDatasetMeta(0);
            const bars = meta.data;
            bars.forEach((bar, index) => {
                const value = counts[index];
                if (value === 0) return;
                ctx.save();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
                ctx.shadowBlur = 0;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(value.toString(), bar.x, bar.y - 6);
                ctx.restore();
            });
        }, 150);
    }
}