// stats/heatmapRenderer.js
// Yıllık aktivite heatmap'i ve heatmap yıl dropdown'ı
// statsUI.js'den bölündü.

import { icon } from '../icons.js';
import { computeLearningHeatmap } from './computeStats.js';

// ─────────────────────────────────────────────────────────────
// renderLearningHeatmap
// ─────────────────────────────────────────────────────────────
export function renderLearningHeatmap(heatmapData, currentLang) {
    const container = document.getElementById('learning-heatmap-container');
    if (!container) return;
    const { weeks, year } = heatmapData;
    if (!weeks || weeks.length === 0) return;

    const CELL     = 11;
    const GAP      = 2;
    const STEP     = CELL + GAP;
    const PAD_LEFT = 34;
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
                        fill="#94a3b8" font-size="11" font-weight="500"
                        font-family="Plus Jakarta Sans,sans-serif">${monthNames[m]}</text>`;
                }
            }
        });
    });

    let dayLabelsSvg = '';
    dayLabels.forEach((lbl, dIdx) => {
        if (!lbl) return;
        const y = PAD_TOP + dIdx * STEP + CELL;
        dayLabelsSvg += `<text x="${PAD_LEFT - 5}" y="${y}"
            fill="#94a3b8" font-size="11" font-weight="500"
            text-anchor="end"
            font-family="Plus Jakarta Sans,sans-serif">${lbl}</text>`;
    });

    const legendY      = PAD_TOP + 7 * STEP + 14;
    const legendColors = [
        'rgba(255,255,255,0.05)',
        'rgba(0,240,255,0.30)',
        'rgba(0,240,255,0.60)',
        'rgba(255,0,127,0.55)',
        'rgba(255,0,127,0.90)'
    ];
    const lessLabel = currentLang === 'tr' ? 'Az'  : 'Less';
    const moreLabel = currentLang === 'tr' ? 'Çok' : 'More';

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
        ? `${icon('calendar', { size: 15 })} Yıllık Aktivite Haritası — ${year}`
        : `${icon('calendar', { size: 15 })} Annual Activity Map — ${year}`;

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

// ─────────────────────────────────────────────────────────────
// setupHeatmapYearDropdown
// ─────────────────────────────────────────────────────────────
export function setupHeatmapYearDropdown(availableYears, defaultYear, videos, currentLang) {
    const trigger = document.getElementById('heatmap-year-dropdown-trigger');
    const menu    = document.getElementById('heatmap-year-dropdown-menu');
    const label   = document.getElementById('heatmap-year-dropdown-label');
    if (!trigger || !menu || !label) return;

    menu.innerHTML = availableYears.map(y =>
        `<div class="year-dropdown-item ${y === defaultYear ? 'active' : ''}" data-year="${y}">${y}</div>`
    ).join('');

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
        const newHeatmapData = computeLearningHeatmap(videos, year);
        renderLearningHeatmap(newHeatmapData, currentLang);
    });

    document.addEventListener('click', () => {
        menu.classList.remove('open');
        trigger.classList.remove('open');
    });
}