// app.js - TAM KOD
// ✅ GÜNCELLEME (Adım 2.3): Practice Session modu
// ✅ GÜNCELLEME (Adım 2.4): Playlist sistemi
// ✅ GÜNCELLEME (Adım 3.3): loadTagColors çağrısı
// ✅ GÜNCELLEME (Adım 3.2): URL durum senkronizasyonu
// ✅ DÜZELTME: Instructor butonları initFormHandlers SONRASINDA doğrudan
//   onclick ile kurulur — hangi koşulda olursa olsun çalışması garanti
// ✅ GÜNCELLEME: menu-instructors butonu (Eğitmenler sayfası) eklendi
import { translations } from './i18n.js';
import { icon } from './icons.js';
import { closeBottomSheet } from './utils.js'; // Adim 5.5
import { initAuth, signOut } from './auth.js';
import { handlePasteEvent, handleFileSelect, resetUploadedCoverUrl } from './storage.js';
import {
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly,
    renderModalChips, initModalCallbacks
} from './tangoModals.js';
import { setupAutocomplete } from './uiRenderer.js';
import { ensureModalLoaded, ensureViewLoaded, onModalLoaded, registerLoaded } from './modalLoader.js'; // Adim 3.4
import { renderFormChips } from './formHandlers.js';
import {
    initVideoHandlers, toggleFavorite, applyFiltersAndSearch, setVisibleCount,
    incrementVisibleCount, deleteVideoFlow, setVideoHandlersGlobalData, setupInfiniteScroll,
    toggleViewMode, pickRandomVideo, resetPracticeCount
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
    fetchInstructors, fetchVideos, renderStatsPanel, renderTagManagerUI, renderDashboard,
    setShowsCallbacks, renderShows, updateAllLanguages
} from './dataManager.js';
import {
    callSwitchView, clearAllFavorites, callGetUniqueTagsPool,
    startVideoEditFlow, callUpdateSmartAssistant, callUpdateInterfaceLanguage
} from './navigation.js';
import { setupStoreSubscriptions } from './uiSubscriptions.js';
import { getDueVideos } from './learning/spacedRepetition.js';
import { initPracticeSession, startPracticeSession } from './practiceSession.js';
import { initPlaylists, renderPlaylistsInMobileSheet, promptCreatePlaylist } from './playlistManager.js';
import { initPracticeListModule, renderPracticeListView, bindPracticeListSearch, clearPracticeList, populatePracticeListInstructorSelect, populatePracticeListTagSelect } from './practiceListManager.js';
import { loadTagColors } from './tagColorManager.js';
import { initRealtimeSync } from './realtime.js';
import { initChainManager, loadAllVideoLinks } from './chainManager.js';
import { initInstructorProfile, renderInstructorProfile } from './instructorProfile.js';
import { initInstructorsList, renderInstructorsList } from './instructorsList.js';
import { shareToWhatsApp, copyListToClipboard, exportToPrintView } from './export/listExport.js';
import { readUrlState, applyUrlStateToUI } from './urlState.js';
import { flushQueue, hasPendingItems, getPendingCount } from './syncQueue.js'; // Adim 4.5

// ─────────────────────────────────────────────────────────────
// Adim 3.4 (Seçenek B): modalLoader.js kullanılıyor
// Döngüsel import sorununu çözmek için ensureModalLoaded/ensureViewLoaded
// artık bu dosyada değil — modalLoader.js'te.
// Event listener callback'leri buradan onModalLoaded ile kaydedilir.
// ─────────────────────────────────────────────────────────────

