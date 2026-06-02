// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu
// ✅ GÜNCELLEME (Adım 2.4): Playlist sistemi
// ✅ GÜNCELLEME (Adım 3.3): loadTagColors çağrısı
import { translations } from './i18n.js';
import { handlePasteEvent, handleFileSelect, resetUploadedCoverUrl } from './storage.js';
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
import { loadTagColors } from './tagColorManager.js';
import { initRealtimeSync } from './realtime.js';

async function loadTemplates() {
    const container = document.getElementById('dynamic-views');
    if (!container) return;
    try {
        const [library, stats, addVideo, tagManager, practiceSession,
               videoModal, tagsEditModal, customDialogModal, annotationModal] = await Promise.all([
            fetch('views/library.html').then(r => r.text()),
            fetch('views/stats.html').then(r => r.text()),
            fetch('views/add-video.html').then(r => r.text()),
            fetch('views/tag-manager.html').then(r => r.text()),
            fetch('views/practice-session.html').then(r => r.text()),
            fetch('modals/video-modal.html').then(r => r.text()),
            fetch('modals/tags-edit-modal.html').then(r => r.text()),
            fetch('modals/custom-dialog-modal.html').then(r => r.text()),
            fetch('modals/annotation-modal.html').then(r => r.text()),
        ]);

        // Modalleri body'e ekle
        const modalContainer = document.createElement('div');
        modalContainer.id = 'modals-container';
        modalContainer.innerHTML = videoModal + tagsEditModal + customDialogModal + annotationModal;
        document.body.appendChild(modalContainer);

        // View'ları container'a ekle — her biri ayrı ayrı innerHTML ile
        // (string birleştirme kullanmıyoruz — bu sayede kapanmamış tag riski sıfır)
        container.innerHTML = library + stats + addVideo + tagManager + practiceSession;

        await initializeApp();
    } catch (err) {
        console.error('Şablon yükleme hatası:', err);
        const dv = document.getElementById('dynamic-views');
        if (dv) dv.innerHTML = '<div class="info-msg" style="color:#ef4444;">Sayfa yüklenirken hata oluştu. Lütfen sayfayı yenileyin.</div>';
    }
}

async function initializeApp() {
    // ✅ Etiket renklerini yükle (videolardan önce — kartlar ilk render'da renkli olsun)
    await loadTagColors();

    await fetchInstructors();
    await fetchVideos();
    await initPlaylists();
    initRealtimeSync();   // ✅ Adım 4.2: Realtime senkronizasyonu başlat

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

    document.getElementById('btn-submit-video')?.addEventListener('click', handleFormSubmit);
    document.getElementById('btn-add-instructor')?.addEventListener('click', handleInstructorSubmit);
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);

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

    // Arama
    document.getElementById('search-btn')?.addEventListener('click', () => applyFiltersAndSearch());
    document.getElementById('search-input')?.addEventListener('input', () => {
        setVisibleCount(20);
        applyFiltersAndSearch();
    });

    // Video URL → thumbnail
    document.getElementById('form-video-url')?.addEventListener('input', async (e) => {
        const url = e.target.value.trim();
        if (url) await autoFetchThumbnail(url);
    });

    // ── Eğitmen yönetim butonları ────────────────────────────────
    document.getElementById('btn-toggle-new-instructor')?.addEventListener('click', () => {
        const container = document.getElementById('new-instructor-container');
        if (container) container.classList.toggle('d-none');
        store.set('editInstructorId', null);
        const input = document.getElementById('form-new-instructor-input');
        if (input) input.value = '';
        const saveBtn = document.getElementById('btn-save-instructor');
        const lang = translations[store.get('currentLang')];
        if (saveBtn) saveBtn.innerText = lang.btnAddIns || 'Ekle';
    });

    document.getElementById('btn-edit-instructor')?.addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select || !select.value) return;
        const selectedId = parseInt(select.value);
        const instructors = store.get('globalInstructors');
        const instructor = instructors.find(i => i.id === selectedId);
        if (!instructor) return;
        store.set('editInstructorId', selectedId);
        const container = document.getElementById('new-instructor-container');
        if (container) container.classList.remove('d-none');
        const input = document.getElementById('form-new-instructor-input');
        if (input) input.value = instructor.name;
        const saveBtn = document.getElementById('btn-save-instructor');
        const lang = translations[store.get('currentLang')];
        if (saveBtn) saveBtn.innerText = lang.btnEditIns || 'Güncelle';
    });

    document.getElementById('btn-delete-instructor')?.addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor')?.addEventListener('click', handleInstructorSubmit);

    // ── Etiket autocomplete (virgülle chip oluşturma) ─────────────
    setupAutocomplete(
        'form-tags-input',
        'autocomplete-list',
        formTagsArray,
        renderFormChips,
        (tag) => {
            if (!formTagsArray.includes(tag)) {
                formTagsArray.push(tag);
                renderFormChips();
                callUpdateSmartAssistant();
            }
        },
        callGetUniqueTagsPool
    );

    // ── Drive URL kutucuğunu göster / gizle ──────────────────────
    document.getElementById('form-is-downloaded')?.addEventListener('change', (e) => {
        const driveContainer = document.getElementById('drive-url-container');
        if (driveContainer) driveContainer.classList.toggle('d-none', !e.target.checked);
    });

    // Filtreler
    ['filter-role-select','filter-instructor-select','filter-tag-select',
     'filter-date-select','filter-platform-select','filter-learning-status-select']
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

    // Etiket yönetimi butonları
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

    // Adım 7.1: Bottom Nav
    document.getElementById('bn-library')?.addEventListener('click', () => { callSwitchView('library'); syncBottomNavActiveState('library'); });
    document.getElementById('bn-favorites')?.addEventListener('click', () => { callSwitchView('favorites'); syncBottomNavActiveState('favorites'); });
    document.getElementById('bn-stats')?.addEventListener('click', () => { callSwitchView('stats'); syncBottomNavActiveState('stats'); });
    document.getElementById('bn-add')?.addEventListener('click', () => { callSwitchView('add'); syncBottomNavActiveState('add'); });
    document.getElementById('bn-tags')?.addEventListener('click', () => { callSwitchView('tagManager'); syncBottomNavActiveState('tagManager'); });

    // Adım 7.2: Grid/Liste toggle
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
    loadTemplates().catch(err => {
        console.error('DOMContentLoaded hata:', err);
    });
});