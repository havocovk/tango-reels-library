// navigation.js - Sayfa geçişleri, video düzenleme, favori temizleme
// ✅ DÜZELTİLDİ (Adım 2.4 Sorun 3): callSwitchView() içine clearActivePlaylist() eklendi
// ✅ GÜNCELLEME (Adım 5.3): filterByTag() eklendi
// ✅ GÜNCELLEME (Adım 3.2): callSwitchView URL durumunu yazıyor
// ✅ GÜNCELLEME: instructorsList view'ı eklendi
import { translations } from './i18n.js';
import { dbClearAllFavorites } from './tangoVeritabani.js';
import { showCustomConfirm } from './tangoModals.js';
import { showToast } from './toast.js';
import { setVisibleCount, setVideoHandlersGlobalData, applyFiltersAndSearch } from './videoHandlers.js';
import { switchView, updateInterfaceLanguage, updateSmartFilenameAssistant } from './tangoUI.js';
import { setEditingVideoId, setEditingVideoUpdatedAt, setFormTagsArray, renderFormChips, getFormTagsArray, formTagsArray, setFormHandlersGlobalData } from './formHandlers.js';
import { getAllUniqueTagsPool } from './tangoFilters.js';
import { renderStatsPanel, renderTagManagerUI, fetchVideos, renderDashboard, renderShows } from './dataManager.js';
import { store } from './store.js';
import { clearActivePlaylist } from './playlistManager.js';
import { renderInstructorProfile, renderInstructorsList } from './instructorProfile.js';
import { writeUrlState, clearUrlState } from './urlState.js';
import { ensureViewLoaded, ensureModalLoaded } from './modalLoader.js'; // Adim 3.4

export function callUpdateSmartAssistant() {
    updateSmartFilenameAssistant(store.get('currentLang'), formTagsArray);
}

export function callUpdateInterfaceLanguage() {
    updateInterfaceLanguage(
        store.get('currentLang'),
        store.get('editingVideoId'),
        store.get('editInstructorId'),
        formTagsArray,
        applyFiltersAndSearch,
        () => {
            const videos = store.get('globalVideos');
            if (videos.length) {
                import('./tangoFilters.js').then(tf => tf.populateFilterDropdowns(videos, store.get('currentLang')));
            }
        }
    );
    const videos = store.get('globalVideos');
    if (videos.length) {
        import('./tangoFilters.js').then(tf => tf.populateFilterDropdowns(videos, store.get('currentLang')));
    }
    if (store.get('currentView') === 'stats') renderStatsPanel();
}

export function callSwitchView(viewName, options = {}) {
    clearActivePlaylist();
    store.set('currentView', viewName);
    store.set('visibleCount', 20);
    setVisibleCount(store.get('visibleCount'));
    setVideoHandlersGlobalData(store.get('currentLang'), viewName, store.get('visibleCount'));

    // ✅ ADIM 3.2: View değişince URL'e yaz, filtreler sıfırlanır
    // Adim 5.2: popstate (geri/ileri) ile gelmediyse geçmişe ekle
    const pushHistory = options.fromPopstate !== true;
    writeUrlState({ view: viewName }, pushHistory);

    switchView(viewName, getUIState(), {
        applyFiltersAndSearch,
        renderFormChips: () => renderFormChips(),
        resetUploadedCoverUrl: () => {
            import('./storage.js').then(s => s.resetUploadedCoverUrl());
        },
        renderTagManager: renderTagManagerUI,
        renderDashboard: renderDashboard,
        renderShows:     renderShows,
        renderProfile: options.instructorId
            ? () => { store.set('currentInstructorId', options.instructorId); renderInstructorProfile(options.instructorId); }
            : null,
        renderInstructorsList: viewName === 'instructorsList'
            ? () => renderInstructorsList()
            : null
    });
    if (viewName === 'stats') renderStatsPanel();
    if (viewName === 'tagManager') renderTagManagerUI();
}

export function filterByTag(tagName) {
    if (!tagName) return;
    const tagSelect = document.getElementById('filter-tag-select');
    if (tagSelect) {
        const optionExists = Array.from(tagSelect.options).some(opt => opt.value === tagName);
        if (optionExists) tagSelect.value = tagName;
    }
    callSwitchView('library');
    setTimeout(() => {
        const tagSelectAfter = document.getElementById('filter-tag-select');
        if (tagSelectAfter) {
            const optionExists = Array.from(tagSelectAfter.options).some(opt => opt.value === tagName);
            if (optionExists) tagSelectAfter.value = tagName;
        }
        applyFiltersAndSearch();
    }, 50);
}

export async function clearAllFavorites() {
    const currentLang = store.get('currentLang');
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmClearFavs, okText, cancelText)) return;
    try {
        await dbClearAllFavorites();
        store.clearFavoritesLocally();
        if (window.applyFiltersAndSearch) window.applyFiltersAndSearch();
        showToast('Pratik listesi temizlendi', 'success');
    } catch (err) {
        console.error(err);
        showToast('Temizleme hatası: ' + err.message, 'error');
    }
}

export function callGetUniqueTagsPool() {
    return getAllUniqueTagsPool(store.get('globalVideos'));
}

export function startVideoEditFlow(video) {
    store.set('editingVideoId', video.id);
    setEditingVideoId(video.id);
    setEditingVideoUpdatedAt(video.updated_at);
    callSwitchView('add');
    const lang = translations[store.get('currentLang')];
    document.getElementById('form-title').innerText = lang.formTitleEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;
    document.getElementById('form-instructor-select').value = video.instructor_id;
    document.getElementById('form-video-url').value = video.url || '';
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    const tagsArray = video.tags
        ? video.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];
    setFormTagsArray(tagsArray);
    renderFormChips();
    callUpdateSmartAssistant();

    const preview = document.getElementById('image-preview');
    const dropText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        if (preview) { preview.src = video.cover_url; preview.classList.remove('d-none'); }
        if (dropText) dropText.style.display = 'none';
    } else {
        if (preview) { preview.src = ''; preview.classList.add('d-none'); }
        if (dropText) dropText.style.display = ''; 
    }
}

export function getUIState() {
    return {
        currentLang: store.get('currentLang'),
        editingVideoId: store.get('editingVideoId'),
        editInstructorId: store.get('editInstructorId'),
        currentView: store.get('currentView'),
        visibleCount: store.get('visibleCount'),
        resetFormTags: () => setFormTagsArray([]),
        getFormTags: () => getFormTagsArray()
    };
}