async function loadTemplates() {
    const container = document.getElementById('dynamic-views');
    if (!container) return;
    try {
        const [library, stats, addVideo, tagManager, practiceSession, instructorProfile,
               dashboard, shows, practiceList, customDialogModal] = await Promise.all([
            fetch('views/library.html').then(r => r.text()),
            fetch('views/stats.html').then(r => r.text()),
            fetch('views/add-video.html').then(r => r.text()),
            fetch('views/tag-manager.html').then(r => r.text()),
            fetch('views/practice-session.html').then(r => r.text()),
            fetch('views/instructor-profile.html').then(r => r.text()),
            fetch('views/dashboard.html').then(r => r.text()),
            fetch('views/shows.html').then(r => r.text()),
            fetch('views/practice-list.html').then(r => r.text()),
            fetch('modals/custom-dialog-modal.html').then(r => r.text()),
        ]);

        // Tüm view'lar baştan DOM'a eklenir
        container.innerHTML = library + stats + addVideo + tagManager +
                              practiceSession + instructorProfile + dashboard + shows + practiceList;

        // custom-dialog-modal kritik — hemen ekle
        let modalContainer = document.getElementById('modals-container');
        if (!modalContainer) {
            modalContainer = document.createElement('div');
            modalContainer.id = 'modals-container';
            document.body.appendChild(modalContainer);
        }
        modalContainer.insertAdjacentHTML('beforeend', customDialogModal);
        registerLoaded('custom-dialog-modal');

        // Diğer modallar lazy — ilk kullanımda yüklenecek
        ['video-modal', 'tags-edit-modal', 'annotation-modal', 'link-manager-modal'].forEach(k => {
            // Henüz yüklü değil — ensureModalLoaded ile yüklenecek
        });

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
    await initPracticeListModule();
    initRealtimeSync();

    initChainManager(openVideoModal, applyFiltersAndSearch);
    await loadAllVideoLinks();

    initInstructorProfile(callSwitchView);
    initInstructorsList(callSwitchView);
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
            callUpdateInterfaceLanguage();
            if (store.get('currentView') === 'stats') renderStatsPanel();
            if (store.get('currentView') === 'tagManager') renderTagManagerUI();
            if (store.get('currentView') === 'dashboard') renderDashboard();
            if (store.get('currentView') === 'shows') renderShows();
            if (store.get('currentView') === 'practiceList') {
                populatePracticeListInstructorSelect();
                populatePracticeListTagSelect();
                renderPracticeListView();
            }
            if (store.get('currentView') === 'instructorsList') {
                import('./instructorsList.js').then(({ renderInstructorsList }) => renderInstructorsList());
            }
            if (store.get('currentView') === 'instructorProfile') {
                import('./instructorProfile.js').then(({ renderInstructorProfile }) => {
                    const instrId = store.get('currentInstructorId');
                    if (instrId) renderInstructorProfile(instrId);
                });
            }
        };
    }

    // ── Sidebar menü butonları ──────────────────────────────────
    document.getElementById('menu-library')?.addEventListener('click',     () => { callSwitchView('library');         syncBottomNavActiveState('library');    });
    document.getElementById('menu-favorites')?.addEventListener('click',   () => { callSwitchView('favorites');       syncBottomNavActiveState('favorites');  });
    document.getElementById('menu-stats')?.addEventListener('click',       () => { callSwitchView('stats');           syncBottomNavActiveState('stats');      });
    document.getElementById('menu-add-video')?.addEventListener('click',   () => { callSwitchView('add');             syncBottomNavActiveState('add');        });
    document.getElementById('menu-tag-manager')?.addEventListener('click', () => { callSwitchView('tagManager');      syncBottomNavActiveState('tagManager'); });
    // ✅ YENİ: Eğitmenler sayfası
    document.getElementById('menu-dashboard')?.addEventListener('click',    () => { callSwitchView('dashboard');        syncBottomNavActiveState('dashboard'); });
    document.getElementById('menu-instructors')?.addEventListener('click', () => { callSwitchView('instructorsList'); });
    document.getElementById('menu-shows')?.addEventListener('click',       () => { callSwitchView('shows'); syncBottomNavActiveState('shows'); });
    document.getElementById('menu-practice-list')?.addEventListener('click', () => {
        callSwitchView('practiceList');
        syncBottomNavActiveState('practiceList');
        populatePracticeListInstructorSelect();
        populatePracticeListTagSelect();
        bindPracticeListSearch();
        renderPracticeListView();
    });

    // ── Pratik Başlat — ADIM 5: Pratik Listesi'ndeki videoları kullan ──
    document.getElementById('btn-start-practice')?.addEventListener('click', () => {
        const lang = store.get('currentLang');
        const allVideos = store.get('globalVideos') || [];
        const plIds = store.get('globalPracticeList') || [];
        const practiceVideos = allVideos.filter(
            v => plIds.includes(v.id) && (!v.content_type || v.content_type === 'combination')
        );
        if (practiceVideos.length === 0) {
            showCustomAlert(
                lang === 'tr'
                    ? 'Pratik listende video yok. Önce kartlardaki halter ikonuna basarak listeye video ekle.'
                    : 'Your practice list is empty. Add videos using the dumbbell icon on the cards.'
            );
            return;
        }
        startPracticeSession(practiceVideos);
    });

    // ── Tüm modül başlatıcıları ─────────────────────────────────
    initFormHandlers(formTagsArray, store.get('globalVideos'), fetchVideos, callSwitchView);
    initVideoHandlers(applyFiltersAndSearch, fetchVideos, openVideoModal, openTagsEditModal, startVideoEditFlow, deleteVideoFlow);
    initInstructorHandlers(fetchInstructors, fetchVideos);
    initTagManager(store.get('currentLang'), store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    initModalCallbacks(applyFiltersAndSearch);

    // ── EĞİTMEN BUTONLARI — Kesin çözüm ────────────────────────
    // initFormHandlers çağrısı SONRASINDA tekrar atanır.
    // onclick ataması her zaman son atananı korur — çift-handler YOK,
    // çift-toggle YOK. Bu satırlar hangi koşulda olursa olsun çalışır.

    // ➕ Yeni eğitmen formu aç/kapat
    const _btnToggle = document.getElementById('btn-toggle-new-instructor');
    if (_btnToggle) {
        _btnToggle.onclick = () => {
            const cont  = document.getElementById('new-instructor-container');
            const input = document.getElementById('form-new-instructor-input');
            const sBtn  = document.getElementById('btn-save-instructor');
            const lang  = translations[store.get('currentLang')];
            store.set('editInstructorId', null);
            if (cont)  cont.classList.toggle('d-none');
            if (input) input.value = '';
            if (sBtn)  sBtn.innerText = lang.btnAddIns || 'Ekle';
        };
    }

    // ✏️ Seçili eğitmeni düzenle
    const _btnEdit = document.getElementById('btn-edit-instructor');
    if (_btnEdit) {
        _btnEdit.onclick = () => {
            const sel  = document.getElementById('form-instructor-select');
            if (!sel || !sel.value) return;
            const insList = store.get('globalInstructors') || [];
            const ins = insList.find(i => String(i.id) === String(sel.value));
            if (!ins) return;
            const cont  = document.getElementById('new-instructor-container');
            const input = document.getElementById('form-new-instructor-input');
            const sBtn  = document.getElementById('btn-save-instructor');
            const lang  = translations[store.get('currentLang')];
            store.set('editInstructorId', sel.value);
            if (input) input.value = ins.name;
            if (sBtn)  sBtn.innerText = lang.btnUpdateIns || 'Güncelle';
            if (cont)  cont.classList.remove('d-none');
        };
    }

    // 🗑️ Seçili eğitmeni sil
    const _btnDelete = document.getElementById('btn-delete-instructor');
    if (_btnDelete) _btnDelete.onclick = () => deleteInstructor();

    // 💾 Yeni/düzenlenen eğitmeni kaydet
    const _btnSave = document.getElementById('btn-save-instructor');
    if (_btnSave) _btnSave.onclick = () => handleInstructorSubmit();

    // ── Çıkış butonu ────────────────────────────────────────────
    document.getElementById('btn-logout')?.addEventListener('click', async () => {
        const ok = await showCustomConfirm(
            store.get('currentLang') === 'tr'
                ? 'Çıkış yapmak istediğinize emin misiniz?'
                : 'Are you sure you want to sign out?',
            store.get('currentLang') === 'tr' ? 'Çıkış Yap' : 'Sign Out',
            store.get('currentLang') === 'tr' ? 'İptal'     : 'Cancel'
        );
        if (ok) await signOut();
    });

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
    document.getElementById('form-video-url')?.addEventListener('input', async (e) => {
        const url = e.target.value.trim();
        if (url) await autoFetchThumbnail(url);
    });

    // ── Kapak resmi paste + sıfırla ─────────────────────────────
    document.getElementById('drop-area')?.addEventListener('paste', (e) =>
        handlePasteEvent(e, store.get('currentLang'))
    );
    document.getElementById('btn-reset-cover')?.addEventListener('click', () => {
        resetUploadedCoverUrl();
        const imgPreview  = document.getElementById('image-preview');
        const dropAreaTxt = document.getElementById('drop-area-text');
        if (imgPreview)  imgPreview.classList.add('d-none');
        if (dropAreaTxt) dropAreaTxt.classList.remove('d-none');
    });

    // ── Arama ───────────────────────────────────────────────────
    document.getElementById('search-btn')?.addEventListener('click', () => applyFiltersAndSearch());
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
    // Adim 3.4: Event listener'lar modalLoader callback sistemiyle bağlanıyor
    onModalLoaded('video-modal', () => {
        document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
        document.getElementById('video-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'video-modal') closeVideoModal();
        });
    });

    onModalLoaded('tags-edit-modal', () => {
        document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
        document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
        });
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
    });

    // Adim 4.5: Partner adı autocomplete
    const partnerInput = document.getElementById('form-partner-name');
    const partnerList  = document.getElementById('partner-autocomplete-list');
    if (partnerInput && partnerList) {
        // Dropdown stilleri — aşağı açılır, arka planlı
        partnerList.style.cssText = `
            position:absolute; top:100%; left:0; right:0; z-index:9999;
            background:#1a1a2e; border:1px solid rgba(0,240,255,0.3);
            border-radius:8px; overflow:hidden; margin-top:2px;
            box-shadow:0 8px 24px rgba(0,0,0,0.6);
        `;

        partnerInput.addEventListener('input', () => {
            const val = partnerInput.value.trim().toLowerCase();
            partnerList.innerHTML = '';
            if (!val) return;
            const partners = [...new Set(
                (store.get('globalVideos') || [])
                    .map(v => v.partner_name)
                    .filter(n => n && n.toLowerCase().startsWith(val))
            )].slice(0, 6);
            partners.forEach(name => {
                const item = document.createElement('div');
                item.style.cssText = `
                    padding:9px 14px; cursor:pointer; font-size:0.85rem;
                    color:rgba(255,255,255,0.85); border-bottom:1px solid rgba(255,255,255,0.06);
                    transition:background 0.15s;
                `;
                item.textContent = name;
                item.addEventListener('mouseenter', () => item.style.background = 'rgba(0,240,255,0.1)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // blur'u engelle
                    partnerInput.value = name;
                    partnerList.innerHTML = '';
                });
                partnerList.appendChild(item);
            });
        });
        partnerInput.addEventListener('blur', () => {
            setTimeout(() => { partnerList.innerHTML = ''; }, 150);
        });
    }

    // ── Form submit + favori temizle ────────────────────────────
    document.getElementById('btn-submit-video')?.addEventListener('click', handleFormSubmit);
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);
    document.getElementById('btn-clear-practice-list')?.addEventListener('click', clearPracticeList);

    // ── Pratik Listem — Pratik Başlat butonu ───────────────────
    document.getElementById('pl-btn-start-practice')?.addEventListener('click', () => {
        const lang = store.get('currentLang');
        const allVideos = store.get('globalVideos') || [];
        const plIds = store.get('globalPracticeList') || [];
        const practiceVideos = allVideos.filter(
            v => plIds.includes(v.id) && (!v.content_type || v.content_type === 'combination')
        );
        if (practiceVideos.length === 0) {
            showCustomAlert(
                lang === 'tr'
                    ? 'Pratik listende video yok. Önce kartlardaki halter ikonuna basarak listeye video ekle.'
                    : 'Your practice list is empty. Add videos using the dumbbell icon on the cards.'
            );
            return;
        }
        startPracticeSession(practiceVideos);
    });

    // ── Pratik Listem — Grid/Liste toggle ──────────────────────
    document.getElementById('pl-btn-view-toggle')?.addEventListener('click', () => {
        const current = store.get('viewMode');
        const next = current === 'grid' ? 'list' : 'grid';
        store.set('viewMode', next);
        const btn = document.getElementById('pl-btn-view-toggle');
        if (btn) {
            const lang = store.get('currentLang');
            btn.innerHTML = next === 'list'
                ? `${icon('grid', { size: 15 })} Grid`
                : `${icon('list', { size: 15 })} ${lang === 'tr' ? 'Liste' : 'List'}`;
        }
        renderPracticeListView();
    });

    // ── Etiket yönetimi ─────────────────────────────────────────
    document.getElementById('tag-manager-merge-btn')?.addEventListener('click',   () => mergeSelectedTags());
    document.getElementById('tag-manager-delete-btn')?.addEventListener('click',  () => deleteSelectedTags());
    document.getElementById('tag-manager-cleanup-btn')?.addEventListener('click', () => cleanupUnusedTags());
    document.getElementById('tag-merge-cancel-btn')?.addEventListener('click', () => {
        // ÖNCESİ: panel önce d-none ile gizleniyor, hemen ardından
        // updateTagManagerSelection() çağrılıyordu. O fonksiyon işaretli
        // kutulara bakıp karar veriyor; kutular hâlâ işaretli olduğu için
        // paneli TEKRAR açıyordu. Gizle → anında geri aç, sonuçta İptal
        // hiçbir şey yapmıyor gibi görünüyordu.
        // DOĞRUSU: önce seçimi temizle; paneli kapatmayı ve üstteki
        // Birleştir/Sil butonlarını pasifleştirmeyi zaten
        // updateTagManagerSelection() kendisi yapıyor.
        document.querySelectorAll('#tag-manager-tbody .tag-checkbox')
            .forEach(cb => { cb.checked = false; });
        const selectAllCb = document.getElementById('tag-select-all');
        if (selectAllCb) selectAllCb.checked = false;
        const mergeNameInput = document.getElementById('tag-merge-new-name');
        if (mergeNameInput) mergeNameInput.value = '';
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
    // modal-tags-input autocomplete: ensureModalLoaded('tags-edit-modal') içinde bağlanıyor

    // ── Drive URL checkbox ──────────────────────────────────────
    document.getElementById('form-is-downloaded')?.addEventListener('change', (e) => {
        const driveContainer = document.getElementById('drive-url-container');
        if (driveContainer) driveContainer.classList.toggle('d-none', !e.target.checked);
    });

    // ── URL durumu ──────────────────────────────────────────────
    const urlState = readUrlState();
    if (urlState) {
        // Adim 4.1: URL'de özel view yoksa dashboard ile başla
    if (urlState.view && urlState.view !== 'library') {
        callSwitchView(urlState.view);
    } else if (!urlState.view) {
        callSwitchView('dashboard');
        syncBottomNavActiveState('dashboard');
    }
        setTimeout(() => { applyUrlStateToUI(urlState); applyFiltersAndSearch(); }, 100);
    }

    // ── Adim 5.2: Tarayıcı geri/ileri butonları ────────────────
    window.addEventListener('popstate', () => {
        const st = readUrlState();
        const targetView = (st && st.view) ? st.view : 'dashboard';
        // fromPopstate:true → callSwitchView yeni geçmiş eklemez (döngü önlenir)
        callSwitchView(targetView, { fromPopstate: true });
        syncBottomNavActiveState(targetView);
        // Filtreleri de geri yükle
        if (st) {
            setTimeout(() => { applyUrlStateToUI(st); applyFiltersAndSearch(); }, 100);
        }
    });

    // ── Offline senkronizasyon ──────────────────────────────────
    // Adim 4.5: Çevrimdışı kuyruk simgesi
    function updateOfflineBadge() {
        const badge    = document.getElementById('offline-queue-badge');
        const countEl  = document.getElementById('offline-queue-count');
        if (!badge) return;
        const count = getPendingCount();
        if (count > 0 && !navigator.onLine) {
            badge.style.display = 'inline-flex';
            if (countEl) countEl.textContent = count;
        } else {
            badge.style.display = 'none';
        }
    }

    window.addEventListener('online',  () => { flushQueue(); updateOfflineBadge(); });
    window.addEventListener('offline', () => { updateOfflineBadge(); });
    if (navigator.onLine && hasPendingItems()) { flushQueue(); }
    updateOfflineBadge();

    // Adim 4.5: Global Escape kısayolu — açık modalları kapat
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        // Video modal
        const videoModal = document.getElementById('video-modal');
        if (videoModal && !videoModal.classList.contains('d-none')) {
            closeVideoModal(); return;
        }
        // Tags edit modal
        const tagsModal = document.getElementById('tags-edit-modal');
        if (tagsModal && !tagsModal.classList.contains('d-none')) {
            closeTagsEditModal(); return;
        }
        // Annotation modal
        const annotModal = document.getElementById('annotation-modal');
        if (annotModal && !annotModal.classList.contains('d-none')) {
            annotModal.classList.add('d-none'); return;
        }
        // Link manager modal
        const linkModal = document.getElementById('link-manager-modal');
        if (linkModal && !linkModal.classList.contains('d-none')) {
            linkModal.classList.add('d-none'); return;
        }
    });

    // Adim 3.2: Senkron sirasinda cakisma olursa sunucudaki guncel veriyi cek
    window.addEventListener('tango:sync-conflict', async () => {
        try { await fetchVideos(); applyFiltersAndSearch(); } catch (e) {}
    });

    setupStoreSubscriptions();
    window.applyFiltersAndSearch = applyFiltersAndSearch;
    setupInfiniteScroll();

    // ── Bottom Nav ──────────────────────────────────────────────
    document.getElementById('bn-dashboard')?.addEventListener('click', () => { callSwitchView('dashboard'); syncBottomNavActiveState('dashboard'); });
    document.getElementById('bn-library')?.addEventListener('click',   () => { callSwitchView('library');    syncBottomNavActiveState('library');    });
    document.getElementById('bn-favorites')?.addEventListener('click', () => { callSwitchView('favorites');  syncBottomNavActiveState('favorites');  });
    document.getElementById('bn-practice-list')?.addEventListener('click', () => {
        callSwitchView('practiceList');
        syncBottomNavActiveState('practiceList');
        populatePracticeListInstructorSelect();
        populatePracticeListTagSelect();
        bindPracticeListSearch();
        renderPracticeListView();
    });

    // ── Bottom Nav: "Listelerim" sheet ──────────────────────────
    const listsSheetOverlay = document.getElementById('lists-sheet-overlay');
    document.getElementById('bn-lists')?.addEventListener('click', () => {
        renderPlaylistsInMobileSheet();
        listsSheetOverlay?.classList.remove('d-none');
    });
    document.getElementById('ms-lists-new')?.addEventListener('click', () => promptCreatePlaylist());
    listsSheetOverlay?.addEventListener('click', (e) => {
        if (e.target === listsSheetOverlay) closeBottomSheet(listsSheetOverlay);
    });

    // ── Bottom Nav: "Daha Fazla" sheet ──────────────────────────
    const moreSheetOverlay = document.getElementById('more-sheet-overlay');
    document.getElementById('bn-more')?.addEventListener('click', () => {
        moreSheetOverlay?.classList.remove('d-none');
    });
    moreSheetOverlay?.addEventListener('click', (e) => {
        if (e.target === moreSheetOverlay) closeBottomSheet(moreSheetOverlay);
    });
    document.getElementById('ms-stats')?.addEventListener('click', () => {
        callSwitchView('stats'); syncBottomNavActiveState('stats'); closeBottomSheet(moreSheetOverlay);
    });
    document.getElementById('ms-add')?.addEventListener('click', () => {
        callSwitchView('add'); syncBottomNavActiveState('add'); closeBottomSheet(moreSheetOverlay);
    });
    document.getElementById('ms-tags')?.addEventListener('click', () => {
        callSwitchView('tagManager'); syncBottomNavActiveState('tagManager'); closeBottomSheet(moreSheetOverlay);
    });
    document.getElementById('ms-instructors')?.addEventListener('click', () => {
        callSwitchView('instructorsList'); closeBottomSheet(moreSheetOverlay);
    });
    document.getElementById('ms-shows')?.addEventListener('click', () => {
        callSwitchView('shows'); syncBottomNavActiveState('shows'); closeBottomSheet(moreSheetOverlay);
    });

    // ── Grid/Liste toggle ───────────────────────────────────────
    document.getElementById('btn-view-toggle')?.addEventListener('click', toggleViewMode);

    // Tango Şovları callback'lerini kaydet
    setShowsCallbacks({
        toggleFavorite,
        openTagsEditModal,
        startVideoEditFlow,
        deleteVideoFlow,
        openVideoModal,
        updateLearningStatus: () => {},
        showPlaylistDropdown: () => {}
    });

    // ── Adim 5.5: Rastgele Keşfet butonu ────────────────────────
    const randomBtn = document.getElementById('btn-random-video');
    if (randomBtn) {
        const lang = store.get('currentLang');
        randomBtn.innerHTML = `${icon('shuffle', { size: 15, color: '#f59e0b' })} ${lang === 'tr' ? 'Rastgele' : 'Random'}`;
        randomBtn.addEventListener('click', pickRandomVideo);
    }

    callUpdateInterfaceLanguage();
}

export function syncBottomNavActiveState(viewName) {
    // Not: stats/add/tagManager artık "Daha Fazla" sheet'i üzerinden açılıyor,
    // bu yüzden alt barda kendi butonları yok — o durumlarda hiçbir bottom-nav
    // butonu aktif görünmez (sheet zaten kapanmış olur).
    const map = {
        dashboard:    'bn-dashboard',
        library:      'bn-library',
        favorites:    'bn-favorites',
        practiceList: 'bn-practice-list'
    };
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => btn.classList.remove('active'));
    const targetId = map[viewName];
    if (targetId) document.getElementById(targetId)?.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    initAuth(loadTemplates);
});