// app.js
import { AppState } from './state.js';
import { translations } from './config.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { handleFormSubmit } from './handlers.js';
import { clearAllFavorites } from './favorites.js';
import { handlePasteEvent } from './storage.js';
import { setupAutocompleteSystems } from './tags.js';
import { handleInstructorSubmit, deleteInstructorFlow } from './instructors.js';
import { openVideoModal, closeVideoModal } from './modals.js';

async function initApp() {
    const savedLang = localStorage.getItem('atkk_lang');
    if (savedLang) AppState.currentLang = savedLang;
    
    AppState.onRefreshUI = loadDataAndRender;

    setupEventListeners();
    setupAutocompleteSystems();
    await loadDataAndRender();
}

async function loadDataAndRender() {
    try {
        const [videos, instructors] = await Promise.all([api.fetchVideos(), api.fetchInstructors()]);
        AppState.globalVideos = videos;
        ui.renderInstructorSelect(instructors);
        ui.applyFiltersAndSearch();
    } catch (err) {
        console.error(err);
        const grid = document.getElementById('video-grid');
        if (grid) grid.innerHTML = `<div class="info-msg" style="color: #ef4444;">${translations[AppState.currentLang].error}</div>`;
    }
}

function setupEventListeners() {
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        AppState.currentLang = AppState.currentLang === 'tr' ? 'en' : 'tr';
        localStorage.setItem('atkk_lang', AppState.currentLang);
        document.getElementById('lang-toggle-btn').innerText = AppState.currentLang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
        ui.applyStaticTranslations();
        ui.applyFiltersAndSearch();
    });

    document.getElementById('menu-library').addEventListener('click', () => ui.switchView('library'));
    document.getElementById('menu-favorites').addEventListener('click', () => ui.switchView('favorites'));
    document.getElementById('menu-add-video').addEventListener('click', () => ui.switchView('add'));
    document.getElementById('btn-clear-favorites').addEventListener('click', () => clearAllFavorites(ui.applyFiltersAndSearch));
    
    document.getElementById('form-is-downloaded').addEventListener('change', (e) => {
        const container = document.getElementById('drive-url-container');
        document.getElementById('form-drive-url').required = e.target.checked;
        if (e.target.checked) container.classList.remove('d-none');
        else { container.classList.add('d-none'); document.getElementById('form-drive-url').value = ''; }
    });

    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        document.getElementById('new-instructor-container').classList.toggle('d-none');
        document.getElementById('form-save-instructor').innerText = translations[AppState.currentLang].btnAddIns;
    });

    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return alert(translations[AppState.currentLang].assistantAlert);
        document.getElementById('new-instructor-container').classList.remove('d-none');
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('form-save-instructor').innerText = translations[AppState.currentLang].btnUpdateIns;
    });

    document.getElementById('btn-delete-instructor').addEventListener('click', deleteInstructorFlow);
    document.getElementById('form-save-instructor').addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form').addEventListener('submit', (e) => handleFormSubmit(e, ui.switchView));
    
    document.getElementById('search-input').addEventListener('input', ui.applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', ui.applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', ui.applyFiltersAndSearch);
    document.getElementById('filter-btn').addEventListener('click', ui.applyFiltersAndSearch);

    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('tags-modal-close-btn').addEventListener('click', () => {
        document.getElementById('tags-edit-modal').classList.add('d-none');
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, AppState.currentLang));
    
    document.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-overlay');
        if (playBtn) {
            openVideoModal(playBtn.getAttribute('data-drive-url'), playBtn.getAttribute('data-video-url'));
        }
    });
}

document.addEventListener('DOMContentLoaded', initApp);