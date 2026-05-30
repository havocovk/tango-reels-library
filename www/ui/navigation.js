// ui/navigation.js - Görünüm geçişi (view switch)
import { translations } from '../i18n.js';
import { updateSmartFilenameAssistant } from './language.js';

export function switchView(viewName, state, functions) {
    state.currentView = viewName;
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-stats').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');
    const tagManagerBtn = document.getElementById('menu-tag-manager');
    if (tagManagerBtn) tagManagerBtn.classList.remove('active');

    const clearFavBtnContainer = document.getElementById('clear-favorites-container');
    const libraryView = document.getElementById('view-library-container');
    const statsView = document.getElementById('view-stats-container');
    const addView = document.getElementById('view-add-container');
    const tagView = document.getElementById('view-tag-manager-container');

    if (viewName === 'library' || viewName === 'favorites') {
        libraryView.classList.remove('d-none');
        statsView.classList.add('d-none');
        addView.classList.add('d-none');
        if (tagView) tagView.classList.add('d-none');
        document.getElementById(`menu-${viewName}`).classList.add('active');
        
        if (viewName === 'favorites') {
            clearFavBtnContainer.classList.remove('d-none');
        } else {
            clearFavBtnContainer.classList.add('d-none');
        }
        
        functions.applyFiltersAndSearch();
    } else if (viewName === 'stats') {
        libraryView.classList.add('d-none');
        statsView.classList.remove('d-none');
        addView.classList.add('d-none');
        if (tagView) tagView.classList.add('d-none');
        document.getElementById('menu-stats').classList.add('active');
        if (functions.updateStats) functions.updateStats();
    } else if (viewName === 'add') {
        libraryView.classList.add('d-none');
        statsView.classList.add('d-none');
        addView.classList.remove('d-none');
        if (tagView) tagView.classList.add('d-none');
        document.getElementById('menu-add-video').classList.add('active');
        
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            document.getElementById('form-title').innerText = lang.formTitle;
            document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            document.getElementById('add-video-form').reset();
            state.resetFormTags();
            functions.renderFormChips();
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            functions.resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant(state.currentLang, state.getFormTags());
    } else if (viewName === 'tagManager' && tagView) {
        libraryView.classList.add('d-none');
        statsView.classList.add('d-none');
        addView.classList.add('d-none');
        tagView.classList.remove('d-none');
        if (tagManagerBtn) tagManagerBtn.classList.add('active');
        if (functions.renderTagManager) functions.renderTagManager();
    }
}