// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu
// ✅ GÜNCELLEME (Adım 2.4): Playlist sistemi (initPlaylists çağrısı)
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
    incrementVisibleCount, deleteVideoFlow, setVideoHandlersGlobalData, setupInfiniteScroll
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
import { initPlaylists } from './playlistManager.js'; // ✅ YENİ (Adım 2.4)

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
            videoModal:      await fetch('modals/video-modal.html').then(r => r.text()),
            tagsEditModal:   await fetch('modals/tags-edit-modal.html').then(r => r.text()),
            customDialogModal: await fetch('modals/custom-dialog-modal.html').then(r => r.text())
        };
        const modalContainer = document.createElement('div');
        modalContainer.id = 'modals-container';
        modalContainer.innerHTML = templates.videoModal + templates.tagsEditModal + templates.customDialogModal;
        document.body.appendChild(modalContainer);
        container.innerHTML =
            templates.library + templates.stats + templates.addVideo +
            templates.tagManager + templates.practiceSession;
        await initializeApp();
    } catch (err) {
        console.error('Şablon yükleme hatası:', err);
        const dynamicViews = document.getElementById('dynamic-views');
        if (dynamicViews) dynamicViews.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

async function initializeApp() {
    await fetchInstructors();
    await fetchVideos();

    initVideoHandlers(applyFiltersAndSearch, fetchVideos, openVideoModal, openTagsEditModal, startVideoEditFlow, deleteVideoFlow);
    initInstructorHandlers(fetchInstructors, fetchVideos);
    initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);
    initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    initModalCallbacks(applyFiltersAndSearch);
    initPracticeSession(callSwitchView);

    // ✅ YENİ (Adım 2.4): Playlist'leri başlat
    await initPlaylists();

    callUpdateInterfaceLanguage();

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
    document.getElementById('menu-library')?.addEventListener('click', () => callSwitchView('library'));
    document.getElementById('menu-favorites')?.addEventListener('click', () => callSwitchView('favorites'));
    document.getElementById('menu-stats')?.addEventListener('click', () => callSwitchView('stats'));
    document.getElementById('menu-add-video')?.addEventListener('click', () => callSwitchView('add'));
    document.getElementById('menu-tag-manager')?.addEventListener('click', () => callSwitchView('tagManager'));

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

    // Favori temizleme
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);

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
                if (input) { input.required = false; input.value = ''; }
            }
        };
    }

    // Otomatik tamamlama
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, () => renderFormChips(), (newTag) => {
        if (!formTagsArray.includes(newTag)) { formTagsArray.push(newTag); renderFormChips(); callUpdateSmartAssistant(); }
    }, callGetUniqueTagsPool);
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        if (!modalTagsArray.includes(newTag)) modalTagsArray.push(newTag);
    }, callGetUniqueTagsPool);

    // Form submit
    document.getElementById('add-video-form')?.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(); });
    document.getElementById('instructor-form')?.addEventListener('submit', (e) => { e.preventDefault(); handleInstructorSubmit(); });
    document.getElementById('btn-delete-instructor')?.addEventListener('click', deleteInstructor);

    // Video URL → thumbnail
    document.getElementById('form-video-url')?.addEventListener('input', async (e) => {
        const url = e.target.value.trim();
        if (url) await autoFetchThumbnail(url);
    });

    // Dosya seçici
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInput = document.getElementById('cover-file-input');
    if (selectFileBtn && fileInput) {
        selectFileBtn.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) await handleFileSelect(file, store.get('currentLang'));
            fileInput.value = '';
        };
    }

    // Arama
    document.getElementById('search-btn')?.addEventListener('click', () => applyFiltersAndSearch());
    document.getElementById('search-input')?.addEventListener('input', () => applyFiltersAndSearch());

    // Filtreler
    ['filter-role-select','filter-instructor-select','filter-tag-select',
     'filter-date-select','filter-platform-select','filter-learning-status-select']
    .forEach(id => document.getElementById(id)?.addEventListener('change', () => applyFiltersAndSearch()));

    // Load more
    document.getElementById('btn-load-more')?.addEventListener('click', () => { incrementVisibleCount(20); applyFiltersAndSearch(); });

    // Modaller
    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => { if (e.target.id === 'video-modal') closeVideoModal(); });
    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); });

    // Kapak resmi yapıştırma
    document.getElementById('drop-area')?.addEventListener('paste', (e) => handlePasteEvent(e, store.get('currentLang')));

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
}

document.addEventListener('DOMContentLoaded', () => {
    loadTemplates().catch(err => {
        console.error('Şablon yükleme hatası:', err);
        const dv = document.getElementById('dynamic-views');
        if (dv) dv.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    });
});
