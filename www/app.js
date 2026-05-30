// app.js - Yeni modüler yapı (7. adım: HTML şablonlarına ayırma)
import { translations } from './i18n.js';
import { handlePasteEvent } from './storage.js';
import { 
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly,
    initModalCallbacks
} from './tangoModals.js';
import { setupAutocomplete } from './uiRenderer.js';
import { renderFormChips } from './formHandlers.js';
import { 
    initVideoHandlers, toggleFavorite, applyFiltersAndSearch, setVisibleCount, 
    incrementVisibleCount, deleteVideoFlow, setVideoHandlersGlobalData 
} from './videoHandlers.js';
import { 
    initInstructorHandlers, handleInstructorSubmit, deleteInstructor, 
    setInstructorHandlersGlobalData 
} from './instructorHandlers.js';
import { 
    initFormHandlers, handleFormSubmit, formTagsArray, setFormTagsArray, 
    getFormTagsArray, setFormHandlersGlobalData 
} from './formHandlers.js';
import { 
    initTagManager, updateTagManagerSelection, mergeSelectedTags, 
    deleteSelectedTags, cleanupUnusedTags 
} from './tagManager.js';
import { store } from './store.js';
import { 
    fetchInstructors, fetchVideos, renderStatsPanel, renderTagManagerUI, 
    updateAllLanguages 
} from './dataManager.js';
import { 
    callSwitchView, clearAllFavorites, callGetUniqueTagsPool, 
    startVideoEditFlow, callUpdateSmartAssistant, callUpdateInterfaceLanguage 
} from './navigation.js';
import { setupStoreSubscriptions } from './uiSubscriptions.js';

// ========== YENİ: View yükleme fonksiyonları ==========
let loadedViews = {};

