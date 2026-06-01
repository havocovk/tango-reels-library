// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu eklendi:
//   - loadTemplates(): views/practice-session.html fetch listesine eklendi
//   - initializeApp(): initPracticeSession çağrısı, "Pratik Başlat" butonu event listener
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
import { getDueVideos } from './learning/spacedRepetition.js';         // ✅ YENİ
import { initPracticeSession, startPracticeSession } from './practiceSession.js'; // ✅ YENİ

// ─────────────────────────────────────────────────────────────
// loadTemplates — tüm HTML parçalarını yükler
// ─────────────────────────────────────────────────────────────
async function loadTemplates() {
    const container = document.getElementById('dynamic-views');
    if (!container) return;
    try {
        const templates = {
            library:         await fetch('views/library.html').then(r => r.text()),
            stats:           await fetch('views/stats.html').then(r => r.text()),
            addVideo:        await fetch('views/add-video.html').then(r => r.text()),
            tagManager:      await fetch('views/tag-manager.html').then(r => r.text()),
            practiceSession: await fetch('views/practice-session.html').then(r => r.text()), // ✅ YENİ
            videoModal:      await fetch('modals/video-modal.html').then(r => r.text()),
            tagsEditModal:   await fetch('modals/tags-edit-modal.html').then(r => r.text()),
            customDialogModal: await fetch('modals/custom-dialog-modal.html').then(r => r.text())
        };

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modals-container';
        modalContainer.innerHTML = templates.videoModal + templates.tagsEditModal + templates.customDialogModal;
        document.body.appendChild(modalContainer);

        container.innerHTML =
            templates.library +
            templates.stats +
            templates.addVideo +
            templates.tagManager +
            templates.practiceSession; // ✅ YENİ

        await initializeApp();
    } catch (err) {
        console.error('Şablon yükleme hatası:', err);
        const dynamicViews = document.getElementById('dynamic-views');
        if (dynamicViews) dynamicViews.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

// ─────────────────────────────────────────────────────────────
// initializeApp — tüm handler'ları ve event listener'ları başlatır
// ─────────────────────────────────────────────────────────────
async function initializeApp() {
    await fetchInstructors();
    await fetchVideos();

    initVideoHandlers(applyFiltersAndSearch, fetchVideos, openVideoModal, openTagsEditModal, startVideoEditFlow, deleteVideoFlow);
    initInstructorHandlers(fetchInstructors, fetchVideos);
    initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);
    initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    initModalCallbacks(applyFiltersAndSearch);

    // ✅ YENİ (Adım 2.3): Practice Session modunu başlat
    initPracticeSession(callSwitchView);

    callUpdateInterfaceLanguage();

    // ── Dil değiştirme ──
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

    // ── Menü butonları ──
    document.getElementById('menu-library')?.addEventListener('click', () => callSwitchView('library'));
    document.getElementById('menu-favorites')?.addEventListener('click', () => callSwitchView('favorites'));
    document.getElementById('menu-stats')?.addEventListener('click', () => callSwitchView('stats'));
    document.getElementById('menu-add-video')?.addEventListener('click', () => callSwitchView('add'));
    document.getElementById('menu-tag-manager')?.addEventListener('click', () => callSwitchView('tagManager'));

    // ✅ YENİ (Adım 2.3): "Pratik Başlat" butonu
    const startPracticeBtn = document.getElementById('btn-start-practice');
    if (startPracticeBtn) {
        startPracticeBtn.addEventListener('click', () => {
            const videos = store.get('globalVideos');
            const dueVideos = getDueVideos(videos);
            if (dueVideos.length === 0) {
                const lang = store.get('currentLang');
                const msg = lang === 'tr'
                    ? '🎉 Bugün için tüm kombinasyonları çalıştın! Harika iş.'
                    : '🎉 You\'ve practiced all combinations for today! Great job.';
                alert(msg);
                return;
            }
            startPracticeSession(dueVideos);
        });
    }

    // ── Favori temizleme ──
    const clearFavBtn = document.getElementById('btn-clear-favorites');
    if (clearFavBtn) clearFavBtn.onclick = clearAllFavorites;

    // ── Drive checkbox ──
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

    // ── Otomatik tamamlama ──
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, () => renderFormChips(), (newTag) => {
        if (!formTagsArray.includes(newTag)) {
            formTagsArray.push(newTag);
            renderFormChips();
            callUpdateSmartAssistant();
        }
    }, callGetUniqueTagsPool);
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        if (!modalTagsArray.includes(newTag)) modalTagsArray.push(newTag);
    }, callGetUniqueTagsPool);

    // ── Form submit ──
    const addVideoForm = document.getElementById('add-video-form');
    if (addVideoForm) addVideoForm.onsubmit = (e) => { e.preventDefault(); handleFormSubmit(); };
    const instructorForm = document.getElementById('instructor-form');
    if (instructorForm) instructorForm.onsubmit = (e) => { e.preventDefault(); handleInstructorSubmit(); };

    // ── Eğitmen silme (tag-area'daki) ──
    document.getElementById('btn-delete-instructor')?.addEventListener('click', deleteInstructor);

    // ── Video URL input → thumbnail ──
    const videoUrlInput = document.getElementById('form-video-url');
    if (videoUrlInput) {
        videoUrlInput.addEventListener('input', async (e) => {
            const url = e.target.value.trim();
            if (url) await autoFetchThumbnail(url);
        });
    }

    // ── Dosya seçici ──
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInput     = document.getElementById('cover-file-input');
    if (selectFileBtn && fileInput) {
        selectFileBtn.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) await handleFileSelect(file, store.get('currentLang'));
            fileInput.value = '';
        };
    }

    // ── Arama ──
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.onclick = () => applyFiltersAndSearch();
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', () => applyFiltersAndSearch());

    // ── Filtreler ──
    document.getElementById('filter-role-select')?.addEventListener('change', () => applyFiltersAndSearch());
    document.getElementById('filter-instructor-select')?.addEventListener('change', () => applyFiltersAndSearch());
    document.getElementById('filter-tag-select')?.addEventListener('change', () => applyFiltersAndSearch());
    document.getElementById('filter-date-select')?.addEventListener('change', () => applyFiltersAndSearch());
    document.getElementById('filter-platform-select')?.addEventListener('change', () => applyFiltersAndSearch());
    document.getElementById('filter-learning-status-select')?.addEventListener('change', () => applyFiltersAndSearch());

    // ── Load more (yedek) ──
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) loadMoreBtn.onclick = () => { incrementVisibleCount(20); applyFiltersAndSearch(); };

    // ── Modaller ──
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) modalCloseBtn.onclick = closeVideoModal;
    const videoModal = document.getElementById('video-modal');
    if (videoModal) videoModal.onclick = (e) => { if (e.target.id === 'video-modal') closeVideoModal(); };
    const tagsModalClose = document.getElementById('tags-modal-close-btn');
    if (tagsModalClose) tagsModalClose.onclick = closeTagsEditModal;
    const tagsModal = document.getElementById('tags-edit-modal');
    if (tagsModal) tagsModal.onclick = (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); };

    // ── Kapak resmi yapıştırma ──
    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, store.get('currentLang')));

    // ── Etiket yönetimi ──
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

    // ── Sonsuz kaydırma ──
    setupInfiniteScroll();
}

// ─────────────────────────────────────────────────────────────
// Sayfa yüklenince başlat
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadTemplates().catch(err => {
        console.error('Şablon yükleme hatası:', err);
        const dynamicViews = document.getElementById('dynamic-views');
        if (dynamicViews) dynamicViews.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    });
});