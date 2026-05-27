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
    
    // 12 aylık periyot
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
        <div class="platform-chart-container" style="min-height: 600px; margin: 20px 0 30px 0; position: relative;">
            <div class="stat-label stat-label-centered" style="margin-bottom: 50px;">${lang.statsPlatformDistribution}</div>
            <canvas id="platform-pie-chart" width="450" height="400" style="display: block; margin: 0 auto;"></canvas>
            <div id="custom-legend" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-top: 80px; margin-bottom: 20px;"></div>
        </div>
        <div class="stats-tags">
            <div class="stat-label">${lang.statsTopTags}</div>
            <div class="top-tags-list">
                ${stats.topTags.map(t => `<span class="tag-badge">#${t.tag} (${t.count})</span>`).join('')}
                ${stats.topTags.length === 0 ? `<span class="tag-badge">${lang.statsNoTags}</span>` : ''}
            </div>
        </div>
        <div class="monthly-chart-container">
            <div class="stat-label stat-label-centered">${lang.statsMonthlyTrend}</div>
            <div class="scrollable-chart" style="overflow-x: auto; width: 100%;">
                <canvas id="monthly-bar-chart" width="${Math.max(700, stats.monthlyData.length * 80)}" height="350" style="width: auto; height: auto; display: block;"></canvas>
            </div>
        </div>
    `;
    
    // Pie Chart - Chart.js legend kapalı, custom legend kullan
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
            switch (key) {
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
                legend: { display: false }
            },
            layout: {
                padding: {
                    top: 20,
                    bottom: 30,
                    left: 20,
                    right: 20
                }
            },
            animation: {
                onComplete: function() {
                    const canvas = document.getElementById('platform-pie-chart');
                    const ctx = canvas.getContext('2d');
                    const meta = platformChart.getDatasetMeta(0);
                    const arcs = meta.data;
                    arcs.forEach((arc, index) => {
                        const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
                        // İkonları pie chart'tan uzaklaştır, ancak canvas dışına taşmayacak şekilde
                        // Alt dilimler için özel kontrol: eğer y koordinatı canvas altına yakınsa biraz yukarı al
                        let radius = arc.outerRadius + 55;
                        let x = arc.x + Math.cos(midAngle) * radius;
                        let y = arc.y + Math.sin(midAngle) * radius;
                        
                        // Canvas sınırlarını kontrol et (canvas yüksekliği 400px civarı)
                        const canvasHeight = canvas.height;
                        // Eğer ikon alt sınıra çok yakınsa (y > canvasHeight - 50), y'yi yukarı çek
                        if (y > canvasHeight - 60) {
                            y = canvasHeight - 60;
                        }
                        // Üst sınır kontrolü
                        if (y < 40) y = 40;
                        // Sol-sağ sınır
                        if (x < 40) x = 40;
                        if (x > canvas.width - 40) x = canvas.width - 40;
                        
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
                            ctx.fillText(platformCounts[index], x - 10, y + 6);
                        }
                    });
                }
            }
        }
    });
    
    // Custom Legend oluştur
    const legendContainer = document.getElementById('custom-legend');
    if (legendContainer) {
        legendContainer.innerHTML = '';
        platformKeys.forEach((key, index) => {
            const label = lang.platformLabels[key] || key;
            const count = platformCounts[index];
            const color = platformColors[index];
            const iconUrl = platformIconUrls[index];
            
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.gap = '8px';
            legendItem.style.cursor = 'pointer';
            legendItem.style.backgroundColor = 'rgba(0,0,0,0.4)';
            legendItem.style.padding = '6px 14px';
            legendItem.style.borderRadius = '20px';
            legendItem.style.border = `1px solid ${color}`;
            legendItem.style.transition = 'all 0.2s';
            legendItem.style.color = '#f1f5f9';
            legendItem.style.fontSize = '0.85rem';
            
            if (iconUrl && iconUrl !== '') {
                const img = document.createElement('img');
                img.src = iconUrl;
                img.style.width = '20px';
                img.style.height = '20px';
                img.style.marginRight = '6px';
                legendItem.appendChild(img);
            } else {
                const colorBox = document.createElement('span');
                colorBox.style.display = 'inline-block';
                colorBox.style.width = '16px';
                colorBox.style.height = '16px';
                colorBox.style.backgroundColor = color;
                colorBox.style.borderRadius = '50%';
                colorBox.style.marginRight = '6px';
                legendItem.appendChild(colorBox);
            }
            
            const textSpan = document.createElement('span');
            textSpan.innerText = `${label} (${count})`;
            legendItem.appendChild(textSpan);
            
            let hidden = false;
            legendItem.addEventListener('click', () => {
                const meta = platformChart.getDatasetMeta(0);
                meta.data[index].hidden = !meta.data[index].hidden;
                legendItem.style.opacity = meta.data[index].hidden ? '0.5' : '1';
                platformChart.update();
            });
            
            legendContainer.appendChild(legendItem);
        });
    }
    
    // Bar chart
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
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(value.toString(), bar.x, bar.y - 6);
                ctx.restore();
            });
        }, 150);
    }
}