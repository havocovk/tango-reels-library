// stats/chartRenderers.js
// Platform bar chart, aylık bar chart ve yıl dropdown'ları
// statsUI.js'den bölündü.

import { computeMonthlyData } from './computeStats.js';
import { translations } from '../i18n.js';

let platformChart = null;
let monthlyChart  = null;

// ─────────────────────────────────────────────────────────────
// renderPlatformBarChart (Platform Chart v2 — yatay çubuk)
// ─────────────────────────────────────────────────────────────
export function renderPlatformBarChart(stats, lang, currentLang) {
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
// renderMonthlyChart
// ─────────────────────────────────────────────────────────────
export function renderMonthlyChart(monthlyData) {
    const canvasBar = document.getElementById('monthly-bar-chart');
    if (!canvasBar) return;
    const ctxBar = canvasBar.getContext('2d');
    if (monthlyChart) monthlyChart.destroy();

    const months = monthlyData.map(m => m.label);
    const counts = monthlyData.map(m => m.count);

    canvasBar.width = Math.max(700, monthlyData.length * 80);

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
                ctx.shadowColor  = 'rgba(255, 0, 127, 0.8)';
                ctx.shadowBlur   = 10;
                ctx.fillStyle    = '#ffffff';
                ctx.font         = `bold 13px "Plus Jakarta Sans", Arial, sans-serif`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(String(value), bar.x, bar.y - 8);
                ctx.restore();
            });
        }
    };

    monthlyChart = new Chart(ctxBar, {
        type: 'bar',
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
            layout: { padding: { top: 45, bottom: 5 } }
        }
    });
}

// ─────────────────────────────────────────────────────────────
// setupCustomYearDropdown
// ─────────────────────────────────────────────────────────────
export function setupCustomYearDropdown(availableYears, defaultYear, videos) {
    const trigger = document.getElementById('year-dropdown-trigger');
    const menu    = document.getElementById('year-dropdown-menu');
    const label   = document.getElementById('year-dropdown-label');
    if (!trigger || !menu || !label) return;

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