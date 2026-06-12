// chainManager.js - Kombinasyon Zincirleri yönetimi
// ✅ YENİ (Adım 6.2)
// "Bu kombinasyondan sonra şu gelir" ilişkilerini yönetir.
// Kartlarda ← Önceki / → Sonraki navigasyonu ve bağlantı yönetim modalı.

import {
    dbFetchAllVideoLinks,
    dbFetchVideoLinks,
    dbAddVideoLink,
    dbDeleteVideoLink
} from './db/videoLinks.js';
import { store } from './store.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js'; // Adim 1.2

// ── Modül düzeyi durum ────────────────────────────────────────
let openVideoModalCb = null;   // Bir videoyu modalda açmak için (app.js'ten gelir)
let refreshListCb    = null;   // Kartları yeniden çizmek için (app.js'ten gelir)
let activeVideoId    = null;   // Şu an link yöneticisi açık olan video

// ─────────────────────────────────────────────────────────────
// initChainManager — app.js başlangıcında bir kez çağrılır
// ─────────────────────────────────────────────────────────────
export function initChainManager(openVideoModalFn, refreshListFn) {
    openVideoModalCb = openVideoModalFn;
    refreshListCb    = refreshListFn;
}

// ─────────────────────────────────────────────────────────────
// loadAllVideoLinks — tüm bağlantıları çekip store'a yükler
// (uygulama açılışında çağrılır)
// ─────────────────────────────────────────────────────────────
export async function loadAllVideoLinks() {
    try {
        const links = await dbFetchAllVideoLinks();
        store.set('globalVideoLinks', links);
    } catch (err) {
        console.error('Bağlantılar yüklenemedi:', err);
        store.set('globalVideoLinks', []);
    }
}

// ─────────────────────────────────────────────────────────────
// loadLinksForVideo — tek bir videonun bağlantılarını DB'den çeker
// (yol haritasında belirtilen yardımcı; tazeleme gerektiğinde kullanılır)
// ─────────────────────────────────────────────────────────────
export async function loadLinksForVideo(videoId) {
    return await dbFetchVideoLinks(videoId);
}

// ─────────────────────────────────────────────────────────────
// getLinksForVideo — store'daki bağlantılardan, verilen video için
// "sonraki" ve "önceki" video nesnelerini çözümler. (Senkron)
//   next → bu videodan sonra gelenler (source = videoId)
//   prev → bu videodan önce gelenler (target = videoId)
// ─────────────────────────────────────────────────────────────
export function getLinksForVideo(videoId) {
    const allLinks  = store.get('globalVideoLinks') || [];
    const allVideos = store.get('globalVideos') || [];

    const findVideo = (id) => allVideos.find(v => v.id === id) || null;

    const next = [];
    const prev = [];

    for (const link of allLinks) {
        if (link.source_video_id === videoId) {
            const v = findVideo(link.target_video_id);
            if (v) next.push({ linkId: link.id, video: v });
        } else if (link.target_video_id === videoId) {
            const v = findVideo(link.source_video_id);
            if (v) prev.push({ linkId: link.id, video: v });
        }
    }
    return { next, prev };
}

// escapeHtml -> utils.js (Adim 1.2)

function instructorNameOf(video) {
    if (!video) return '?';
    return video.instructors ? video.instructors.name
         : (video.instructor_name || '?');
}

function shortTags(video, count = 2) {
    if (!video || !video.tags) return '';
    return video.tags.split(',').slice(0, count).map(t => '#' + t.trim()).join(' ');
}

