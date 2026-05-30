// stats/statsUI.js - İstatistikleri HTML olarak render etme ve grafik çizme
import { translations } from '../i18n.js';

let platformChart = null;
let monthlyChart = null;

export function renderStats(stats, currentLang) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    const lang = translations[currentLang];
    
    // HTML yapısı
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
        <div class="platform-chart-container" style="min-height: 650px; margin: 20px 0 30px 0; position: relative;">
            <div class="stat-label stat-label-centered" style="margin-bottom: 40px;">${lang.statsPlatformDistribution}</div>
            <canvas id="platform-pie-chart" width="550" height="500" style="display: block; margin: 0 auto; background: transparent;"></canvas>
            <div id="custom-legend" style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-top: 100px; margin-bottom: 20px;"></div>
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
    
    // Pie Chart verileri
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
    
    function placeIconOverlays() {
        document.querySelectorAll('.pie-icon-overlay').forEach(el => el.remove());
        const canvas = document.getElementById('platform-pie-chart');
        const chartContainer = document.querySelector('.platform-chart-container');
        if (!canvas || !chartContainer || !platformChart) return;
        const meta = platformChart.getDatasetMeta(0);
        const arcs = meta.data;
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = chartContainer.getBoundingClientRect();
        if (canvasRect.width === 0) return;
        const canvasOffsetLeft = canvasRect.left - containerRect.left;
        const canvasOffsetTop  = canvasRect.top  - containerRect.top;
        const scaleX = canvasRect.width  / canvas.width;
        const scaleY = canvasRect.height / canvas.height;
        arcs.forEach((arc, index) => {
            if (arc.hidden) return;
            const midAngle = arc.startAngle + (arc.endAngle - arc.startAngle) / 2;
            const radius   = arc.outerRadius + 36;
            const xInCanvas = arc.x + Math.cos(midAngle) * radius;
            const yInCanvas = arc.y + Math.sin(midAngle) * radius;
            const x = canvasOffsetLeft + xInCanvas * scaleX;
            const y = canvasOffsetTop  + yInCanvas * scaleY;
            const imgUrl = platformIconUrls[index];
            if (imgUrl && imgUrl !== '') {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.className = 'pie-icon-overlay';
                img.style.cssText = `
                    position: absolute;
                    width: 36px;
                    height: 36px;
                    object-fit: contain;
                    left: ${x - 18}px;
                    top: ${y - 18}px;
                    pointer-events: none;
                    z-index: 10;
                    transform: translate(0, 0);
                `;
                chartContainer.appendChild(img);
            } else {
                const label = document.createElement('div');
                label.className = 'pie-icon-overlay';
                label.innerText = platformCounts[index];
                label.style.cssText = `
                    position: absolute;
                    color: #fff;
                    font-weight: bold;
                    font-size: 14px;
                    left: ${x - 10}px;
                    top: ${y - 8}px;
                    pointer-events: none;
                    z-index: 10;
                `;
                chartContainer.appendChild(label);
            }
        });
    }
    
    const ctxPie = document.getElementById('platform-pie-chart').getContext('2d');
    if (platformChart) platformChart.destroy();
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
            layout: { padding: { top: 30, bottom: 30, left: 30, right: 30 } },
            animation: { onComplete: placeIconOverlays }
        }
    });
    
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
                setTimeout(() => { placeIconOverlays(); }, 200);
            });
            legendContainer.appendChild(legendItem);
        });
    }
    
    const resizeHandler = () => { placeIconOverlays(); };
    window.removeEventListener('resize', window._pieResizeHandler);
    window._pieResizeHandler = resizeHandler;
    window.addEventListener('resize', resizeHandler);
    
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
                plugins: { tooltip: { enabled: false }, legend: { display: false } },
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