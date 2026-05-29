// app.js - Yeni modüler yapı (DÜZELTİLMİŞ: eksik importlar eklendi)
import { translations } from './config.js';
import { handlePasteEvent } from './storage.js';
import { 
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly
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

// İlk çağrılar
setVideoHandlersGlobalData(store.get('currentLang'), store.get('currentView'), store.get('visibleCount'));
setInstructorHandlersGlobalData(store.get('currentLang'));
setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, store.get('globalVideos'));
initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);

initVideoHandlers(applyFiltersAndSearch, fetchVideos, openVideoModal, openTagsEditModal, startVideoEditFlow, deleteVideoFlow);
initInstructorHandlers(fetchInstructors, fetchVideos);
initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);

// DOM yüklendiğinde
document.addEventListener('DOMContentLoaded', async () => {
    await fetchInstructors();
    await fetchVideos();
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
    
    // Drive checkbox
    document.getElementById('form-is-downloaded').onchange = (e) => {
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
    
    // Otomatik tamamlama
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, () => renderFormChips(), (newTag) => {
        if (!formTagsArray.includes(newTag)) {
            formTagsArray.push(newTag);
            renderFormChips();
            callUpdateSmartAssistant();
        }
    }, callGetUniqueTagsPool);
    
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly(store.get('globalVideos'), applyFiltersAndSearch);
    }, callGetUniqueTagsPool);
    
    // Eğitmen form işlemleri
    document.getElementById('form-instructor-select').onchange = callUpdateSmartAssistant;
    document.getElementById('btn-toggle-new-instructor').onclick = () => {
        store.set('editInstructorId', null);
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[store.get('currentLang')].btnAddIns;
        document.getElementById('new-instructor-container').classList.toggle('d-none');
    };
    document.getElementById('btn-edit-instructor').onclick = () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return;
        store.set('editInstructorId', select.value);
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('btn-save-instructor').innerText = translations[store.get('currentLang')].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    };
    document.getElementById('btn-delete-instructor').onclick = deleteInstructor;
    document.getElementById('btn-save-instructor').onclick = handleInstructorSubmit;
    
    // Video form submit
    document.getElementById('add-video-form').onsubmit = handleFormSubmit;
    
    // Filtreleme
    const handleFilter = () => { setVisibleCount(20); applyFiltersAndSearch(); };
    document.getElementById('filter-role-select').onchange = handleFilter;
    document.getElementById('filter-instructor-select').onchange = handleFilter;
    document.getElementById('filter-tag-select').onchange = handleFilter;
    document.getElementById('filter-date-select').onchange = handleFilter;
    document.getElementById('filter-platform-select').onchange = handleFilter;
    document.getElementById('filter-btn').onclick = () => { setVisibleCount(20); fetchVideos(); };
    document.getElementById('btn-load-more').onclick = () => { incrementVisibleCount(20); applyFiltersAndSearch(); };
    
    // Modallar
    document.getElementById('modal-close-btn').onclick = closeVideoModal;
    document.getElementById('video-modal').onclick = (e) => { if (e.target.id === 'video-modal') closeVideoModal(); };
    document.getElementById('tags-modal-close-btn').onclick = closeTagsEditModal;
    document.getElementById('tags-edit-modal').onclick = (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); };
    
    // Kapak resmi yapıştırma
    document.getElementById('drop-area')?.addEventListener('paste', (e) => handlePasteEvent(e, store.get('currentLang')));
    
    // Etiket yönetimi butonları
    document.getElementById('tag-manager-merge-btn').onclick = () => mergeSelectedTags();
    document.getElementById('tag-manager-delete-btn').onclick = () => deleteSelectedTags();
    document.getElementById('tag-manager-cleanup-btn').onclick = () => cleanupUnusedTags();
    document.getElementById('tag-merge-cancel-btn').onclick = () => {
        document.getElementById('tag-merge-panel').classList.add('d-none');
        updateTagManagerSelection();
    };
    document.getElementById('tag-merge-confirm-btn').onclick = () => mergeSelectedTags();
    
    // Global referans
    window.applyFiltersAndSearch = applyFiltersAndSearch;
});