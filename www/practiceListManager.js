// practiceListManager.js - Pratik Listesi modülü
// Favorilerden bağımsız, ayrı bir pratik listesi yönetir.
import { dbFetchPracticeList, dbAddToPracticeList, dbRemoveFromPracticeList, dbClearPracticeList } from './db/practiceList.js';
import { store } from './store.js';
import { showToast } from './toast.js';
import { showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { translations } from './i18n.js';

// ─────────────────────────────────────────────────────────────
// Başlatma — uygulama açılışında çağrılır
// ─────────────────────────────────────────────────────────────
export async function initPracticeListModule() {
    try {
        const rows = await dbFetchPracticeList();
        store.set('globalPracticeList', rows.map(r => r.video_id));
    } catch (err) {
        console.error('initPracticeListModule hatası:', err);
        store.set('globalPracticeList', []);
    }
}

// ─────────────────────────────────────────────────────────────
// Toggle — video kartındaki halter ikonuna tıklandığında
// ─────────────────────────────────────────────────────────────
export async function togglePracticeList(videoId) {
    const currentList = store.get('globalPracticeList') || [];
    const isInList = currentList.includes(videoId);
    const lang = store.get('currentLang');

    try {
        if (isInList) {
            await dbRemoveFromPracticeList(videoId);
            store.updatePracticeListLocally(videoId, false);
            showToast(
                lang === 'tr' ? 'Pratik listesinden çıkarıldı' : 'Removed from practice list',
                'info'
            );
        } else {
            await dbAddToPracticeList(videoId);
            store.updatePracticeListLocally(videoId, true);
            showToast(
                lang === 'tr' ? 'Pratik listesine eklendi' : 'Added to practice list',
                'success'
            );
        }
        // Eğer şu an practiceList ekranındaysa yenile
        if (store.get('currentView') === 'practiceList') {
            renderPracticeListView();
        }
    } catch (err) {
        showToast(
            lang === 'tr' ? 'Pratik listesi güncellenemedi' : 'Could not update practice list',
            'error'
        );
    }
}

// ─────────────────────────────────────────────────────────────
// Temizle — tüm listeyi sıfırla
// ─────────────────────────────────────────────────────────────
export async function clearPracticeList() {
    const lang = store.get('currentLang');
    const t = translations[lang];
    const okText     = lang === 'tr' ? 'Evet, Temizle' : 'Yes, Clear';
    const cancelText = lang === 'tr' ? 'İptal'         : 'Cancel';

    const confirmed = await showCustomConfirm(t.confirmClearPracticeList, okText, cancelText);
    if (!confirmed) return;

    try {
        await dbClearPracticeList();
        store.clearPracticeListLocally();
        showToast(
            lang === 'tr' ? 'Pratik listesi temizlendi' : 'Practice list cleared',
            'success'
        );
        renderPracticeListView();
    } catch (err) {
        showToast(
            lang === 'tr' ? 'Temizleme hatası!' : 'Clear failed!',
            'error'
        );
    }
}

// ─────────────────────────────────────────────────────────────
// Render — Pratik Listesi sayfasını doldurur
// ─────────────────────────────────────────────────────────────
export function renderPracticeListView() {
    const lang      = store.get('currentLang');
    const t         = translations[lang];
    const allVideos = store.get('globalVideos') || [];
    const plIds     = store.get('globalPracticeList') || [];

    // Sadece combination videoları — show videoları dahil değil
    const practiceVideos = allVideos.filter(
        v => plIds.includes(v.id) && (!v.content_type || v.content_type === 'combination')
    );

    // Arama filtresi
    const searchInput = document.getElementById('practice-list-search-input');
    const searchVal   = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filtered    = searchVal
        ? practiceVideos.filter(v =>
            [v.instructor_name, v.tags, v.notes, v.partner_name]
                .filter(Boolean).join(' ').toLowerCase().includes(searchVal)
        )
        : practiceVideos;

    // Sayaç
    const countEl = document.getElementById('practice-list-total-count');
    if (countEl) {
        countEl.textContent = `${t.practiceListCountLabel || 'Pratik Listesindeki Video Sayısı:'} ${filtered.length}`;
    }

    const grid = document.getElementById('practice-list-grid');
    if (!grid) return;

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="info-msg">${t.emptyPracticeList || 'Pratik listeniz henüz boş.'}</div>`;
        return;
    }

    // Dinamik import ile döngüsel import sorununu önle
    Promise.all([
        import('./videoHandlers.js'),
        import('./tangoModals.js'),
    ]).then(([vh, tm]) => {
        renderVideoCards(filtered, {
            currentLang: lang,
            currentView: 'practiceList',
            translations,
            favs: store.get('globalFavorites') || [],
            toggleFavorite:       vh.toggleFavorite,
            openTagsEditModal:    tm.openTagsEditModal,
            startVideoEditFlow:   vh.startVideoEditFlow   || (() => {}),
            deleteVideoFlow:      vh.deleteVideoFlow,
            openVideoModal:       tm.openVideoModal       || (() => {}),
            refreshList:          renderPracticeListView,
            updateLearningStatus: vh.updateLearningStatus || (() => {}),
            showPlaylistDropdown: () => {},
            containerId:          'practice-list-grid'
        });
    });
}

// ─────────────────────────────────────────────────────────────
// Arama bağlantısı — view yüklenince bir kez bağlanır
// ─────────────────────────────────────────────────────────────
export function bindPracticeListSearch() {
    const input = document.getElementById('practice-list-search-input');
    const btn   = document.getElementById('practice-list-search-btn');
    if (input && !input.dataset.bound) {
        input.dataset.bound = '1';
        input.addEventListener('input', renderPracticeListView);
        if (btn) btn.addEventListener('click', renderPracticeListView);
    }
}