// app.js
import { translations } from './config.js';
import { handlePasteEvent, resetUploadedCoverUrl } from './storage.js';
import { toggleFavorite, clearAllFavorites, getFavorites } from './favorites.js';
import { updateSmartFilenameAssistant } from './utils.js';
import { setupAutocomplete, setGlobalVideosTagsRef } from './tags.js';
import { updateInterfaceLanguage, renderVideoCards, switchView } from './ui.js';
import * as api from './api.js';

// Yeni Modüllerimiz
import * as modals from './modals.js';
import * as instructors from './instructors.js';
import * as handlers from './handlers.js';

// MERKEZİ UYGULAMA DURUMU (STATE)
const AppState = {
    currentLang: 'tr',
    globalVideos: [],
    editInstructorId: null,
    editingVideoId: null,
    currentView: 'library',
    formTagsArray: [],
    modalTagsArray: [],
    activeEditTagsVideoId: null,
    onRefreshUI: fetchVideos // Diğer modüllerin listeleri yenilemesini sağlar
};

setGlobalVideosTagsRef(() => AppState.globalVideos);

async function fetchVideos() {
    try {
        AppState.globalVideos = await api.getAllVideos();
        applyFiltersAndSearch();
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `
            <div class="info-msg" style="color: #ef4444;">${translations[AppState.currentLang].error}</div>`;
        console.error(err);
    }
}

function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locationVal = document.getElementById('filter-location-select').value;
    const favs = getFavorites();

    const filtered = AppState.globalVideos.filter(video => {
        if (AppState.currentView === 'favorites' && !favs.includes(video.id)) return false;

        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const videoTags = video.tags ? video.tags.toLowerCase() : '';
        
        const matchesSearch = insName.includes(searchVal) || partnerName.includes(searchVal) || videoTags.includes(searchVal);
        const matchesRole = (roleVal === 'all') || (video.role_type === roleVal);
        
        let matchesLocation = true;
        if (locationVal === 'drive') matchesLocation = (video.is_downloaded === true);
        else if (locationVal === 'social') matchesLocation = (!video.is_downloaded);

        return matchesSearch && matchesRole && matchesLocation;
    });

    renderVideoCards({
        videos: filtered,
        currentLang: AppState.currentLang,
        currentView: AppState.currentView,
        onToggleFav: (id) => toggleFavorite(id, AppState.currentLang, applyFiltersAndSearch),
        onOpenTagsModal: (video) => modals.openTagsEditModal(video, AppState),
        onStartEdit: (video) => handlers.startVideoEditFlow(video, AppState, handleSwitchView),
        onDeleteVideo: (id) => handlers.deleteVideoFlow(id, AppState),
        onOpenVideoModal: modals.openVideoModal
    });
}

function handleSwitchView(viewName) {
    AppState.currentView = viewName;
    switchView({
        viewName,
        currentLang: AppState.currentLang,
        editingVideoId: AppState.editingVideoId,
        renderFormChipsFn: () => handlers.renderFormChips(AppState),
        updateFilenameFn: () => updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray),
        resetCoverFn: resetUploadedCoverUrl,
        applyFiltersFn: applyFiltersAndSearch
    });
}

// OLAY DİNLEYİCİLERİ VE BAŞLANGIÇ
document.addEventListener('DOMContentLoaded', () => {
    instructors.fetchInstructors(AppState);
    fetchVideos();

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        AppState.currentLang = AppState.currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage(AppState.currentLang, AppState.editingVideoId, AppState.editInstructorId, AppState.formTagsArray, applyFiltersAndSearch);
    });

    document.getElementById('menu-library').addEventListener('click', () => { AppState.editingVideoId = null; handleSwitchView('library'); });
    document.getElementById('menu-favorites').addEventListener('click', () => { AppState.editingVideoId = null; handleSwitchView('favorites'); });
    document.getElementById('menu-add-video').addEventListener('click', () => handleSwitchView('add'));

    document.getElementById('btn-clear-favorites').addEventListener('click', () => {
        clearAllFavorites(AppState.currentLang, applyFiltersAndSearch);
    });

    document.getElementById('form-is-downloaded').addEventListener('change', (e) => {
        const container = document.getElementById('drive-url-container');
        const input = document.getElementById('form-drive-url');
        container.classList.toggle('d-none', !e.target.checked);
        input.required = e.target.checked;
        if (!e.target.checked) input.value = '';
    });

    setupAutocomplete('form-tags-input', 'autocomplete-list', AppState.formTagsArray, () => handlers.renderFormChips(AppState), (newTag) => {
        AppState.formTagsArray.push(newTag);
        handlers.renderFormChips(AppState);
        updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray);
    });

    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', AppState.modalTagsArray, () => modals.renderModalChips(AppState), (newTag) => {
        AppState.modalTagsArray.push(newTag);
        modals.saveModalTags(AppState);
    });

    document.getElementById('form-instructor-select').addEventListener('change', () => updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray));

    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        AppState.editInstructorId = null;
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[AppState.currentLang].btnAddIns;
        document.getElementById('new-instructor-container').classList.toggle('d-none');
    });

    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select || !select.value) return;
        AppState.editInstructorId = select.value;
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('btn-save-instructor').innerText = translations[AppState.currentLang].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    });

    document.getElementById('btn-delete-instructor').addEventListener('click', () => instructors.deleteInstructorFlow(AppState));
    document.getElementById('btn-save-instructor').addEventListener('click', () => instructors.handleInstructorSubmit(AppState));
    document.getElementById('add-video-form').addEventListener('submit', (e) => handlers.handleFormSubmit(e, AppState, handleSwitchView));
    
    document.getElementById('search-input').addEventListener('input', applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-btn').addEventListener('click', applyFiltersAndSearch);

    document.getElementById('modal-close-btn').addEventListener('click', modals.closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => { if (e.target.id === 'video-modal') modals.closeVideoModal(); });
    document.getElementById('tags-modal-close-btn').addEventListener('click', () => modals.closeTagsEditModal(AppState));
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => { if (e.target.id === 'tags-edit-modal') modals.closeTagsEditModal(AppState); });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, AppState.currentLang));
});