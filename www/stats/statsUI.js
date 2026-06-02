// stats/statsUI.js - İstatistikleri HTML olarak render etme ve grafik çizme
// ✅ GÜNCELLEME (Adım 5.1): renderLearningHeatmap eklendi
// ✅ GÜNCELLEME (Adım 5.3): renderTagCloud eklendi
import { translations } from '../i18n.js';
import { computeLearningHeatmap } from './computeStats.js';
import { store } from '../store.js';
import { filterByTag } from '../navigation.js';

let platformChart = null;
let monthlyChart = null;

// ─────────────────────────────────────────────────────────────
// renderTagCloud  ✅ YENİ (Adım 5.3)
// ─────────────────────────────────────────────────────────────
function renderTagCloud(topTags) {
    if (!topTags || topTags.length === 0) return '<span class="tag-badge">—</span>';

    const neonPalette = [
        '#00f0ff', '#ff007f', '#c084fc', '#facc15', '#34d399',
        '#f97316', '#60a5fa', '#f472b6', '#a3e635', '#fb7185',
    ];

    return topTags.map((t, index) => {
        const fontSize = Math.min(28, 12 + t.count * 2);
        const color = neonPalette[index % neonPalette.length];
        const glowColor = color + '55';
        return `<span
            class="tag-cloud-item"
            data-tag="${t.tag}"
            style="
                font-size: ${fontSize}px;
                color: ${color};
                text-shadow: 0 0 10px ${glowColor}, 0 0 20px ${glowColor};
                border-color: ${color}33;
            "
            title="${t.tag}: ${t.count} video"
        >#${t.tag} <sup style="font-size:0.6em; opacity:0.7;">${t.count}</sup></span>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// renderStats — Ana istatistik render fonksiyonu
// ─────────────────────────────────────────────────────────────
export function renderStats(stats, currentLang) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    const lang = translations[currentLang];

    const tagCloudHTML = renderTagCloud(stats.topTags);
    const noTagsHTML = stats.topTags.length === 0
        ? `<span class="tag-badge">${lang.statsNoTags}</span>`
        : '';

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
            <div class="tag-cloud-container">
                ${tagCloudHTML}
                ${noTagsHTML}
            </div>
            <div class="tag-cloud-hint">
                ${currentLang === 'tr'
                    ? '💡 Bir etikete tıkla → koleksiyon o etiketle filtrelenir'
                    : '💡 Click a tag → collection filters by that tag'}
            </div>
        </div>
        <div class="monthly-chart-container">
            <div class="stat-label stat-label-centered">${lang.statsMonthlyTrend}</div>
            <div class="scrollable-chart" style="overflow-x: auto; width: 100%;">
                <canvas id="monthly-bar-chart" width="${Math.max(700, stats.monthlyData.length * 80)}" height="350" style="width: auto; height: auto; display: block;"></canvas>
            </div>
        </div>
        <div id="learning-heatmap-container"></div>
    `;

    // ✅ Adım 5.3: Etiket tıklama olayları
    const tagCloudContainer = container.querySelector('.tag-cloud-container');
    if (tagCloudContainer) {
        tagCloudContainer.addEventListener('click', (e) => {
            const tagItem = e.target.closest('.tag-cloud-item');
            if (!tagItem) return;
            const tagName = tagItem.dataset.tag;
            if (tagName) filterByTag(tagName);
        });
    }

    // ── Pie Chart (ORIJINAL YAPI) ──────────────────────────────
    const platformKeys = [];
    const platformCounts = [];
    const platformColors = [];
    const platformIconUrls = [];
    for (const [key, count] of Object.entries(stats.platformCounts)) {
        if (count > 0) {
            platformKeys.push(key);
            platformCounts.push(count);
            switch (key) {
                case 'drive':     platformColors.push('#4285F4'); platformIconUrls.push(lang.platformIconUrls.drive); break;
                case 'youtube':   platformColors.push('#FF0000'); platformIconUrls.push(lang.platformIconUrls.youtube); break;
                case 'instagram': platformColors.push('#E4405F'); platformIconUrls.push(lang.platformIconUrls.instagram); break;
                case 'facebook':  platformColors.push('#1877F2'); platformIconUrls.push(lang.platformIconUrls.facebook); break;
                default:          platformColors.push('#00f0ff'); platformIconUrls.push('');
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
                img.style.cssText = `position:absolute;width:36px;height:36px;object-fit:contain;left:${x - 18}px;top:${y - 18}px;pointer-events:none;z-index:10;`;
                chartContainer.appendChild(img);
            } else {
                const label = document.createElement('div');
                label.className = 'pie-icon-overlay';
                label.innerText = platformCounts[index];
                label.style.cssText = `position:absolute;color:#fff;font-weight:bold;font-size:14px;left:${x - 10}px;top:${y - 8}px;pointer-events:none;z-index:10;`;
                chartContainer.appendChild(label);
            }
        });
    }

    const resizeHandler = () => { placeIconOverlays(); };
    window.removeEventListener('resize', window._pieResizeHandler);
    window._pieResizeHandler = resizeHandler;
    window.addEventListener('resize', resizeHandler);

    const ctxPie = document.getElementById('platform-pie-chart').getContext('2d');
    if (platformChart) platformChart.destroy();
    platformChart = new Chart(ctxPie, {
        type: 'pie',
        data: {
            labels: platformKeys.map(k => lang.platformLabels[k] || k),
            datasets: [{ data: platformCounts, backgroundColor: platformColors, borderWidth: 1 }]
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
            legendItem.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;background:rgba(0,0,0,0.4);padding:6px 14px;border-radius:20px;color:#f1f5f9;font-size:0.85rem;';
            legendItem.style.border = `1px solid ${color}`;
            if (iconUrl && iconUrl !== '') {
                const img = document.createElement('img');
                img.src = iconUrl;
                img.style.cssText = 'width:20px;height:20px;margin-right:6px;';
                legendItem.appendChild(img);
            } else {
                const colorBox = document.createElement('span');
                colorBox.style.cssText = `display:inline-block;width:16px;height:16px;background:${color};border-radius:50%;margin-right:6px;`;
                legendItem.appendChild(colorBox);
            }
            const textSpan = document.createElement('span');
            textSpan.innerText = `${label} (${count})`;
            legendItem.appendChild(textSpan);
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

    // ── Bar Chart ──────────────────────────────────────────────
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
                    x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 11 } } }
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
            meta.data.forEach((bar, index) => {
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

    // ── Heatmap (Adım 5.1) ────────────────────────────────────
    const videos = store.get('globalVideos');
    const currentYear = new Date().getFullYear();
    const heatmapData = computeLearningHeatmap(videos, currentYear);
    renderLearningHeatmap(heatmapData, currentLang);
}

// ─────────────────────────────────────────────────────────────
// renderLearningHeatmap  ✅ YENİ (Adım 5.1)
// ─────────────────────────────────────────────────────────────
function renderLearningHeatmap(heatmapData, currentLang) {
    const container = document.getElementById('learning-heatmap-container');
    if (!container) return;

    const { weeks, year } = heatmapData;
    if (!weeks || weeks.length === 0) return;

    const CELL = 11;
    const GAP  = 2;
    const STEP = CELL + GAP;
    const PAD_LEFT = 30;
    const PAD_TOP  = 22;

    function cellColor(total) {
        if (total === 0) return 'rgba(255,255,255,0.05)';
        if (total === 1) return 'rgba(0,240,255,0.30)';
        if (total === 2) return 'rgba(0,240,255,0.60)';
        if (total <= 4)  return 'rgba(255,0,127,0.55)';
        return                  'rgba(255,0,127,0.90)';
    }

    const monthNames = currentLang === 'tr'
        ? ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
        : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const dayLabels = currentLang === 'tr'
        ? ['', 'Pzt', '', 'Çar', '', 'Cum', '']
        : ['', 'Mon', '', 'Wed', '', 'Fri', ''];

    let rects = '';
    weeks.forEach((week, wIdx) => {
        week.forEach((day, dIdx) => {
            if (!day) return;
            const x = PAD_LEFT + wIdx * STEP;
            const y = PAD_TOP + dIdx * STEP;
            const color = cellColor(day.total);
            rects += `<rect class="hm-cell" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2" fill="${color}" data-date="${day.date}" data-add="${day.addCount}" data-prac="${day.practiceCount}" data-total="${day.total}"/>`;
        });
    });

    let monthLabels = '';
    const seenMonths = new Set();
    weeks.forEach((week, wIdx) => {
        week.forEach((day) => {
            if (!day) return;
            const d = new Date(day.date + 'T12:00:00');
            if (d.getDate() === 1) {
                const m = d.getMonth();
                if (!seenMonths.has(m)) {
                    seenMonths.add(m);
                    const x = PAD_LEFT + wIdx * STEP;
                    monthLabels += `<text x="${x}" y="${PAD_TOP - 6}" fill="#64748b" font-size="9" font-family="Plus Jakarta Sans,sans-serif">${monthNames[m]}</text>`;
                }
            }
        });
    });

    let dayLabelsSvg = '';
    dayLabels.forEach((label, dIdx) => {
        if (!label) return;
        const y = PAD_TOP + dIdx * STEP + CELL;
        dayLabelsSvg += `<text x="${PAD_LEFT - 4}" y="${y}" fill="#64748b" font-size="9" text-anchor="end" font-family="Plus Jakarta Sans,sans-serif">${label}</text>`;
    });

    const legendY = PAD_TOP + 7 * STEP + 12;
    const legendColors = ['rgba(255,255,255,0.05)', 'rgba(0,240,255,0.30)', 'rgba(0,240,255,0.60)', 'rgba(255,0,127,0.55)', 'rgba(255,0,127,0.90)'];
    const lessLabel = currentLang === 'tr' ? 'Az' : 'Less';
    const moreLabel = currentLang === 'tr' ? 'Çok' : 'More';
    let legendSvg = `<text x="${PAD_LEFT}" y="${legendY + 9}" fill="#475569" font-size="9" font-family="Plus Jakarta Sans,sans-serif">${lessLabel}</text>`;
    legendColors.forEach((c, i) => {
        legendSvg += `<rect x="${PAD_LEFT + 24 + i * 14}" y="${legendY}" width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`;
    });
    legendSvg += `<text x="${PAD_LEFT + 24 + legendColors.length * 14 + 4}" y="${legendY + 9}" fill="#475569" font-size="9" font-family="Plus Jakarta Sans,sans-serif">${moreLabel}</text>`;

    const svgW = PAD_LEFT + weeks.length * STEP + 10;
    const svgH = legendY + 20;

    const titleText = currentLang === 'tr'
        ? `📅 Yıllık Aktivite Haritası — ${year}`
        : `📅 Annual Activity Map — ${year}`;

    container.innerHTML = `
        <div class="heatmap-section">
            <div class="heatmap-title">${titleText}</div>
            <div class="heatmap-scroll-wrapper">
                <svg class="heatmap-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="min-width:${svgW}px; height:${svgH}px;">
                    ${monthLabels}
                    ${dayLabelsSvg}
                    ${rects}
                    ${legendSvg}
                </svg>
                <div id="hm-tooltip" class="heatmap-tooltip"></div>
            </div>
        </div>`;

    const wrapper = container.querySelector('.heatmap-scroll-wrapper');
    const tooltip  = container.querySelector('#hm-tooltip');

    wrapper.addEventListener('mousemove', (e) => {
        const target = e.target;
        if (!target.classList.contains('hm-cell')) {
            tooltip.style.display = 'none';
            return;
        }
        const date     = target.dataset.date;
        const addCnt   = parseInt(target.dataset.add   || 0);
        const pracCnt  = parseInt(target.dataset.prac  || 0);
        const total    = parseInt(target.dataset.total || 0);
        const d = new Date(date + 'T12:00:00');
        const locale = currentLang === 'tr' ? 'tr-TR' : 'en-US';
        const dateStr = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
        if (total === 0) {
            tooltip.textContent = currentLang === 'tr'
                ? `${dateStr} — aktivite yok`
                : `${dateStr} — no activity`;
        } else {
            const parts = [];
            if (addCnt  > 0) parts.push(currentLang === 'tr' ? `${addCnt} video eklendi`  : `${addCnt} added`);
            if (pracCnt > 0) parts.push(currentLang === 'tr' ? `${pracCnt} pratik yapıldı` : `${pracCnt} practiced`);
            tooltip.textContent = `${dateStr}: ${parts.join(', ')}`;
        }
        const wrapRect = wrapper.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - wrapRect.left + 12) + 'px';
        tooltip.style.top  = (e.clientY - wrapRect.top  - 38) + 'px';
    });

    wrapper.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
}