async function loadView(viewName, containerId = 'view-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Eğer aynı view zaten yüklüyse tekrar yükleme
    if (loadedViews[viewName]) {
        container.innerHTML = loadedViews[viewName];
        return;
    }
    
    try {
        const response = await fetch(`views/${viewName}.html`);
        if (!response.ok) throw new Error(`View ${viewName} yüklenemedi`);
        const html = await response.text();
        loadedViews[viewName] = html;
        container.innerHTML = html;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="info-msg">Görünüm yüklenirken hata oluştu.</div>`;
    }
}

async function loadModals() {
    const modalNames = ['video-modal', 'tags-edit-modal', 'custom-dialog-modal'];
    for (const modalName of modalNames) {
        try {
            const response = await fetch(`modals/${modalName}.html`);
            if (response.ok) {
                const html = await response.text();
                // Modal'ları body'nin sonuna ekle (eğer zaten yoksa)
                if (!document.getElementById(modalName)) {
                    document.body.insertAdjacentHTML('beforeend', html);
                }
            }
        } catch (err) {
            console.warn(`${modalName} yüklenemedi:`, err);
        }
    }
}

// ========== İlk çağrılar (global değişkenler) ==========
setVideoHandlersGlobalData(store.get('currentLang'));
setInstructorHandlersGlobalData(store.get('currentLang'));
setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, store.get('globalVideos'));
initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);

initVideoHandlers(applyFiltersAndSearch, fetchVideos, openVideoModal, openTagsEditModal, startVideoEditFlow, deleteVideoFlow);
initInstructorHandlers(fetchInstructors, fetchVideos);
initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);

// DOM yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
    // Önce modalları ve başlangıç view'ını yükle
    await loadModals();
    await loadView('library');

    // Navigation callback'lerini ayarla
    initNavigation(loadView);
    
    // Artık DOM'da view'lar hazır, normal işlemlere devam
    await fetchInstructors();
    await fetchVideos();
    initModalCallbacks(applyFiltersAndSearch);
    callUpdateInterfaceLanguage();

    // Dil değiştirme
    document.getElementById('lang-toggle-btn').onclick = () => {
        const newLang = store.get('currentLang') === 'tr' ? 'en' : 'tr';
        store.set('currentLang', newLang);
        updateAllLanguages();
        callUpdateInterfaceLanguage();
        if (store.get('currentView') === 'stats') renderStatsPanel();
        if (store.get('currentView') === 'tagManager') renderTagManagerUI();
    };

    // Menü butonları
    document.getElementById('menu-library').onclick = () => { callSwitchView('library'); };
    document.getElementById('menu-favorites').onclick = () => { callSwitchView('favorites'); };
    document.getElementById('menu-stats').onclick = () => { callSwitchView('stats'); };
    document.getElementById('menu-add-video').onclick = () => callSwitchView('add');
    document.getElementById('menu-tag-manager').onclick = () => callSwitchView('tagManager');
    
    // Favori temizleme
    document.getElementById('btn-clear-favorites').onclick = clearAllFavorites;
    
    // Drive checkbox (bu elemanlar add-video view'ı yüklendikten sonra gelir, ama şimdilik kontrol et)
    const driveCheckbox = document.getElementById('form-is-downloaded');
    if (driveCheckbox) {
        driveCheckbox.onchange = (e) => {
            const container = document.getElementById('drive-url-container');
            const input = document.getElementById('form-drive-url');
            if (e.target.checked) {
                container.classList.remove('d-none');
                input.required = true;
            } else {
                container.classList.add('d-none');
                input.required = false;
                input.value = '';
            }
        };
    }
    
    // Otomatik tamamlama (bu elemanlar view yüklendikten sonra gelir, kontrol et)
    const formTagsInput = document.getElementById('form-tags-input');
    if (formTagsInput) {
        setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, () => renderFormChips(), (newTag) => {
            if (!formTagsArray.includes(newTag)) {
                formTagsArray.push(newTag);
                renderFormChips();
                callUpdateSmartAssistant();
            }
        }, callGetUniqueTagsPool);
    }
    
    const modalTagsInput = document.getElementById('modal-tags-input');
    if (modalTagsInput) {
        setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
            modalTagsArray.push(newTag);
            saveTagsToSupabaseDirectly();
        }, callGetUniqueTagsPool);
    }
    
    // Eğitmen form işlemleri
    const instructorSelect = document.getElementById('form-instructor-select');
    if (instructorSelect) {
        instructorSelect.onchange = callUpdateSmartAssistant;
    }
    
    const toggleNewBtn = document.getElementById('btn-toggle-new-instructor');
    if (toggleNewBtn) {
        toggleNewBtn.onclick = () => {
            store.set('editInstructorId', null);
            document.getElementById('form-new-instructor-input').value = '';
            document.getElementById('btn-save-instructor').innerText = translations[store.get('currentLang')].btnAddIns;
            document.getElementById('new-instructor-container').classList.toggle('d-none');
        };
    }
    
    const editInsBtn = document.getElementById('btn-edit-instructor');
    if (editInsBtn) {
        editInsBtn.onclick = () => {
            const select = document.getElementById('form-instructor-select');
            if (!select.value) return;
            store.set('editInstructorId', select.value);
            document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
            document.getElementById('btn-save-instructor').innerText = translations[store.get('currentLang')].btnUpdateIns;
            document.getElementById('new-instructor-container').classList.remove('d-none');
        };
    }
    
    const deleteInsBtn = document.getElementById('btn-delete-instructor');
    if (deleteInsBtn) deleteInsBtn.onclick = deleteInstructor;
    
    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) saveInsBtn.onclick = handleInstructorSubmit;
    
    // Video form submit
    const addVideoForm = document.getElementById('add-video-form');
    if (addVideoForm) addVideoForm.onsubmit = handleFormSubmit;
    
    // Filtreleme (bu elemanlar library view'ında var)
    const filterRole = document.getElementById('filter-role-select');
    const filterInstructor = document.getElementById('filter-instructor-select');
    const filterTag = document.getElementById('filter-tag-select');
    const filterDate = document.getElementById('filter-date-select');
    const filterPlatform = document.getElementById('filter-platform-select');
    const filterBtn = document.getElementById('filter-btn');
    const loadMoreBtn = document.getElementById('btn-load-more');
    
    const handleFilter = () => { setVisibleCount(20); applyFiltersAndSearch(); };
    if (filterRole) filterRole.onchange = handleFilter;
    if (filterInstructor) filterInstructor.onchange = handleFilter;
    if (filterTag) filterTag.onchange = handleFilter;
    if (filterDate) filterDate.onchange = handleFilter;
    if (filterPlatform) filterPlatform.onchange = handleFilter;
    if (filterBtn) filterBtn.onclick = () => { setVisibleCount(20); fetchVideos(); };
    if (loadMoreBtn) loadMoreBtn.onclick = () => { incrementVisibleCount(20); applyFiltersAndSearch(); };
    
    // Modallar (zaten loadModals ile yüklendi, ama event'leri bağla)
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) modalClose.onclick = closeVideoModal;
    const videoModal = document.getElementById('video-modal');
    if (videoModal) videoModal.onclick = (e) => { if (e.target.id === 'video-modal') closeVideoModal(); };
    const tagsModalClose = document.getElementById('tags-modal-close-btn');
    if (tagsModalClose) tagsModalClose.onclick = closeTagsEditModal;
    const tagsEditModal = document.getElementById('tags-edit-modal');
    if (tagsEditModal) tagsEditModal.onclick = (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); };
    
    // Kapak resmi yapıştırma
    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, store.get('currentLang')));
    
    // Etiket yönetimi butonları (tagManager view'ında var)
    const mergeBtn = document.getElementById('tag-manager-merge-btn');
    const deleteTagBtn = document.getElementById('tag-manager-delete-btn');
    const cleanupBtn = document.getElementById('tag-manager-cleanup-btn');
    const mergeCancel = document.getElementById('tag-merge-cancel-btn');
    const mergeConfirm = document.getElementById('tag-merge-confirm-btn');
    
    if (mergeBtn) mergeBtn.onclick = () => mergeSelectedTags();
    if (deleteTagBtn) deleteTagBtn.onclick = () => deleteSelectedTags();
    if (cleanupBtn) cleanupBtn.onclick = () => cleanupUnusedTags();
    if (mergeCancel) mergeCancel.onclick = () => {
        document.getElementById('tag-merge-panel').classList.add('d-none');
        updateTagManagerSelection();
    };
    if (mergeConfirm) mergeConfirm.onclick = () => mergeSelectedTags();
    
    // Store aboneliklerini başlat
    setupStoreSubscriptions();
    
    // Global referans
    window.applyFiltersAndSearch = applyFiltersAndSearch;
});