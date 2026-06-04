// stats/statsUI.js - İstatistikleri HTML olarak render etme ve grafik çizme
// ✅ GÜNCELLEME (Adım 5.1): renderLearningHeatmap eklendi
// ✅ GÜNCELLEME (Adım 5.3): renderTagCloud eklendi
// ✅ GÜNCELLEME (Adım 5.4): Yıl seçici ve renderMonthlyChart eklendi
// ✅ GÜNCELLEME (Platform Chart v2): Pasta grafik → Yatay çubuk grafik
// ✅ GÜNCELLEME (Chart v3):
//    - Aylık bar grafik sayıları: Chart.js plugin ile güvenilir rendering
//    - Heatmap yazıları: daha parlak renk + büyük font (PC uyumu)
//    - Etiket ağ haritası: dinamik yükseklik + fit() ile kesilme sorunu düzeltildi
import { translations } from '../i18n.js';
import { computeLearningHeatmap, computeMonthlyData, getAvailableYears, computeTagNetwork } from './computeStats.js';
import { store } from '../store.js';
import { filterByTag } from '../navigation.js';

let platformChart = null;
let monthlyChart  = null;
let tagNetwork    = null;

// ─────────────────────────────────────────────────────────────
// renderTagCloud
// ─────────────────────────────────────────────────────────────
function renderTagCloud(topTags) {
    if (!topTags || topTags.length === 0) return '<span class="tag-badge">—</span>';
    const neonPalette = [
        '#00f0ff','#ff007f','#c084fc','#facc15','#34d399',
        '#f97316','#60a5fa','#f472b6','#a3e635','#fb7185',
    ];
    return topTags.map((t, index) => {
        const fontSize  = Math.min(28, 12 + t.count * 2);
        const color     = neonPalette[index % neonPalette.length];
        const glowColor = color + '55';
        return `<span
            class="tag-cloud-item"
            data-tag="${t.tag}"
            style="font-size:${fontSize}px;color:${color};text-shadow:0 0 10px ${glowColor},0 0 20px ${glowColor};border-color:${color}33;"
            title="${t.tag}: ${t.count} video"
        >#${t.tag} <sup style="font-size:0.6em;opacity:0.7;">${t.count}</sup></span>`;
    }).join('');
}

