// navigation.js - Sayfa geçişleri, video düzenleme, favori temizleme
import { translations } from './i18n.js';
import { dbClearAllFavorites } from './tangoVeritabani.js';
import { showCustomConfirm } from './tangoModals.js';
import { setVisibleCount, setVideoHandlersGlobalData, applyFiltersAndSearch } from './videoHandlers.js';
import { setEditingVideoId, setEditingVideoUpdatedAt, setFormTagsArray, renderFormChips, getFormTagsArray, formTagsArray, setFormHandlersGlobalData } from './formHandlers.js';
import { getAllUniqueTagsPool } from './tangoFilters.js';
import { renderStatsPanel, renderTagManagerUI, fetchVideos } from './dataManager.js';
import { store } from './store.js';
import { switchView, setNavigationCallbacks } from './ui/navigation.js';
import { resetUploadedCoverUrl } from './storage.js';

// Callback'leri ayarla (app.js'den çağrılacak)
export function initNavigation(loadViewFn) {
    setNavigationCallbacks(
        loadViewFn,
        renderTagManagerUI,
        applyFiltersAndSearch,
        renderStatsPanel,
        resetUploadedCoverUrl,
        renderFormChips
    );
}

export function callUpdateSmartAssistant() {
    import('./ui/language.js').then(ui => ui.updateSmartFilenameAssistant(store.get('currentLang'), formTagsArray));
}

export function callUpdateInterfaceLanguage() {
    import('./ui/language.js').then(ui => ui.updateInterfaceLanguage(
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
    ));
    const videos = store.get('globalVideos');
    if (videos.length) {
        import('./tangoFilters.js').then(tf => tf.populateFilterDropdowns(videos, store.get('currentLang')));
    }
    if (store.get('currentView') === 'stats') renderStatsPanel();
}

export async function callSwitchView(viewName) {
    store.set('currentView', viewName);
    store.set('visibleCount', 20);
    setVisibleCount(store.get('visibleCount'));
    setVideoHandlersGlobalData(store.get('currentLang'));
    
    // Görünüm değişikliği için gerekli state
    const state = {
        currentLang: store.get('currentLang'),
        editingVideoId: store.get('editingVideoId'),
        getFormTags: () => getFormTagsArray(),
        resetFormTags: () => setFormTagsArray([])
    };
    const functions = {}; // artık callback'ler setNavigationCallbacks ile verildi
    
    await switchView(viewName, state, functions);
    
    if (viewName === 'stats') renderStatsPanel();
    if (viewName === 'tagManager') renderTagManagerUI();
}

export function clearAllFavorites() {
    const currentLang = store.get('currentLang');
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    showCustomConfirm(lang.confirmClearFavs, okText, cancelText).then(async confirmed => {
        if (confirmed) {
            await dbClearAllFavorites();
            store.set('globalFavorites', []);
            setVideoHandlersGlobalData(store.get('currentLang'));
        }
    });
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
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = lang.formTitleEdit;
    const btnSubmit = document.getElementById('btn-submit-video');
    if (btnSubmit) btnSubmit.innerText = lang.btnUpdateVideo;
    const instructorSelect = document.getElementById('form-instructor-select');
    if (instructorSelect) instructorSelect.value = video.instructor_id;
    const videoUrl = document.getElementById('form-video-url');
    if (videoUrl) videoUrl.value = video.url || '';
    const roleSelect = document.getElementById('form-role-select');
    if (roleSelect) roleSelect.value = video.role_type || 'Both';
    const partnerInput = document.getElementById('form-partner-name');
    if (partnerInput) partnerInput.value = video.partner_name || '';
    const tagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    setFormTagsArray(tagsArray);
    renderFormChips();
    const isDownloadedCheck = document.getElementById('form-is-downloaded');
    const driveUrlContainer = document.getElementById('drive-url-container');
    const driveUrlInput = document.getElementById('form-drive-url');
    if (video.is_downloaded) {
        if (isDownloadedCheck) isDownloadedCheck.checked = true;
        if (driveUrlContainer) driveUrlContainer.classList.remove('d-none');
        if (driveUrlInput) {
            driveUrlInput.value = video.drive_url || '';
            driveUrlInput.required = true;
        }
    } else {
        if (isDownloadedCheck) isDownloadedCheck.checked = false;
        if (driveUrlContainer) driveUrlContainer.classList.add('d-none');
        if (driveUrlInput) {
            driveUrlInput.value = '';
            driveUrlInput.required = false;
        }
    }
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        if (imgPreview) {
            imgPreview.src = video.cover_url;
            imgPreview.classList.remove('d-none');
        }
        if (dropAreaText) dropAreaText.classList.add('d-none');
    } else {
        if (imgPreview) imgPreview.classList.add('d-none');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
    }
    callUpdateSmartAssistant();
}