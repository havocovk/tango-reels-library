// app.js - DÜZELTİLMİŞ (arama butonu, güvenli element erişimi, hata yönetimi)
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

// ========== Şablon yükleme (HTML dosyalarını çek) ==========
async function loadTemplates() {
    const container = document.getElementById('dynamic-views');
    if (!container) return;

    try {
        const templates = {
            library: await fetch('views/library.html').then(r => r.text()),
            stats: await fetch('views/stats.html').then(r => r.text()),
            addVideo: await fetch('views/add-video.html').then(r => r.text()),
            tagManager: await fetch('views/tag-manager.html').then(r => r.text()),
            videoModal: await fetch('modals/video-modal.html').then(r => r.text()),
            tagsEditModal: await fetch('modals/tags-edit-modal.html').then(r => r.text()),
            customDialogModal: await fetch('modals/custom-dialog-modal.html').then(r => r.text())
        };

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modals-container';
        modalContainer.innerHTML = templates.videoModal + templates.tagsEditModal + templates.customDialogModal;
        document.body.appendChild(modalContainer);

        container.innerHTML = templates.library + templates.stats + templates.addVideo + templates.tagManager;

        // Tüm başlatma işlemlerini yap
        await initializeApp();
    } catch (err) {
        console.error('Şablon yükleme hatası:', err);
        const dynamicViews = document.getElementById('dynamic-views');
        if (dynamicViews) {
            dynamicViews.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
        }
    }
}

