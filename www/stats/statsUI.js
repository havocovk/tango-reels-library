// stats/statsUI.js
// Ana istatistik render koordinatörü.
// ✅ YENİDEN YAPILANDIRILDI: Büyük fonksiyonlar ayrı modüllere taşındı:
//   - chartRenderers.js  → renderPlatformBarChart, renderMonthlyChart, setupCustomYearDropdown
//   - heatmapRenderer.js → renderLearningHeatmap, setupHeatmapYearDropdown
//   - sessionHistory.js  → renderSessionHistory, loadAndRenderSessions

import { translations } from '../i18n.js';
import { computeLearningHeatmap, computeMonthlyData, getAvailableYears, computeTagNetwork } from './computeStats.js';
import { store } from '../store.js';
import { filterByTag } from '../navigation.js';
import { icon } from '../icons.js';
import { dbFetchMonthlyStats } from '../tangoVeritabani.js';
import { computeBadgeData, renderBadgePanel } from '../badgeSystem.js';

import { renderPlatformBarChart, renderMonthlyChart, setupCustomYearDropdown } from './chartRenderers.js';
import { renderLearningHeatmap, setupHeatmapYearDropdown } from './heatmapRenderer.js';
import { renderSessionHistory } from './sessionHistory.js';

let tagNetwork = null;

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
            physics: { stabilization: { iterations: 150, fit: false } },
            interaction: { hover: true },
            nodes: { shape: 'dot', scaling: { min: 10, max: 30 } },
            edges: { smooth: { type: 'dynamic' } }
        }
    );

    tagNetwork.on('stabilizationIterationsDone', () => {
        tagNetwork.fit({
            animation: { duration: 500, easingFunction: 'easeOutQuad' },
            padding: 60
        });

        setTimeout(() => {
            try {
                const positions = tagNetwork.getPositions();
                const nodeIds   = Object.keys(positions);
                if (!nodeIds.length) return;

                const scale   = tagNetwork.getScale();
                const view    = tagNetwork.getViewPosition();
                const canvasH = container.offsetHeight;

                const canvasYs = nodeIds.map(id => {
                    const p = positions[id];
                    return (p.y - view.y) * scale + canvasH / 2;
                });

                const minY     = Math.min(...canvasYs);
                const maxY     = Math.max(...canvasYs);
                const NODE_PAD = 55;
                const neededH  = (maxY - minY) + NODE_PAD * 2;
                const finalH   = Math.max(320, Math.min(750, neededH));

                if (container.offsetHeight - finalH >= 60) {
                    container.style.height = finalH + 'px';
                    tagNetwork.redraw();
                    tagNetwork.fit({ animation: false, padding: 60 });
                }
            } catch (e) {
                console.warn('Ağ haritası yeniden boyutlandırma:', e);
            }
        }, 600);
    });

    tagNetwork.on('click', (params) => {
        if (params.nodes.length > 0) {
            const tagName = params.nodes[0];
            if (tagName) filterByTag(tagName);
        }
    });
}

// ─────────────────────────────────────────────────────────────
// renderStats — Ana koordinatör
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

        <div class="heatmap-year-wrapper">
            <div class="heatmap-year-header">
                <div class="year-dropdown-wrapper">
                    <button id="heatmap-year-dropdown-trigger" class="year-dropdown-trigger">
                        <span id="heatmap-year-dropdown-label">${defaultYear}</span>
                        <span class="year-dropdown-arrow">▾</span>
                    </button>
                    <div id="heatmap-year-dropdown-menu" class="year-dropdown-menu"></div>
                </div>
            </div>
            <div id="learning-heatmap-container"></div>
        </div>

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

    const heatmapData = computeLearningHeatmap(videos, defaultYear);
    renderLearningHeatmap(heatmapData, currentLang);
    setupHeatmapYearDropdown(availableYears, defaultYear, videos, currentLang);

    const tagNetworkData = computeTagNetwork(videos);
    renderTagNetwork(tagNetworkData, currentLang);

    const sessionSection = document.createElement('div');
    sessionSection.id = 'session-history-section';
    sessionSection.style.marginTop = '30px';
    container.appendChild(sessionSection);
    renderSessionHistory(sessionSection, currentLang);

    const badgeSection = document.createElement('div');
    badgeSection.id = 'badge-panel-container';
    container.appendChild(badgeSection);

    dbFetchMonthlyStats()
        .then(monthlyStats => {
            const videos = store.get('globalVideos') || [];
            const badgeData = computeBadgeData(videos, monthlyStats);
            renderBadgePanel(badgeData, currentLang);
        })
        .catch(err => {
            console.warn('[Badges] monthly_stats alınamadı:', err);
            const videos = store.get('globalVideos') || [];
            const badgeData = computeBadgeData(videos, []);
            renderBadgePanel(badgeData, currentLang);
        });
}