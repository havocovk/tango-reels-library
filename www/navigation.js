// navigation.js - Sayfa geçişleri, video düzenleme, favori temizleme (optimize edilmiş)
import { translations } from './i18n.js';
import { dbClearAllFavorites } from './tangoVeritabani.js';
import { showCustomConfirm, showToast } from './tangoModals.js';
import { setVisibleCount, setVideoHandlersGlobalData, applyFiltersAndSearch } from './videoHandlers.js';
import { switchView, updateInterfaceLanguage, updateSmartFilenameAssistant } from './tangoUI.js';
import { setEditingVideoId, setEditingVideoUpdatedAt, setFormTagsArray, renderFormChips, getFormTagsArray, formTagsArray, setFormHandlersGlobalData } from './formHandlers.js';
import { getAllUniqueTagsPool } from './tangoFilters.js';
import { renderStatsPanel, renderTagManagerUI, fetchVideos } from './dataManager.js';
import { store } from './store.js';

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

export function callSwitchView(viewName) {
    store.set('currentView', viewName);
    store.set('visibleCount', 20);
    setVisibleCount(store.get('visibleCount'));
    setVideoHandlersGlobalData(store.get('currentLang'), viewName, store.get('visibleCount'));
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch, 
        renderFormChips: () => renderFormChips(), 
        resetUploadedCoverUrl: () => {
            import('./storage.js').then(s => s.resetUploadedCoverUrl());
        },
        renderTagManager: renderTagManagerUI
    });
    if (viewName === 'stats') renderStatsPanel();
    if (viewName === 'tagManager') renderTagManagerUI();
    
}

// 🔥 DÜZELTİLMİŞ: favori temizleme (yerel güncelleme, fetchVideos yok)
export async function clearAllFavorites() {
    const currentLang = store.get('currentLang');
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmClearFavs, okText, cancelText)) return;
    try {
        await dbClearAllFavorites();
        store.clearFavoritesLocally();   // store.js'deki yeni metod
        if (window.applyFiltersAndSearch) window.applyFiltersAndSearch();
        showToast('Pratik listesi temizlendi', 'success');
    } catch (err) {
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
    console.log("Düzenlenen video updated_at:", video.updated_at);
    callSwitchView('add');
    const lang = translations[store.get('currentLang')];
    document.getElementById('form-title').innerText = lang.formTitleEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;
    document.getElementById('form-instructor-select').value = video.instructor_id;
    document.getElementById('form-video-url').value = video.url || '';
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    const tagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    setFormTagsArray(tagsArray);
    renderFormChips();
    const isDownloaded = document.getElementById('form-is-downloaded');
    const driveUrlContainer = document.getElementById('drive-url-container');
    const driveUrlInput = document.getElementById('form-drive-url');
    if (video.is_downloaded) {
        isDownloaded.checked = true;
        driveUrlContainer.classList.remove('d-none');
        driveUrlInput.value = video.drive_url || '';
        driveUrlInput.required = true;
    } else {
        isDownloaded.checked = false;
        driveUrlContainer.classList.add('d-none');
        driveUrlInput.value = '';
        driveUrlInput.required = false;
    }
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        imgPreview.src = video.cover_url;
        imgPreview.classList.remove('d-none');
        dropAreaText.classList.add('d-none');
    } else {
        imgPreview.classList.add('d-none');
        dropAreaText.innerText = lang.dropText;
        dropAreaText.classList.remove('d-none');
    }
    callUpdateSmartAssistant();
}

function getUIState() {
    return {
        currentLang: store.get('currentLang'),
        editingVideoId: store.get('editingVideoId'),
        editInstructorId: store.get('editInstructorId'),
        currentView: store.get('currentView'),
        getFormTags: () => getFormTagsArray(),
        resetFormTags: () => { setFormTagsArray([]); }
    };
}