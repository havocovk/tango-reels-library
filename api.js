// app.js
import { AppState } from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { handleFormSubmit } from './handlers.js';
import { clearAllFavorites } from './favorites.js';
import { handlePasteEvent } from './storage.js';

async function initApp() {
    const savedLang = localStorage.getItem('atkk_lang');
    if (savedLang) AppState.currentLang = savedLang;
    
    AppState.onRefreshUI = loadDataAndRender;

    setupEventListeners();
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
    
    document.getElementById('add-video-form').addEventListener('submit', (e) => handleFormSubmit(e, ui.switchView));

    document.getElementById('search-input').addEventListener('input', ui.applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', ui.applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', ui.applyFiltersAndSearch);

    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, AppState.currentLang));
    
    // Video Oynatma Pop-up Tetikleyicisi
    document.addEventListener('click', (e) => {
        const playBtn = e.target.closest('.play-overlay');
        if (playBtn) {
            const driveUrl = playBtn.getAttribute('data-drive-url');
            const videoUrl = playBtn.getAttribute('data-video-url');
            const iframe = document.getElementById('modal-iframe');
            if (iframe) {
                iframe.src = (driveUrl && driveUrl.includes('drive.google.com')) 
                    ? driveUrl.replace(/\/view\?usp=sharing|\/view/g, '/preview') 
                    : videoUrl;
                document.getElementById('video-modal').classList.remove('d-none');
            }
        }
    });

    document.getElementById('modal-close-btn').addEventListener('click', () => {
        document.getElementById('modal-iframe').src = '';
        document.getElementById('video-modal').classList.add('d-none');
    });
}

document.addEventListener('DOMContentLoaded', initApp);