// ─────────────────────────────────────────────────────────────
// renderTagNetwork
// ✅ DÜZELTME: stabilizasyon sonrası fit(padding:60) + dinamik yükseklik
// ─────────────────────────────────────────────────────────────
function renderTagNetwork(networkData, currentLang) {
    const container = document.getElementById('tag-network-container');
    if (!container) return;
    if (tagNetwork) { tagNetwork.destroy(); tagNetwork = null; }

    if (!networkData.nodes || networkData.nodes.length < 2 || networkData.edges.length === 0) {
        container.style.height = 'auto';
        container.innerHTML = `<div class="info-msg" style="padding:24px;text-align:center;opacity:0.7;">
            ${currentLang === 'tr'
                ? 'Ağ haritası için henüz yeterli etiket bağlantısı yok. Aynı etiketleri birden fazla videoda kullandıkça buradaki bağlantılar oluşacak.'
                : 'Not enough tag connections for a network map yet. As you reuse the same tags across multiple videos, connections will appear here.'}
        </div>`;
        return;
    }

    // Başlangıçta yeterli yükseklik ver; dinamik olarak küçülecek
    container.style.height = '600px';

    const Network = window.vis?.Network;
    if (!Network) {
        container.innerHTML = '<div class="info-msg" style="padding:24px;text-align:center;opacity:0.5;">vis.js yüklenemedi.</div>';
        return;
    }

    const nodesDs = new window.vis.DataSet(networkData.nodes.map(n => ({
        id: n.id, label: n.label, value: n.value,
        color: { background: '#ff007f44', border: '#ff007f', highlight: { background: '#ff007faa', border: '#ff007f' } },
        font: { color: '#f1f5f9', size: 13, face: 'Plus Jakarta Sans' },
        borderWidth: 2
    })));
    const edgesDs = new window.vis.DataSet(networkData.edges.map(e => ({
        from: e.from, to: e.to, value: e.value,
        color: { color: '#00f0ff33', highlight: '#00f0ff' }, width: 1
    })));

    tagNetwork = new Network(
        container,
        { nodes: nodesDs, edges: edgesDs },
        {
            physics: {
                stabilization: { iterations: 150, fit: false }
            },
            interaction: { hover: true },
            nodes: { shape: 'dot', scaling: { min: 10, max: 30 } },
            edges: { smooth: { type: 'dynamic' } }
        }
    );

    // ── Stabilizasyon tamamlanınca: fit + dinamik yükseklik ──
    tagNetwork.on('stabilizationIterationsDone', () => {
        // 1. Tüm düğümleri görünür alana sığdır (60px kenar boşluğuyla)
        tagNetwork.fit({
            animation: { duration: 500, easingFunction: 'easeOutQuad' },
            padding: 60
        });

        // 2. Fit animasyonu bittikten sonra gereksiz boş alanı kırp
        setTimeout(() => {
            try {
                const positions = tagNetwork.getPositions();
                const nodeIds   = Object.keys(positions);
                if (!nodeIds.length) return;

                const scale   = tagNetwork.getScale();
                const view    = tagNetwork.getViewPosition();
                const canvasH = container.offsetHeight;

                // Ağ koordinatlarını canvas koordinatlarına çevir
                const canvasYs = nodeIds.map(id => {
                    const p = positions[id];
                    return (p.y - view.y) * scale + canvasH / 2;
                });

                const minY    = Math.min(...canvasYs);
                const maxY    = Math.max(...canvasYs);
                const NODE_PAD = 55; // düğüm yarıçapı + etiket yüksekliği + görsel boşluk

                const neededH = (maxY - minY) + NODE_PAD * 2;
                const finalH  = Math.max(320, Math.min(750, neededH));

                // Sadece anlamlı küçülmede yeniden boyutlandır (≥ 60px kazanç)
                if (container.offsetHeight - finalH >= 60) {
                    container.style.height = finalH + 'px';
                    // Yeni boyuta göre yeniden fit yap
                    tagNetwork.redraw();
                    tagNetwork.fit({ animation: false, padding: 60 });
                }
            } catch (e) {
                console.warn('Ağ haritası yeniden boyutlandırma:', e);
            }
        }, 600); // fit animasyonu (500ms) + güvenlik marjı (100ms)
    });

    // Düğüme tıkla → filtreleme
    tagNetwork.on('click', (params) => {
        if (params.nodes.length > 0) {
            const tagName = params.nodes[0];
            if (tagName) filterByTag(tagName);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// renderPlatformBarChart (Platform Chart v2 — yatay çubuk)
// ─────────────────────────────────────────────────────────────
function renderPlatformBarChart(stats, lang, currentLang) {
    const container = document.getElementById('platform-bar-chart');
    if (!container) return;

    if (platformChart) { platformChart.destroy(); platformChart = null; }
    document.querySelectorAll('.pie-icon-overlay').forEach(el => el.remove());
    if (window._pieResizeHandler) {
        window.removeEventListener('resize', window._pieResizeHandler);
        window._pieResizeHandler = null;
    }

    const platformConfig = {
        drive:     { color: '#4285F4', icon: lang.platformIconUrls?.drive     || '' },
        youtube:   { color: '#FF0000', icon: lang.platformIconUrls?.youtube   || '' },
        instagram: { color: '#E4405F', icon: lang.platformIconUrls?.instagram || '' },
        facebook:  { color: '#1877F2', icon: lang.platformIconUrls?.facebook  || '' },
        other:     { color: '#00f0ff', icon: '' }
    };

    const total = Object.values(stats.platformCounts).reduce((s, v) => s + v, 0);

    if (total === 0) {
        container.innerHTML = `<div style="text-align:center;opacity:0.5;padding:32px;font-size:0.9rem;">
            ${currentLang === 'tr' ? 'Henüz video eklenmedi.' : 'No videos added yet.'}
        </div>`;
        return;
    }

    const sorted = Object.entries(stats.platformCounts)
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);

    const rows = sorted.map(([key, count]) => {
        const cfg      = platformConfig[key] || platformConfig.other;
        const label    = lang.platformLabels?.[key] || key;
        const pct      = ((count / total) * 100).toFixed(1);
        const widthPct = (count / total) * 100;
        const color    = cfg.color;
        const glow1    = color + '60';
        const glow2    = color + '25';

        const iconHtml = cfg.icon
            ? `<img src="${cfg.icon}" alt="${label}" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" />`
            : `<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${color};box-shadow:0 0 8px ${glow1};flex-shrink:0;"></span>`;

        return `
        <div style="display:grid;grid-template-columns:160px 1fr 80px;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex;align-items:center;gap:10px;overflow:hidden;">
                ${iconHtml}
                <span style="font-size:0.88rem;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</span>
            </div>
            <div style="position:relative;height:20px;background:rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
                <div style="position:absolute;top:0;left:0;height:100%;width:${widthPct}%;background:linear-gradient(90deg,${color},${color}bb);box-shadow:0 0 14px ${glow1},0 0 6px ${glow2};border-radius:10px;transition:width 0.8s cubic-bezier(0.25,0.46,0.45,0.94);"></div>
            </div>
            <div style="text-align:right;white-space:nowrap;">
                <span style="font-size:0.88rem;font-weight:700;color:${color};text-shadow:0 0 8px ${glow1};">${count}</span>
                <span style="font-size:0.78rem;color:#64748b;margin-left:5px;">${pct}%</span>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div style="background:rgba(11,8,19,0.5);border:1px solid rgba(0,240,255,0.15);border-radius:16px;padding:20px 24px;">
            <div style="display:grid;grid-template-columns:160px 1fr 80px;gap:12px;margin-bottom:4px;">
                <span style="font-size:0.72rem;color:#475569;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${currentLang === 'tr' ? 'PLATFORM' : 'PLATFORM'}</span>
                <span style="font-size:0.72rem;color:#475569;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">${currentLang === 'tr' ? 'DAĞILIM' : 'DISTRIBUTION'}</span>
                <span style="font-size:0.72rem;color:#475569;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;text-align:right;">${currentLang === 'tr' ? 'VİDEO' : 'VIDEOS'}</span>
            </div>
            ${rows}
            <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);text-align:right;font-size:0.8rem;color:#475569;">
                ${currentLang === 'tr' ? 'Toplam' : 'Total'}:
                <span style="color:#00f0ff;font-weight:700;margin-left:4px;">${total}</span>
                ${currentLang === 'tr' ? 'video' : 'videos'}
            </div>
        </div>`;
}

// ─────────────────────────────────────────────────────────────
// renderStats — Ana istatistik render fonksiyonu
// ─────────────────────────────────────────────────────────────
export function renderStats(stats, currentLang) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    const lang = translations[currentLang];

    const tagCloudHTML = renderTagCloud(stats.topTags);
    const noTagsHTML   = stats.topTags.length === 0
        ? `<span class="tag-badge">${lang.statsNoTags}</span>`
        : '';

    const videos         = store.get('globalVideos');
    const availableYears = getAvailableYears(videos);
    const currentYear    = new Date().getFullYear();
    const defaultYear    = availableYears.includes(currentYear) ? currentYear : (availableYears[0] || currentYear);

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

        <div style="margin:24px 0 32px 0;">
            <div class="stat-label stat-label-centered" style="margin-bottom:16px;">
                ${lang.statsPlatformDistribution}
            </div>
            <div id="platform-bar-chart"></div>
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
            <div class="monthly-chart-header">
                <div class="stat-label stat-label-centered">${lang.statsMonthlyTrend}</div>
                <div class="year-dropdown-wrapper">
                    <button id="year-dropdown-trigger" class="year-dropdown-trigger">
                        <span id="year-dropdown-label">${defaultYear}</span>
                        <span class="year-dropdown-arrow">▾</span>
                    </button>
                    <div id="year-dropdown-menu" class="year-dropdown-menu"></div>
                </div>
            </div>
            <div class="scrollable-chart" style="overflow-x:auto;width:100%;">
                <canvas id="monthly-bar-chart"
                    width="${Math.max(700, stats.monthlyData.length * 80)}"
                    height="380"
                    style="width:auto;height:auto;display:block;"></canvas>
            </div>
        </div>

        <div id="learning-heatmap-container"></div>

        <div class="stats-tag-network" style="margin-top:30px;">
            <div class="stat-label stat-label-centered">
                ${currentLang === 'tr' ? '🔗 Etiket Bağlantı Haritası' : '🔗 Tag Connection Map'}
            </div>
            <div style="text-align:center;opacity:0.6;font-size:0.85rem;margin:8px 0 12px 0;">
                ${currentLang === 'tr'
                    ? '💡 Bir düğüme tıkla → koleksiyon o etiketle filtrelenir. Düğümleri sürükleyerek gezebilirsin.'
                    : '💡 Click a node → collection filters by that tag. Drag nodes to explore.'}
            </div>
            <div id="tag-network-container"
                style="background:rgba(11,8,19,0.4);border:1px solid rgba(0,240,255,0.2);border-radius:16px;"></div>
        </div>
    `;

    const tagCloudContainer = container.querySelector('.tag-cloud-container');
    if (tagCloudContainer) {
        tagCloudContainer.addEventListener('click', (e) => {
            const tagItem = e.target.closest('.tag-cloud-item');
            if (!tagItem) return;
            const tagName = tagItem.dataset.tag;
            if (tagName) filterByTag(tagName);
        });
    }

    setupCustomYearDropdown(availableYears, defaultYear, videos);
    renderPlatformBarChart(stats, lang, currentLang);
    renderMonthlyChart(stats.monthlyData);

    const heatmapData = computeLearningHeatmap(videos, new Date().getFullYear());
    renderLearningHeatmap(heatmapData, currentLang);

    const tagNetworkData = computeTagNetwork(videos);
    renderTagNetwork(tagNetworkData, currentLang);
}

// ─────────────────────────────────────────────────────────────
// renderMonthlyChart
// ✅ DÜZELTME: Chart.js plugin ile bar üstü sayılar (setTimeout yerine)
//   - setTimeout yaklaşımı güvensizdi: Chart.js yeniden çizimde silerdi
//   - Plugin her render'da çalışır → sayılar kalıcı ve doğru
//   - layout.padding.top artırıldı (sayılar canvas dışına taşmasın)
//   - Sayılar interaktif: video silinince ilgili ayın sayısı otomatik düşer
//     (computeStats() globalVideos'tan hesaplar, silinen video dahil değildir)
// ─────────────────────────────────────────────────────────────
function renderMonthlyChart(monthlyData) {
    const canvasBar = document.getElementById('monthly-bar-chart');
    if (!canvasBar) return;
    const ctxBar = canvasBar.getContext('2d');
    if (monthlyChart) monthlyChart.destroy();

    const months = monthlyData.map(m => m.label);
    const counts = monthlyData.map(m => m.count);

    canvasBar.width = Math.max(700, monthlyData.length * 80);

    // ── Bar üstü sayı plugin'i ─────────────────────────────
    // afterDatasetsDraw: Chart.js her çizimde bu hook'u çağırır.
    // setTimeout gibi tek seferlik ve kaybolabilir bir yaklaşım değil.
    const barLabelPlugin = {
        id: 'barLabels',
        afterDatasetsDraw(chart) {
            const { ctx } = chart;
            const dataset = chart.data.datasets[0];
            const meta    = chart.getDatasetMeta(0);

            dataset.data.forEach((value, index) => {
                if (!value) return;
                const bar = meta.data[index];
                if (!bar) return;

                ctx.save();

                // Neon pembe glow efekti
                ctx.shadowColor = 'rgba(255, 0, 127, 0.8)';
                ctx.shadowBlur  = 10;
                ctx.fillStyle   = '#ffffff';
                ctx.font        = `bold 13px "Plus Jakarta Sans", Arial, sans-serif`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'bottom';

                // Barın tam üstüne yaz (8px boşlukla)
                ctx.fillText(String(value), bar.x, bar.y - 8);

                ctx.restore();
            });
        }
    };

    monthlyChart = new Chart(ctxBar, {
        type: 'bar',
        // ↓ Plugin'i chart'a kaydet
        plugins: [barLabelPlugin],
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
                legend:  { display: false }
            },
            // ↓ Sayılar için yeterli üst boşluk (eski 25'ten 45'e çıkarıldı)
            layout: { padding: { top: 45, bottom: 5 } }
        }
    });
}

// ─────────────────────────────────────────────────────────────
// setupCustomYearDropdown
// ─────────────────────────────────────────────────────────────
function setupCustomYearDropdown(availableYears, defaultYear, videos) {
    const trigger = document.getElementById('year-dropdown-trigger');
    const menu    = document.getElementById('year-dropdown-menu');
    const label   = document.getElementById('year-dropdown-label');
    if (!trigger || !menu || !label) return;

    let selectedYear = defaultYear;

    menu.innerHTML = availableYears.map(y => `
        <div class="year-dropdown-item ${y === defaultYear ? 'active' : ''}" data-year="${y}">${y}</div>
    `).join('');

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.classList.contains('open');
        menu.classList.toggle('open', !isOpen);
        trigger.classList.toggle('open', !isOpen);
    });

    menu.addEventListener('click', (e) => {
        const item = e.target.closest('.year-dropdown-item');
        if (!item) return;
        const year = parseInt(item.dataset.year);
        selectedYear = year;
        label.textContent = year;
        menu.querySelectorAll('.year-dropdown-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        menu.classList.remove('open');
        trigger.classList.remove('open');
        const newMonthlyData = computeMonthlyData(videos, year);
        renderMonthlyChart(newMonthlyData);
    });

    document.addEventListener('click', () => {
        menu.classList.remove('open');
        trigger.classList.remove('open');
    });
}

// ─────────────────────────────────────────────────────────────
// renderLearningHeatmap
// ✅ DÜZELTME: Yazı rengi ve boyutu PC için iyileştirildi
//   - Ay/gün etiketleri: #64748b → #94a3b8 (daha parlak)
//   - Font boyutu: 9px → 11px (daha okunabilir)
// ─────────────────────────────────────────────────────────────
function renderLearningHeatmap(heatmapData, currentLang) {
    const container = document.getElementById('learning-heatmap-container');
    if (!container) return;
    const { weeks, year } = heatmapData;
    if (!weeks || weeks.length === 0) return;

    const CELL     = 11;
    const GAP      = 2;
    const STEP     = CELL + GAP;
    const PAD_LEFT = 34;  // Gün etiketleri için biraz daha geniş
    const PAD_TOP  = 24;

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

    // ── Hücre dikdörtgenleri ─────────────────────────────────
    let rects = '';
    weeks.forEach((week, wIdx) => {
        week.forEach((day, dIdx) => {
            if (!day) return;
            const x     = PAD_LEFT + wIdx * STEP;
            const y     = PAD_TOP  + dIdx * STEP;
            const color = cellColor(day.total);
            rects += `<rect class="hm-cell" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="2"
                fill="${color}"
                data-date="${day.date}" data-add="${day.addCount}"
                data-prac="${day.practiceCount}" data-total="${day.total}"/>`;
        });
    });

    // ── Ay etiketleri ─────────────────────────────────────────
    // ✅ Renk #94a3b8 (eski: #64748b), font-size 11 (eski: 9)
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
                    monthLabels += `<text x="${x}" y="${PAD_TOP - 7}"
                        fill="#94a3b8"
                        font-size="11"
                        font-weight="500"
                        font-family="Plus Jakarta Sans,sans-serif">${monthNames[m]}</text>`;
                }
            }
        });
    });

    // ── Gün etiketleri ────────────────────────────────────────
    // ✅ Renk #94a3b8 (eski: #64748b), font-size 11 (eski: 9)
    let dayLabelsSvg = '';
    dayLabels.forEach((lbl, dIdx) => {
        if (!lbl) return;
        const y = PAD_TOP + dIdx * STEP + CELL;
        dayLabelsSvg += `<text x="${PAD_LEFT - 5}" y="${y}"
            fill="#94a3b8"
            font-size="11"
            font-weight="500"
            text-anchor="end"
            font-family="Plus Jakarta Sans,sans-serif">${lbl}</text>`;
    });

    // ── Lejant ────────────────────────────────────────────────
    const legendY      = PAD_TOP + 7 * STEP + 14;
    const legendColors = [
        'rgba(255,255,255,0.05)',
        'rgba(0,240,255,0.30)',
        'rgba(0,240,255,0.60)',
        'rgba(255,0,127,0.55)',
        'rgba(255,0,127,0.90)'
    ];
    const lessLabel = currentLang === 'tr' ? 'Az' : 'Less';
    const moreLabel = currentLang === 'tr' ? 'Çok' : 'More';

    // ✅ Lejant yazı rengi de güncellendi
    let legendSvg = `<text x="${PAD_LEFT}" y="${legendY + 9}"
        fill="#94a3b8" font-size="10" font-weight="500"
        font-family="Plus Jakarta Sans,sans-serif">${lessLabel}</text>`;
    legendColors.forEach((c, i) => {
        legendSvg += `<rect x="${PAD_LEFT + 24 + i * 14}" y="${legendY}"
            width="${CELL}" height="${CELL}" rx="2" fill="${c}"/>`;
    });
    legendSvg += `<text x="${PAD_LEFT + 24 + legendColors.length * 14 + 4}" y="${legendY + 9}"
        fill="#94a3b8" font-size="10" font-weight="500"
        font-family="Plus Jakarta Sans,sans-serif">${moreLabel}</text>`;

    const svgW      = PAD_LEFT + weeks.length * STEP + 10;
    const svgH      = legendY + 22;
    const titleText = currentLang === 'tr'
        ? `📅 Yıllık Aktivite Haritası — ${year}`
        : `📅 Annual Activity Map — ${year}`;

    container.innerHTML = `
        <div class="heatmap-section">
            <div class="heatmap-title">${titleText}</div>
            <div class="heatmap-scroll-wrapper">
                <svg class="heatmap-svg"
                    viewBox="0 0 ${svgW} ${svgH}"
                    xmlns="http://www.w3.org/2000/svg"
                    style="min-width:${svgW}px;height:${svgH}px;">
                    ${monthLabels}
                    ${dayLabelsSvg}
                    ${rects}
                    ${legendSvg}
                </svg>
                <div id="hm-tooltip" class="heatmap-tooltip"></div>
            </div>
        </div>`;

    const wrapper = container.querySelector('.heatmap-scroll-wrapper');
    const tooltip = container.querySelector('#hm-tooltip');

    wrapper.addEventListener('mousemove', (e) => {
        const target = e.target;
        if (!target.classList.contains('hm-cell')) {
            tooltip.style.display = 'none';
            return;
        }
        const date    = target.dataset.date;
        const addCnt  = parseInt(target.dataset.add   || 0);
        const pracCnt = parseInt(target.dataset.prac  || 0);
        const total   = parseInt(target.dataset.total || 0);
        const d       = new Date(date + 'T12:00:00');
        const locale  = currentLang === 'tr' ? 'tr-TR' : 'en-US';
        const dateStr = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

        if (total === 0) {
            tooltip.textContent = currentLang === 'tr'
                ? `${dateStr} — aktivite yok`
                : `${dateStr} — no activity`;
        } else {
            const parts = [];
            if (addCnt  > 0) parts.push(currentLang === 'tr' ? `${addCnt} video eklendi`   : `${addCnt} added`);
            if (pracCnt > 0) parts.push(currentLang === 'tr' ? `${pracCnt} pratik yapıldı` : `${pracCnt} practiced`);
            tooltip.textContent = `${dateStr}: ${parts.join(', ')}`;
        }
        const wrapRect = wrapper.getBoundingClientRect();
        tooltip.style.display = 'block';
        tooltip.style.left    = (e.clientX - wrapRect.left + 12) + 'px';
        tooltip.style.top     = (e.clientY - wrapRect.top  - 38) + 'px';
    });

    wrapper.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });
}