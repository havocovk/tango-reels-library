// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu
// ✅ GÜNCELLEME (Adım 2.4): Playlist sistemi
// ✅ GÜNCELLEME (Adım 3.3): loadTagColors çağrısı
// ✅ GÜNCELLEME (Adım 3.2): URL durum senkronizasyonu — sayfa açılınca URL'den filtreler yükleniyor
import { translations } from './i18n.js';
import { initAuth, signOut } from './auth.js';
import { handlePasteEvent, handleFileSelect, resetUploadedCoverUrl } from './storage.js';
import {
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly,
    renderModalChips, initModalCallbacks
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
import { loadTagColors } from './tagColorManager.js';
import { initRealtimeSync } from './realtime.js';
import { initChainManager, loadAllVideoLinks } from './chainManager.js';
import { initInstructorProfile } from './instructorProfile.js';
import { shareToWhatsApp, copyListToClipboard, exportToPrintView } from './export/listExport.js';
import { readUrlState, applyUrlStateToUI } from './urlState.js'; // ✅ ADIM 3.2

async function loadTemplates() {
    const container = document.getElementById('dynamic-views');
    if (!container) return;
    try {
        const [library, stats, addVideo, tagManager, practiceSession, instructorProfile,
               videoModal, tagsEditModal, customDialogModal, annotationModal,
               linkManagerModal] = await Promise.all([
            fetch('views/library.html').then(r => r.text()),
            fetch('views/stats.html').then(r => r.text()),
            fetch('views/add-video.html').then(r => r.text()),
            fetch('views/tag-manager.html').then(r => r.text()),
            fetch('views/practice-session.html').then(r => r.text()),
            fetch('views/instructor-profile.html').then(r => r.text()),
            fetch('modals/video-modal.html').then(r => r.text()),
            fetch('modals/tags-edit-modal.html').then(r => r.text()),
            fetch('modals/custom-dialog-modal.html').then(r => r.text()),
            fetch('modals/annotation-modal.html').then(r => r.text()),
            fetch('modals/link-manager-modal.html').then(r => r.text()),
        ]);

        const modalContainer = document.createElement('div');
        modalContainer.id = 'modals-container';
        modalContainer.innerHTML = videoModal + tagsEditModal + customDialogModal + annotationModal + linkManagerModal;
        document.body.appendChild(modalContainer);

        container.innerHTML = library + stats + addVideo + tagManager + practiceSession + instructorProfile;

        await initializeApp();
    } catch (err) {
        console.error('Şablon yükleme hatası:', err);
        const dv = document.getElementById('dynamic-views');
        if (dv) dv.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

async function initializeApp() {
    await loadTagColors();
    await fetchInstructors();
    await fetchVideos();
    await initPlaylists();
    initRealtimeSync();

    initChainManager(openVideoModal, applyFiltersAndSearch);
    await loadAllVideoLinks();

    initInstructorProfile(callSwitchView);
    initPracticeSession(callSwitchView);

    const langBtn = document.getElementById('lang-toggle-btn');
    if (langBtn) {
        const savedLang = localStorage.getItem('tango_lang') || 'tr';
        store.set('currentLang', savedLang);
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

    initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);
    initVideoHandlers(applyFiltersAndSearch, fetchVideos, openVideoModal, openTagsEditModal, startVideoEditFlow, deleteVideoFlow);
    initInstructorHandlers(fetchInstructors, fetchVideos);
    initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    initModalCallbacks(applyFiltersAndSearch);

    // Çıkış butonu
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        const ok = await showCustomConfirm(
            store.get('currentLang') === 'tr'
                ? 'Çıkış yapmak istediğinize emin misiniz?'
                : 'Are you sure you want to sign out?',
            store.get('currentLang') === 'tr' ? 'Çıkış Yap' : 'Sign Out',
            store.get('currentLang') === 'tr' ? 'İptal' : 'Cancel'
        );
        if (ok) await signOut();
    });

    // Paylaşım butonları
    document.getElementById('btn-share-whatsapp')?.addEventListener('click', shareToWhatsApp);
    document.getElementById('btn-share-clipboard')?.addEventListener('click', copyListToClipboard);
    document.getElementById('btn-share-print')?.addEventListener('click', exportToPrintView);

    // Dosya seçici
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInputEl = document.getElementById('cover-file-input');
    if (selectFileBtn && fileInputEl) {
        selectFileBtn.onclick = () => fileInputEl.click();
        fileInputEl.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) await handleFileSelect(file, store.get('currentLang'));
            fileInputEl.value = '';
        };
    }

    // Video URL input → thumbnail + metadata otomatik çek
    const videoUrlInput = document.getElementById('form-video-url');
    if (videoUrlInput) {
        videoUrlInput.addEventListener('input', async (e) => {
            const url = e.target.value.trim();
            if (url) await autoFetchThumbnail(url);
        });
    }

    // Kapak resmi
    document.getElementById('drop-area')?.addEventListener('paste', (e) =>
        handlePasteEvent(e, store.get('currentLang'))
    );
    document.getElementById('btn-reset-cover')?.addEventListener('click', () => {
        resetUploadedCoverUrl();
        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) imgPreview.classList.add('d-none');
        const dropAreaText = document.getElementById('drop-area-text');
        if (dropAreaText) dropAreaText.classList.remove('d-none');
    });

    // Arama
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.onclick = () => applyFiltersAndSearch();
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', () => applyFiltersAndSearch());

    // Filtreler
    ['filter-role-select', 'filter-instructor-select', 'filter-tag-select',
     'filter-date-select', 'filter-platform-select', 'filter-learning-status-select']
    .forEach(id => document.getElementById(id)?.addEventListener('change', () => applyFiltersAndSearch()));

    // Load more
    document.getElementById('btn-load-more')?.addEventListener('click', () => {
        incrementVisibleCount(20);
        applyFiltersAndSearch();
    });

    // Modaller
    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });
    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    // Form submit
    document.getElementById('btn-submit-video')?.addEventListener('click', handleFormSubmit);
    document.getElementById('btn-add-instructor')?.addEventListener('click', handleInstructorSubmit);
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);

    // Etiket yönetimi butonları
    document.getElementById('tag-manager-merge-btn')?.addEventListener('click', () => mergeSelectedTags());
    document.getElementById('tag-manager-delete-btn')?.addEventListener('click', () => deleteSelectedTags());
    document.getElementById('tag-manager-cleanup-btn')?.addEventListener('click', () => cleanupUnusedTags());
    document.getElementById('tag-merge-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('tag-merge-panel')?.classList.add('d-none');
        updateTagManagerSelection();
    });
    document.getElementById('tag-merge-confirm-btn')?.addEventListener('click', () => mergeSelectedTags());

    // Etiket autocomplete
    setupAutocomplete(
        'form-tags-input', 'autocomplete-list', formTagsArray, renderFormChips,
        (tag) => {
            if (!formTagsArray.includes(tag)) {
                formTagsArray.push(tag);
                renderFormChips();
                callUpdateSmartAssistant();
            }
        },
        callGetUniqueTagsPool
    );
    setupAutocomplete(
        'modal-tags-input', 'modal-autocomplete-list', modalTagsArray, renderModalChips,
        (tag) => {
            if (!modalTagsArray.includes(tag)) {
                modalTagsArray.push(tag);
                renderModalChips();
                saveTagsToSupabaseDirectly();
            }
        },
        callGetUniqueTagsPool
    );

    // Drive URL checkbox
    document.getElementById('form-is-downloaded')?.addEventListener('change', (e) => {
        const driveContainer = document.getElementById('drive-url-container');
        if (driveContainer) driveContainer.classList.toggle('d-none', !e.target.checked);
    });

    // ✅ ADIM 3.2: Sayfa yüklenince URL'den filtre durumunu oku ve uygula
    const urlState = readUrlState();
    if (urlState) {
        // View değiştirilmesi gerekiyorsa
        if (urlState.view && urlState.view !== 'library') {
            callSwitchView(urlState.view);
        }
        // Dropdown'lara filtre değerlerini uygula (kısa gecikmeyle — DOM'un hazır olması için)
        setTimeout(() => {
            applyUrlStateToUI(urlState);
            applyFiltersAndSearch();
        }, 100);
    }

    setupStoreSubscriptions();
    window.applyFiltersAndSearch = applyFiltersAndSearch;
    setupInfiniteScroll();

    // Bottom Nav
    document.getElementById('bn-library')?.addEventListener('click', () => { callSwitchView('library'); syncBottomNavActiveState('library'); });
    document.getElementById('bn-favorites')?.addEventListener('click', () => { callSwitchView('favorites'); syncBottomNavActiveState('favorites'); });
    document.getElementById('bn-stats')?.addEventListener('click', () => { callSwitchView('stats'); syncBottomNavActiveState('stats'); });
    document.getElementById('bn-add')?.addEventListener('click', () => { callSwitchView('add'); syncBottomNavActiveState('add'); });
    document.getElementById('bn-tags')?.addEventListener('click', () => { callSwitchView('tagManager'); syncBottomNavActiveState('tagManager'); });

    // Grid/Liste toggle
    document.getElementById('btn-view-toggle')?.addEventListener('click', toggleViewMode);

    callUpdateInterfaceLanguage();
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
    initAuth(loadTemplates);
});