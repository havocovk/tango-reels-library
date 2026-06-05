// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu
// ✅ GÜNCELLEME (Adım 2.4): Playlist sistemi
// ✅ GÜNCELLEME (Adım 3.3): loadTagColors çağrısı
// ✅ GÜNCELLEME (Adım 3.2): URL durum senkronizasyonu
// ✅ DÜZELTME: Instructor buton çakışması — addEventListener yerine onclick atama kullanıldı,
//   böylece formHandlers.js'in onclick atamasıyla çift-tetikleme sorunu ortadan kalktı.
//   btn-add-instructor → btn-save-instructor ID düzeltildi.
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
import { readUrlState, applyUrlStateToUI } from './urlState.js';
import { flushQueue, hasPendingItems } from './syncQueue.js';

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
        modalContainer.innerHTML = videoModal + tagsEditModal + customDialogModal +
                                   annotationModal + linkManagerModal;
        document.body.appendChild(modalContainer);

        container.innerHTML = library + stats + addVideo + tagManager +
                              practiceSession + instructorProfile;

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

    // ── Dil butonu ──────────────────────────────────────────────
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
            applyFiltersAndSearch();
        };
    }

    // ── Çıkış Yap ───────────────────────────────────────────────
    const signOutBtn = document.getElementById('btn-sign-out');
    if (signOutBtn) {
        signOutBtn.onclick = async () => {
            const ok = await showCustomConfirm(
                store.get('currentLang') === 'tr'
                    ? 'Çıkış yapmak istediğinize emin misiniz?'
                    : 'Are you sure you want to sign out?',
                store.get('currentLang') === 'tr' ? 'Çıkış Yap' : 'Sign Out',
                store.get('currentLang') === 'tr' ? 'İptal' : 'Cancel'
            );
            if (ok) await signOut();
        };
    }

    // ── Paylaşım butonları ──────────────────────────────────────
    document.getElementById('btn-share-whatsapp')?.addEventListener('click', shareToWhatsApp);
    document.getElementById('btn-share-clipboard')?.addEventListener('click', copyListToClipboard);
    document.getElementById('btn-share-print')?.addEventListener('click', exportToPrintView);

    // ── Dosya seçici ────────────────────────────────────────────
    const selectFileBtn = document.getElementById('select-file-btn');
    const fileInputEl   = document.getElementById('cover-file-input');
    if (selectFileBtn && fileInputEl) {
        selectFileBtn.onclick = () => fileInputEl.click();
        fileInputEl.onchange  = async (e) => {
            const file = e.target.files[0];
            if (file) await handleFileSelect(file, store.get('currentLang'));
            fileInputEl.value = '';
        };
    }

    // ── Video URL → thumbnail ───────────────────────────────────
    const videoUrlInput = document.getElementById('form-video-url');
    if (videoUrlInput) {
        videoUrlInput.addEventListener('input', async (e) => {
            const url = e.target.value.trim();
            if (url) await autoFetchThumbnail(url);
        });
    }

    // ── Kapak resmi paste + sıfırla ─────────────────────────────
    document.getElementById('drop-area')?.addEventListener('paste', (e) =>
        handlePasteEvent(e, store.get('currentLang'))
    );
    const resetCoverBtn = document.getElementById('btn-reset-cover');
    if (resetCoverBtn) {
        resetCoverBtn.onclick = () => {
            resetUploadedCoverUrl();
            const imgPreview  = document.getElementById('image-preview');
            const dropAreaTxt = document.getElementById('drop-area-text');
            if (imgPreview)  imgPreview.classList.add('d-none');
            if (dropAreaTxt) dropAreaTxt.classList.remove('d-none');
        };
    }

    // ── Arama ───────────────────────────────────────────────────
    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.onclick = () => applyFiltersAndSearch();
    document.getElementById('search-input')?.addEventListener('input', () => {
        setVisibleCount(20);
        applyFiltersAndSearch();
    });

    // ── Filtreler ───────────────────────────────────────────────
    ['filter-role-select', 'filter-instructor-select', 'filter-tag-select',
     'filter-date-select', 'filter-platform-select', 'filter-learning-status-select']
    .forEach(id =>
        document.getElementById(id)?.addEventListener('change', () => applyFiltersAndSearch())
    );

    // ── Load more ───────────────────────────────────────────────
    document.getElementById('btn-load-more')?.addEventListener('click', () => {
        incrementVisibleCount(20);
        applyFiltersAndSearch();
    });

    // ── Modaller ────────────────────────────────────────────────
    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });
    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    // ── Form submit ─────────────────────────────────────────────
    document.getElementById('btn-submit-video')?.addEventListener('click', handleFormSubmit);
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);

    // ── EĞİTMEN YÖNETİM BUTONLARI ──────────────────────────────
    // ✅ DÜZELTME: addEventListener yerine onclick atama kullanılıyor.
    //    Böylece formHandlers.js'in de aynı butona onclick atadığı
    //    durumda çift-tetikleme (toggle x2 = görünmez değişim) olmaz.
    //    app.js'in ataması her zaman kazanır (daha sonra çalışır).

    // ➕ Yeni eğitmen formu aç/kapat
    const btnToggleIns = document.getElementById('btn-toggle-new-instructor');
    if (btnToggleIns) {
        btnToggleIns.onclick = () => {
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.toggle('d-none');
            store.set('editInstructorId', null);
            const input   = document.getElementById('form-new-instructor-input');
            const saveBtn = document.getElementById('btn-save-instructor');
            const lang    = translations[store.get('currentLang')];
            if (input)   input.value = '';
            if (saveBtn) saveBtn.innerText = lang.btnAddIns || 'Ekle';
        };
    }

    // ✏️ Seçili eğitmeni düzenle
    const btnEditIns = document.getElementById('btn-edit-instructor');
    if (btnEditIns) {
        btnEditIns.onclick = () => {
            const select = document.getElementById('form-instructor-select');
            if (!select || !select.value) return;
            const instructors = store.get('globalInstructors') || [];
            const instructor  = instructors.find(i => String(i.id) === String(select.value));
            if (!instructor) return;
            store.set('editInstructorId', select.value);
            const input      = document.getElementById('form-new-instructor-input');
            const saveBtn    = document.getElementById('btn-save-instructor');
            const container  = document.getElementById('new-instructor-container');
            const lang       = translations[store.get('currentLang')];
            if (input)     input.value = instructor.name;
            if (saveBtn)   saveBtn.innerText = lang.btnUpdateIns || 'Güncelle';
            if (container) container.classList.remove('d-none');
        };
    }

    // 🗑️ Seçili eğitmeni sil
    const btnDeleteIns = document.getElementById('btn-delete-instructor');
    if (btnDeleteIns) {
        btnDeleteIns.onclick = () => deleteInstructor();
    }

    // ✅ Eğitmen kaydet — btn-save-instructor (eski yanlış ID: btn-add-instructor)
    const btnSaveIns = document.getElementById('btn-save-instructor');
    if (btnSaveIns) {
        btnSaveIns.onclick = () => handleInstructorSubmit();
    }

    // ── Etiket yönetimi butonları ───────────────────────────────
    document.getElementById('tag-manager-merge-btn')?.addEventListener('click',   () => mergeSelectedTags());
    document.getElementById('tag-manager-delete-btn')?.addEventListener('click',  () => deleteSelectedTags());
    document.getElementById('tag-manager-cleanup-btn')?.addEventListener('click', () => cleanupUnusedTags());
    document.getElementById('tag-merge-cancel-btn')?.addEventListener('click', () => {
        document.getElementById('tag-merge-panel')?.classList.add('d-none');
        updateTagManagerSelection();
    });
    document.getElementById('tag-merge-confirm-btn')?.addEventListener('click', () => mergeSelectedTags());

    // ── Etiket autocomplete ─────────────────────────────────────
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

    // ── Drive URL checkbox ──────────────────────────────────────
    document.getElementById('form-is-downloaded')?.addEventListener('change', (e) => {
        const driveContainer = document.getElementById('drive-url-container');
        if (driveContainer) driveContainer.classList.toggle('d-none', !e.target.checked);
    });

    // ── Pratik Başlat ───────────────────────────────────────────
    const startPracticeBtn = document.getElementById('btn-start-practice');
    if (startPracticeBtn) {
        startPracticeBtn.addEventListener('click', () => {
            const dueVideos = getDueVideos(store.get('globalVideos'));
            if (dueVideos.length === 0) {
                showCustomAlert(
                    store.get('currentLang') === 'tr'
                        ? '🎉 Bugün için tüm kombinasyonları çalıştın! Harika iş.'
                        : '🎉 You\'ve practiced all combinations for today! Great job.'
                );
                return;
            }
            startPracticeSession(dueVideos);
        });
    }

    // ✅ ADIM 3.2: URL'den filtre durumunu oku ve uygula
    const urlState = readUrlState();
    if (urlState) {
        if (urlState.view && urlState.view !== 'library') {
            callSwitchView(urlState.view);
        }
        setTimeout(() => {
            applyUrlStateToUI(urlState);
            applyFiltersAndSearch();
        }, 100);
    }

    // ✅ ADIM 2.3: Online olunca bekleyen offline işlemleri gönder
    window.addEventListener('online', () => { flushQueue(); });
    if (navigator.onLine && hasPendingItems()) { flushQueue(); }

    setupStoreSubscriptions();
    window.applyFiltersAndSearch = applyFiltersAndSearch;
    setupInfiniteScroll();

    // ── Bottom Nav ──────────────────────────────────────────────
    document.getElementById('bn-library')?.addEventListener('click',   () => { callSwitchView('library');    syncBottomNavActiveState('library');    });
    document.getElementById('bn-favorites')?.addEventListener('click', () => { callSwitchView('favorites');  syncBottomNavActiveState('favorites');  });
    document.getElementById('bn-stats')?.addEventListener('click',     () => { callSwitchView('stats');      syncBottomNavActiveState('stats');      });
    document.getElementById('bn-add')?.addEventListener('click',       () => { callSwitchView('add');        syncBottomNavActiveState('add');        });
    document.getElementById('bn-tags')?.addEventListener('click',      () => { callSwitchView('tagManager'); syncBottomNavActiveState('tagManager'); });

    // ── Grid/Liste toggle ───────────────────────────────────────
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