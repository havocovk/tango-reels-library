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
import { ensureModalLoaded } from './modalLoader.js'; // Adim 3.4

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
// _wouldCreateCycle — Adim 1.4
// sourceId → targetId baglantisi eklenirse dongü olusur mu kontrol eder.
// Mevcut linklerden targetId'den baslayin, BFS/DFS ile sourceId'ye
// ulasilabilir mi bakın. Ulasilabiliyorsa eklemek döngü yaratır.
// ─────────────────────────────────────────────────────────────
function _wouldCreateCycle(sourceId, targetId) {
    const allLinks = store.get('globalVideoLinks') || [];

    // targetId'den erisilebilen tüm node'lari bul (BFS)
    const visited = new Set();
    const queue   = [targetId];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current === sourceId) return true; // sourceId'ye ulastik = döngü
        if (visited.has(current)) continue;
        visited.add(current);

        // current'tan çikan tüm baglantilari bul
        for (const link of allLinks) {
            if (link.source_video_id === current && !visited.has(link.target_video_id)) {
                queue.push(link.target_video_id);
            }
        }
    }
    return false;
}

// addLink — yeni bağlantı ekler, store'u günceller, UI'ı tazeler
// ─────────────────────────────────────────────────────────────
export async function addLink(sourceId, targetId) {
    if (sourceId === targetId) {
        showToast(store.get('currentLang') === 'tr'
            ? 'Bir videoyu kendisine bağlayamazsın.'
            : 'A video cannot link to itself.', 'error');
        return;
    }

    // Adim 1.4: Döngü kontrolü
    if (_wouldCreateCycle(sourceId, targetId)) {
        showToast(store.get('currentLang') === 'tr'
            ? 'Bu bağlantı bir döngü oluşturur (A→B→A). Eklenemedi.'
            : 'This link would create a loop (A→B→A). Not allowed.', 'error');
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
export async function openLinkManager(video) {
    await ensureModalLoaded('link-manager-modal'); // Adim 3.3
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

    // Adim 4.2: Zincir haritası toggle
    let chainMapVisible = false;
    const toggleBtn       = document.getElementById('chain-map-toggle-btn');
    const toggleLabel     = document.getElementById('chain-map-toggle-label');
    const mapContainer    = document.getElementById('chain-map-container');
    const mapCanvas       = document.getElementById('chain-map-canvas');
    const mapEmpty        = document.getElementById('chain-map-empty');

    if (toggleBtn) {
        toggleBtn.onclick = () => {
            chainMapVisible = !chainMapVisible;
            mapContainer.style.display = chainMapVisible ? 'block' : 'none';
            toggleLabel.textContent = chainMapVisible
                ? (lang === 'tr' ? 'Haritayı Gizle' : 'Hide Map')
                : (lang === 'tr' ? 'Zincir Haritasını Göster' : 'Show Chain Map');

            if (chainMapVisible) setTimeout(() => _renderChainMap(video.id, mapCanvas, mapEmpty, lang), 50);
        };
    }

    const closeBtn = document.getElementById('link-manager-close-btn');
    if (closeBtn) closeBtn.onclick = () => {
        modal.classList.add('d-none');
        // Haritayı sıfırla
        chainMapVisible = false;
        if (mapContainer) mapContainer.style.display = 'none';
        if (toggleLabel)  toggleLabel.textContent = lang === 'tr' ? 'Zincir Haritasını Göster' : 'Show Chain Map';
        if (mapCanvas)    mapCanvas.innerHTML = '';
    };

    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.add('d-none');
            chainMapVisible = false;
            if (mapContainer) mapContainer.style.display = 'none';
            if (mapCanvas)    mapCanvas.innerHTML = '';
        }
    };
}

// ─────────────────────────────────────────────────────────────
// _renderChainMap — Adim 4.2
// vis-network ile seçilen videonun zincir haritasını çizer.
// ─────────────────────────────────────────────────────────────
function _renderChainMap(videoId, canvas, emptyEl, lang) {
    const allLinks  = store.get('globalVideoLinks') || [];
    const allVideos = store.get('globalVideos') || [];
    const findVideo = (id) => allVideos.find(v => v.id === id);

    // Bu videoyla bağlantılı tüm video ID'lerini topla (BFS ile 2 derece)
    const nodeIds   = new Set([videoId]);
    const edgeMap   = new Map(); // id -> edge (duplicate önleme)
    const visited   = new Set();
    const queue     = [videoId];

    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);

        for (const link of allLinks) {
            if (link.source_video_id === current) {
                nodeIds.add(link.target_video_id);
                if (!edgeMap.has(link.id)) {
                    edgeMap.set(link.id, { from: link.source_video_id, to: link.target_video_id, id: link.id });
                }
                if (!visited.has(link.target_video_id)) queue.push(link.target_video_id);
            } else if (link.target_video_id === current) {
                nodeIds.add(link.source_video_id);
                if (!edgeMap.has(link.id)) {
                    edgeMap.set(link.id, { from: link.source_video_id, to: link.target_video_id, id: link.id });
                }
                if (!visited.has(link.source_video_id)) queue.push(link.source_video_id);
            }
        }
    }
    const edges = Array.from(edgeMap.values());

    console.log('[ChainMap] nodeIds:', nodeIds.size, 'edges:', edges.length, 'allLinks:', allLinks.length);

    if (edges.length === 0) {
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }
    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    // Node listesi oluştur
    const nodes = Array.from(nodeIds).map(id => {
        const v    = findVideo(id);
        const name = v ? instructorNameOf(v) : id;
        const tags = v ? shortTags(v, 2) : '';
        const label = tags ? name + '\n' + tags : name;
        const isCenter = id === videoId;
        return {
            id,
            label,
            shape: 'box',
            color: {
                background: isCenter ? 'rgba(0,240,255,0.18)' : 'rgba(255,255,255,0.05)',
                border:     isCenter ? '#00f0ff'              : 'rgba(255,255,255,0.2)',
                highlight:  { background: 'rgba(255,0,127,0.2)', border: '#ff007f' }
            },
            font:  { color: isCenter ? '#00f0ff' : '#e2e8f0', size: 12, face: 'Plus Jakarta Sans' },
            borderWidth: isCenter ? 2 : 1,
            margin: 8
        };
    });

    const visEdges = edges.map(e => ({
        from: e.from,
        to:   e.to,
        id:   e.id,
        arrows: 'to',
        color:  { color: 'rgba(0,240,255,0.35)', highlight: '#ff007f' },
        smooth: { type: 'curvedCW', roundness: 0.15 }
    }));

    // vis-network'ü temizle ve yeniden çiz
    canvas.innerHTML = '';

    const network = new vis.Network(
        canvas,
        { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(visEdges) },
        {
            layout:  { improvedLayout: true },
            physics: { enabled: true, stabilization: { iterations: 100 } },
            interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
            nodes: { widthConstraint: { maximum: 140 } }
        }
    );

    // Merkez nodu odakla
    network.once('stabilized', () => {
        network.focus(videoId, { scale: 1, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    });
}