async function initializeApp() {
    // ========== 1. VERİLERİ ÇEK ==========
    await fetchInstructors();
    await fetchVideos();

    // ========== 2. CALLBACK'LERİ BAĞLA ==========
    initVideoHandlers(
        applyFiltersAndSearch,
        fetchVideos,
        openVideoModal,
        openTagsEditModal,
        startVideoEditFlow,
        deleteVideoFlow
    );

    initInstructorHandlers(fetchInstructors, fetchVideos);
    initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);
    initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    initModalCallbacks(applyFiltersAndSearch);

    // ========== 3. DİL ARABİLİMİNİ GÜNCELLE ==========
    callUpdateInterfaceLanguage();

    // ========== 4. BUTON OLAYLARI (GÜVENLİ) ==========
    // Dil değiştirme
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
        langToggleBtn.onclick = () => {
            const newLang = store.get('currentLang') === 'tr' ? 'en' : 'tr';
            store.set('currentLang', newLang);
            updateAllLanguages();
            callUpdateInterfaceLanguage();
            if (store.get('currentView') === 'stats') renderStatsPanel();
            if (store.get('currentView') === 'tagManager') renderTagManagerUI();
        };
    }

    // Menü butonları
    const menuLibrary = document.getElementById('menu-library');
    if (menuLibrary) menuLibrary.onclick = () => { callSwitchView('library'); };
    const menuFavorites = document.getElementById('menu-favorites');
    if (menuFavorites) menuFavorites.onclick = () => { callSwitchView('favorites'); };
    const menuStats = document.getElementById('menu-stats');
    if (menuStats) menuStats.onclick = () => { callSwitchView('stats'); };
    const menuAddVideo = document.getElementById('menu-add-video');
    if (menuAddVideo) menuAddVideo.onclick = () => callSwitchView('add');
    const menuTagManager = document.getElementById('menu-tag-manager');
    if (menuTagManager) menuTagManager.onclick = () => callSwitchView('tagManager');
    
    // Favori temizleme
    const clearFavBtn = document.getElementById('btn-clear-favorites');
    if (clearFavBtn) clearFavBtn.onclick = clearAllFavorites;
    
    // Drive checkbox
    const driveCheckbox = document.getElementById('form-is-downloaded');
    if (driveCheckbox) {
        driveCheckbox.onchange = (e) => {
            const container = document.getElementById('drive-url-container');
            const input = document.getElementById('form-drive-url');
            if (e.target.checked) {
                if (container) container.classList.remove('d-none');
                if (input) input.required = true;
            } else {
                if (container) container.classList.add('d-none');
                if (input) {
                    input.required = false;
                    input.value = '';
                }
            }
        };
    }
    
    // Otomatik tamamlama (form ve modal)
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, () => renderFormChips(), (newTag) => {
        if (!formTagsArray.includes(newTag)) {
            formTagsArray.push(newTag);
            renderFormChips();
            callUpdateSmartAssistant();
        }
    }, callGetUniqueTagsPool);
    
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly();
    }, callGetUniqueTagsPool);
    
    // Eğitmen form işlemleri
    const instructorSelect = document.getElementById('form-instructor-select');
    if (instructorSelect) instructorSelect.onchange = callUpdateSmartAssistant;
    
    const toggleInsBtn = document.getElementById('btn-toggle-new-instructor');
    if (toggleInsBtn) {
        toggleInsBtn.onclick = () => {
            store.set('editInstructorId', null);
            const newInstructorInput = document.getElementById('form-new-instructor-input');
            if (newInstructorInput) newInstructorInput.value = '';
            const saveInsBtn = document.getElementById('btn-save-instructor');
            if (saveInsBtn) saveInsBtn.innerText = translations[store.get('currentLang')].btnAddIns;
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.toggle('d-none');
        };
    }
    
    const editInsBtn = document.getElementById('btn-edit-instructor');
    if (editInsBtn) {
        editInsBtn.onclick = () => {
            const select = document.getElementById('form-instructor-select');
            if (!select || !select.value) return;
            store.set('editInstructorId', select.value);
            const newInstructorInput = document.getElementById('form-new-instructor-input');
            if (newInstructorInput) newInstructorInput.value = select.options[select.selectedIndex].text;
            const saveInsBtn = document.getElementById('btn-save-instructor');
            if (saveInsBtn) saveInsBtn.innerText = translations[store.get('currentLang')].btnUpdateIns;
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.remove('d-none');
        };
    }
    
    const delInsBtn = document.getElementById('btn-delete-instructor');
    if (delInsBtn) delInsBtn.onclick = deleteInstructor;
    
    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) saveInsBtn.onclick = handleInstructorSubmit;
    
    // Video form submit
    const videoForm = document.getElementById('add-video-form');
    if (videoForm) videoForm.onsubmit = handleFormSubmit;
    
    // 🔥 ARAMA BUTONU VE CANLI ARAMA (güvenli)
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) {
        searchBtn.onclick = () => {
            applyFiltersAndSearch();
        };
    }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyFiltersAndSearch();
        });
    }
    
    // Dropdown filtreler için change event'leri
    const roleFilter = document.getElementById('filter-role-select');
    if (roleFilter) roleFilter.onchange = () => { applyFiltersAndSearch(); };
    const instructorFilter = document.getElementById('filter-instructor-select');
    if (instructorFilter) instructorFilter.onchange = () => { applyFiltersAndSearch(); };
    const tagFilter = document.getElementById('filter-tag-select');
    if (tagFilter) tagFilter.onchange = () => { applyFiltersAndSearch(); };
    const dateFilter = document.getElementById('filter-date-select');
    if (dateFilter) dateFilter.onchange = () => { applyFiltersAndSearch(); };
    const platformFilter = document.getElementById('filter-platform-select');
    if (platformFilter) platformFilter.onchange = () => { applyFiltersAndSearch(); };
    
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) loadMoreBtn.onclick = () => { incrementVisibleCount(20); applyFiltersAndSearch(); };
    
    // Modallar
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) modalCloseBtn.onclick = closeVideoModal;
    const videoModal = document.getElementById('video-modal');
    if (videoModal) videoModal.onclick = (e) => { if (e.target.id === 'video-modal') closeVideoModal(); };
    
    const tagsModalClose = document.getElementById('tags-modal-close-btn');
    if (tagsModalClose) tagsModalClose.onclick = closeTagsEditModal;
    const tagsModal = document.getElementById('tags-edit-modal');
    if (tagsModal) tagsModal.onclick = (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); };
    
    // Kapak resmi yapıştırma
    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, store.get('currentLang')));
    
    // Etiket yönetimi butonları
    const mergeBtn = document.getElementById('tag-manager-merge-btn');
    if (mergeBtn) mergeBtn.onclick = () => mergeSelectedTags();
    const deleteTagsBtn = document.getElementById('tag-manager-delete-btn');
    if (deleteTagsBtn) deleteTagsBtn.onclick = () => deleteSelectedTags();
    const cleanupBtn = document.getElementById('tag-manager-cleanup-btn');
    if (cleanupBtn) cleanupBtn.onclick = () => cleanupUnusedTags();
    const cancelMergeBtn = document.getElementById('tag-merge-cancel-btn');
    if (cancelMergeBtn) cancelMergeBtn.onclick = () => {
        const mergePanel = document.getElementById('tag-merge-panel');
        if (mergePanel) mergePanel.classList.add('d-none');
        updateTagManagerSelection();
    };
    const confirmMergeBtn = document.getElementById('tag-merge-confirm-btn');
    if (confirmMergeBtn) confirmMergeBtn.onclick = () => mergeSelectedTags();
    
    // Store aboneliklerini başlat
    setupStoreSubscriptions();
    
    // Global referans
    window.applyFiltersAndSearch = applyFiltersAndSearch;
}

// DOM yüklendiğinde şablonları yükle
document.addEventListener('DOMContentLoaded', () => {
    loadTemplates().catch(err => {
        console.error('Şablon yükleme hatası:', err);
        const dynamicViews = document.getElementById('dynamic-views');
        if (dynamicViews) {
            dynamicViews.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
        }
    });
});