// ─────────────────────────────────────────────────────────────
// buildChainNavHtml — KART için "← Önceki / → Sonraki" şeridini üretir.
// Hiç bağlantı yoksa boş string döner (kart temiz kalır).
// Tıklama bağlama işini videoCardRenderer yapar (data-* nitelikleriyle).
// ─────────────────────────────────────────────────────────────
export function buildChainNavHtml(video, currentLang) {
    const { next, prev } = getLinksForVideo(video.id);
    if (next.length === 0 && prev.length === 0) return '';

    const prevTitle = currentLang === 'tr' ? '← Önceki' : '← Previous';
    const nextTitle = currentLang === 'tr' ? 'Sonraki →' : 'Next →';

    const chip = (entry, dir) => {
        const v = entry.video;
        const name = escapeHtml(instructorNameOf(v));
        const tagTxt = escapeHtml(shortTags(v, 1));
        return `<button class="chain-chip" data-chain-dir="${dir}"
                    data-chain-id="${v.id}"
                    data-chain-url="${escapeHtml(v.url || '')}"
                    data-chain-platform="${v.platform || 'other'}"
                    data-chain-drive="${escapeHtml(v.drive_url || '')}"
                    title="${name}${tagTxt ? ' • ' + tagTxt : ''}">
                    <span class="chain-chip-name">${name}</span>
                </button>`;
    };

    let html = `<div class="chain-nav-section">`;

    if (prev.length > 0) {
        html += `<div class="chain-nav-row">
            <span class="chain-nav-label">${prevTitle}</span>
            <div class="chain-nav-chips">${prev.map(e => chip(e, 'prev')).join('')}</div>
        </div>`;
    }
    if (next.length > 0) {
        html += `<div class="chain-nav-row">
            <span class="chain-nav-label">${nextTitle}</span>
            <div class="chain-nav-chips">${next.map(e => chip(e, 'next')).join('')}</div>
        </div>`;
    }

    html += `</div>`;
    return html;
}

// ─────────────────────────────────────────────────────────────
// addLink — yeni bağlantı ekler, store'u günceller, UI'ı tazeler
// ─────────────────────────────────────────────────────────────
export async function addLink(sourceId, targetId) {
    if (sourceId === targetId) {
        showToast(store.get('currentLang') === 'tr'
            ? 'Bir videoyu kendisine bağlayamazsın.'
            : 'A video cannot link to itself.', 'error');
        return;
    }
    try {
        const row = await dbAddVideoLink(sourceId, targetId);
        if (row) {
            store.addVideoLinkLocally(row);
            showToast(store.get('currentLang') === 'tr'
                ? 'Bağlantı eklendi ✓' : 'Link added ✓', 'success');
            if (refreshListCb) refreshListCb();
            renderLinkManagerLists();
            renderSearchResults(getCurrentSearchTerm());
        }
    } catch (err) {
        if (err.message === 'DUPLICATE') {
            showToast(store.get('currentLang') === 'tr'
                ? 'Bu bağlantı zaten var.' : 'This link already exists.', 'error');
        } else {
            showToast((store.get('currentLang') === 'tr' ? 'Eklenemedi: ' : 'Failed: ') + err.message, 'error');
        }
    }
}

// ─────────────────────────────────────────────────────────────
// removeLink — bağlantı siler, store'u günceller, UI'ı tazeler
// ─────────────────────────────────────────────────────────────
export async function removeLink(linkId) {
    try {
        await dbDeleteVideoLink(linkId);
        store.removeVideoLinkLocally(linkId);
        showToast(store.get('currentLang') === 'tr'
            ? 'Bağlantı kaldırıldı' : 'Link removed', 'success');
        if (refreshListCb) refreshListCb();
        renderLinkManagerLists();
        renderSearchResults(getCurrentSearchTerm());
    } catch (err) {
        showToast((store.get('currentLang') === 'tr' ? 'Silinemedi: ' : 'Failed: ') + err.message, 'error');
    }
}

// ── Modal içi yardımcılar ─────────────────────────────────────
function getCurrentSearchTerm() {
    const input = document.getElementById('link-search-input');
    return input ? input.value.trim() : '';
}

// Mevcut "sonraki" ve "önceki" listelerini modal içine çizer
function renderLinkManagerLists() {
    if (activeVideoId === null) return;
    const lang = store.get('currentLang');
    const { next, prev } = getLinksForVideo(activeVideoId);

    const emptyTxt = lang === 'tr' ? 'Henüz yok.' : 'None yet.';

    const renderList = (entries, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (entries.length === 0) {
            container.innerHTML = `<div class="link-empty">${emptyTxt}</div>`;
            return;
        }
        container.innerHTML = entries.map(e => {
            const v = e.video;
            const name = escapeHtml(instructorNameOf(v));
            const tagTxt = escapeHtml(shortTags(v, 2));
            const cover = v.cover_url || '';
            return `<div class="link-row" data-link-id="${e.linkId}">
                <div class="link-row-thumb" style="background-image:url('${cover}');"></div>
                <div class="link-row-info">
                    <div class="link-row-name">${name}</div>
                    <div class="link-row-tags">${tagTxt}</div>
                </div>
                <button class="link-row-del" data-del-link="${e.linkId}" title="${lang === 'tr' ? 'Bağlantıyı kaldır' : 'Remove link'}">🗑️</button>
            </div>`;
        }).join('');

        container.querySelectorAll('.link-row-del').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.delLink, 10);
                removeLink(id);
            });
        });
    };

    renderList(next, 'link-next-list');
    renderList(prev, 'link-prev-list');
}

