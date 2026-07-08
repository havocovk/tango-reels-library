// practiceListManager.js - Pratik Listesi modülü
// Favorilerden bağımsız, ayrı bir pratik listesi yönetir.
// ✅ GÜNCELLEME: Filtreler eklendi (rol, eğitmen, etiket, tarih, platform, öğrenme durumu)
import { dbFetchPracticeList, dbAddToPracticeList, dbRemoveFromPracticeList, dbClearPracticeList } from './tangoVeritabani.js';
import { store } from './store.js';
import { showToast } from './toast.js';
import { showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { getFilteredVideos } from './tangoFilters.js';
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
// Render — Pratik Listesi sayfasını doldurur (filtreli)
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

    // ── Filtre değerlerini oku ──────────────────────────────────
    const searchInput  = document.getElementById('practice-list-search-input');
    const aramaMetni   = searchInput ? searchInput.value.trim() : '';
    const rol          = document.getElementById('pl-filter-role-select')?.value || 'all';
    const egitmen      = document.getElementById('pl-filter-instructor-select')?.value || 'all';
    const etiket       = document.getElementById('pl-filter-tag-select')?.value || 'all';
    const tarih        = document.getElementById('pl-filter-date-select')?.value || 'all';
    const platform     = document.getElementById('pl-filter-platform-select')?.value || 'all';
    const learningStatus = document.getElementById('pl-filter-learning-status-select')?.value || 'all';

    const filters = { aramaMetni, rol, egitmen, etiket, tarih, platform, learningStatus };
    const filtered = getFilteredVideos(practiceVideos, filters, lang);

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
// Eğitmen dropdown'ını doldur
// ─────────────────────────────────────────────────────────────
export function populatePracticeListInstructorSelect() {
    const sel = document.getElementById('pl-filter-instructor-select');
    if (!sel) return;
    const langCode = store.get('currentLang');
    const instructors = store.get('globalInstructors') || [];
    const allLabel = translations[langCode]?.allInstructors || (langCode === 'tr' ? 'Tüm Eğitmenler' : 'All Instructors');
    const currentVal = sel.value;
    sel.innerHTML = `<option value="all">${allLabel}</option>` +
        instructors.map(i => `<option value="${i.name}">${i.name}</option>`).join('');
    if (currentVal && currentVal !== 'all') sel.value = currentVal;
}

// ─────────────────────────────────────────────────────────────
// Etiket dropdown'ını doldur
// ─────────────────────────────────────────────────────────────
export function populatePracticeListTagSelect() {
    const sel = document.getElementById('pl-filter-tag-select');
    if (!sel) return;
    const langCode = store.get('currentLang');
    const allVideos = store.get('globalVideos') || [];
    const plIds = store.get('globalPracticeList') || [];
    const practiceVideos = allVideos.filter(v => plIds.includes(v.id));
    const allLabel = translations[langCode]?.allTags || (langCode === 'tr' ? 'Tüm Etiketler' : 'All Tags');
    const currentVal = sel.value;

    const tags = [...new Set(
        practiceVideos.flatMap(v => {
            if (!v.tags) return [];
            try { return JSON.parse(v.tags); } catch { return []; }
        })
    )].sort();

    sel.innerHTML = `<option value="all">${allLabel}</option>` +
        tags.map(tag => `<option value="${tag}">${tag}</option>`).join('');
    if (currentVal && currentVal !== 'all') sel.value = currentVal;
}

// ─────────────────────────────────────────────────────────────
// Arama + filtre bağlantısı — view yüklenince bir kez bağlanır
// ─────────────────────────────────────────────────────────────
export function bindPracticeListSearch() {
    const input = document.getElementById('practice-list-search-input');
    const btn   = document.getElementById('practice-list-search-btn');

    if (input && !input.dataset.bound) {
        input.dataset.bound = '1';
        input.addEventListener('input', renderPracticeListView);
        if (btn) btn.addEventListener('click', renderPracticeListView);

        // Filtre select'leri
        [
            'pl-filter-role-select',
            'pl-filter-instructor-select',
            'pl-filter-tag-select',
            'pl-filter-date-select',
            'pl-filter-platform-select',
            'pl-filter-learning-status-select'
        ].forEach(id => {
            document.getElementById(id)?.addEventListener('change', renderPracticeListView);
        });
    }

    // Dropdown'ları her açılışta güncelle
    populatePracticeListInstructorSelect();
    populatePracticeListTagSelect();
}