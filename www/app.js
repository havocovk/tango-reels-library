// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu
// ✅ GÜNCELLEME (Adım 2.4): Playlist sistemi (initPlaylists çağrısı)
// ✅ GÜNCELLEME (Adım 3.3): loadTagColors çağrısı eklendi
import { translations } from './i18n.js';
import { handlePasteEvent, handleFileSelect } from './storage.js';
import {
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly,
    initModalCallbacks
} from './tangoModals.js';
import { setupAutocomplete } from './uiRenderer.js';
import { renderFormChips } from './formHandlers.js';
import {
    initVideoHandlers, toggleFavorite, applyFiltersAndSearch, setVisibleCount,
    incrementVisibleCount, deleteVideoFlow, setVideoHandlersGlobalData, setupInfiniteScroll,
    toggleViewMode
} from './videoHandlers.js';
import {
    initInstructorHandlers, handleInstructorSubmit, deleteInstructor,
    setInstructorHandlersGlobalData
} from './instructorHandlers.js';
import {
    initFormHandlers, handleFormSubmit, formTagsArray, setFormTagsArray,
    getFormTagsArray, setFormHandlersGlobalData, autoFetchThumbnail
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
import { getDueVideos } from './learning/spacedRepetition.js';
import { initPracticeSession, startPracticeSession } from './practiceSession.js';
import { initPlaylists } from './playlistManager.js';
import { loadTagColors } from './tagColorManager.js'; // ✅ YENİ (Adım 3.3)

async function loadTemplates() {
    const container = document.getElementById('dynamic-views');
    if (!container) return;
    try {
        const templates = {
            library:         await fetch('views/library.html').then(r => r.text()),
            stats:           await fetch('views/stats.html').then(r => r.text()),
            addVideo:        await fetch('views/add-video.html').then(r => r.text()),
            tagManager:      await fetch('views/tag-manager.html').then(r => r.text()),
            practiceSession: await fetch('views/practice-session.html').then(r => r.text()),
        };
        Object.values(templates).forEach(html => {
            const div = document.createElement('div');
            div.innerHTML = html;
            container.appendChild(div);
        });
    } catch (err) {
        console.error('Şablon yükleme hatası:', err);
    }
}

async function initializeApp() {
    await loadTemplates();

    const savedLang = localStorage.getItem('tango_lang') || 'tr';
    store.set('currentLang', savedLang);

    // ✅ Adım 3.3: Etiket renkleri uygulama başında yüklenir
    await loadTagColors();

    await fetchInstructors();
    await fetchVideos();
    await initPlaylists();

    initPracticeSession();

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
        langBtn.textContent = savedLang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
        langBtn.onclick = () => {
            const newLang = store.get('currentLang') === 'tr' ? 'en' : 'tr';
            store.set('currentLang', newLang);
            localStorage.setItem('tango_lang', newLang);
            langBtn.textContent = newLang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
            updateAllLanguages();
            callUpdateInterfaceLanguage();
            if (store.get('currentView') === 'stats') renderStatsPanel();
            if (store.get('currentView') === 'tagManager') renderTagManagerUI();
        };
    }

    // Sidebar menü butonları
    document.getElementById('menu-library')?.addEventListener('click', () => { callSwitchView('library'); syncBottomNavActiveState('library'); });
    document.getElementById('menu-favorites')?.addEventListener('click', () => { callSwitchView('favorites'); syncBottomNavActiveState('favorites'); });
    document.getElementById('menu-stats')?.addEventListener('click', () => { callSwitchView('stats'); syncBottomNavActiveState('stats'); });
    document.getElementById('menu-add-video')?.addEventListener('click', () => { callSwitchView('add'); syncBottomNavActiveState('add'); });
    document.getElementById('menu-tag-manager')?.addEventListener('click', () => { callSwitchView('tagManager'); syncBottomNavActiveState('tagManager'); });

    // Pratik Başlat
    document.getElementById('btn-start-practice')?.addEventListener('click', () => {
        const dueVideos = getDueVideos(store.get('globalVideos'));
        if (dueVideos.length === 0) {
            const lang = store.get('currentLang');
            alert(lang === 'tr'
                ? '🎉 Bugün için tüm kombinasyonları çalıştın! Harika iş.'
                : '🎉 You\'ve practiced all combinations for today! Great job.');
            return;
        }
        startPracticeSession(dueVideos);
    });

    // Form
    initFormHandlers();
    initVideoHandlers(
        applyFiltersAndSearch,
        fetchVideos,
        openVideoModal,
        openTagsEditModal,
        startVideoEditFlow,
        deleteVideoFlow
    );
    initInstructorHandlers();
    initModalCallbacks({ startVideoEditFlow, openTagsEditModal });

    document.getElementById('btn-submit-video')?.addEventListener('click', handleFormSubmit);
    document.getElementById('btn-add-instructor')?.addEventListener('click', handleInstructorSubmit);
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);

    const coverFileInput = document.getElementById('cover-file-input');
    if (coverFileInput) {
        coverFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0], store.get('currentLang'));
            }
        });
    }

    document.addEventListener('paste', (e) => handlePasteEvent(e, store.get('currentLang')));

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            setVisibleCount(20);
            applyFiltersAndSearch();
        });
    }

    const formVideoUrlInput = document.getElementById('form-video-url');
    if (formVideoUrlInput) {
        formVideoUrlInput.addEventListener('input', (e) => {
            autoFetchThumbnail(e.target.value);
        });
    }

    document.getElementById('btn-close-modal')?.addEventListener('click', closeVideoModal);
    document.getElementById('btn-close-tags-modal')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('btn-save-tags')?.addEventListener('click', saveTagsToSupabaseDirectly);

    // Filtreler
    ['filter-role-select','filter-instructor-select','filter-tag-select',
     'filter-date-select','filter-platform-select','filter-learning-status-select'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFiltersAndSearch);
    });

    // Etiket yönetimi
    document.getElementById('tag-manager-merge-btn')?.addEventListener('click', () => mergeSelectedTags());
    document.getElementById('tag-manager-delete-btn')?.addEventListener('click', () => deleteSelectedTags());
    document.getElementById('tag-manager-cleanup-btn')?.addEventListener('click', () => cleanupUnusedTags());
    document.getElementById('tag-merge-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('tag-merge-panel')?.classList.add('d-none');
        updateTagManagerSelection();
    });
    document.getElementById('tag-merge-confirm-btn')?.addEventListener('click', () => mergeSelectedTags());

    setupStoreSubscriptions();
    window.applyFiltersAndSearch = applyFiltersAndSearch;
    setupInfiniteScroll();

    // Adım 7.1: Bottom Nav butonları
    document.getElementById('bn-library')?.addEventListener('click', () => { callSwitchView('library'); syncBottomNavActiveState('library'); });
    document.getElementById('bn-favorites')?.addEventListener('click', () => { callSwitchView('favorites'); syncBottomNavActiveState('favorites'); });
    document.getElementById('bn-stats')?.addEventListener('click', () => { callSwitchView('stats'); syncBottomNavActiveState('stats'); });
    document.getElementById('bn-add')?.addEventListener('click', () => { callSwitchView('add'); syncBottomNavActiveState('add'); });
    document.getElementById('bn-tags')?.addEventListener('click', () => { callSwitchView('tagManager'); syncBottomNavActiveState('tagManager'); });

    // Adım 7.2: Grid/Liste toggle
    document.getElementById('btn-view-toggle')?.addEventListener('click', toggleViewMode);
}

export function syncBottomNavActiveState(viewName) {
    const map = {
        library:    'bn-library',
        favorites:  'bn-favorites',
        stats:      'bn-stats',
        add:        'bn-add',
        tagManager: 'bn-tags'
    };
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
    const targetId = map[viewName];
    if (targetId) document.getElementById(targetId)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    loadTemplates().catch(err => {
        console.error('Şablon yükleme hatası:', err);
        const dv = document.getElementById('dynamic-views');
        if (dv) dv.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    });
    initializeApp();
});