// Arama sonuçlarını çizer (kendisi ve zaten bağlı olanlar hariç)
function renderSearchResults(term) {
    const container = document.getElementById('link-search-results');
    if (!container || activeVideoId === null) return;

    const lang = store.get('currentLang');
    const allVideos = store.get('globalVideos') || [];
    const { next, prev } = getLinksForVideo(activeVideoId);
    const alreadyNext = new Set(next.map(e => e.video.id));
    const alreadyPrev = new Set(prev.map(e => e.video.id));

    const q = (term || '').toLowerCase();
    const matches = allVideos.filter(v => {
        if (v.id === activeVideoId) return false;
        if (!q) return true;
        const hay = [
            instructorNameOf(v),
            v.partner_name || '',
            v.tags || ''
        ].join(' ').toLowerCase();
        return hay.includes(q);
    }).slice(0, 12);

    if (matches.length === 0) {
        container.innerHTML = `<div class="link-empty">${lang === 'tr' ? 'Eşleşen video yok.' : 'No matching videos.'}</div>`;
        return;
    }

    const addNextTxt = lang === 'tr' ? 'Sonraki →' : 'Next →';
    const addPrevTxt = lang === 'tr' ? '← Önceki' : '← Previous';

    container.innerHTML = matches.map(v => {
        const name = escapeHtml(instructorNameOf(v));
        const tagTxt = escapeHtml(shortTags(v, 2));
        const cover = v.cover_url || '';
        const nextDisabled = alreadyNext.has(v.id) ? 'disabled' : '';
        const prevDisabled = alreadyPrev.has(v.id) ? 'disabled' : '';
        return `<div class="link-search-row">
            <div class="link-row-thumb" style="background-image:url('${cover}');"></div>
            <div class="link-row-info">
                <div class="link-row-name">${name}</div>
                <div class="link-row-tags">${tagTxt}</div>
            </div>
            <div class="link-search-actions">
                <button class="link-add-prev" data-add-prev="${v.id}" ${prevDisabled}>${addPrevTxt}</button>
                <button class="link-add-next" data-add-next="${v.id}" ${nextDisabled}>${addNextTxt}</button>
            </div>
        </div>`;
    }).join('');

    // "Sonraki olarak ekle": activeVideo → seçilen (activeVideo source)
    container.querySelectorAll('.link-add-next').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
            const targetId = parseInt(btn.dataset.addNext, 10);
            addLink(activeVideoId, targetId);
        });
    });
    // "Önceki olarak ekle": seçilen → activeVideo (seçilen source)
    container.querySelectorAll('.link-add-prev').forEach(btn => {
        if (btn.disabled) return;
        btn.addEventListener('click', () => {
            const sourceId = parseInt(btn.dataset.addPrev, 10);
            addLink(sourceId, activeVideoId);
        });
    });
}

// ─────────────────────────────────────────────────────────────
// openLinkManager — karttaki 🔗 butonundan çağrılır; modalı açar
// ─────────────────────────────────────────────────────────────
export function openLinkManager(video) {
    const modal = document.getElementById('link-manager-modal');
    if (!modal) {
        console.error('link-manager-modal DOM\'da bulunamadı');
        return;
    }
    activeVideoId = video.id;
    const lang = store.get('currentLang');

    const subtitle = document.getElementById('link-manager-subtitle');
    if (subtitle) {
        const name = instructorNameOf(video);
        subtitle.textContent = lang === 'tr'
            ? `${name} kombinasyonu için zincir bağlantıları`
            : `Chain links for ${name}'s combination`;
    }

    const searchInput = document.getElementById('link-search-input');
    if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = lang === 'tr'
            ? 'Eğitmen, partner veya etiket ara...'
            : 'Search instructor, partner or tag...';
        searchInput.oninput = () => renderSearchResults(searchInput.value.trim());
    }

    modal.classList.remove('d-none');

    renderLinkManagerLists();
    renderSearchResults('');

    const closeBtn = document.getElementById('link-manager-close-btn');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('d-none');

    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('d-none');
    };
}