// videoHandlers.js
// ✅ GÜNCELLEME (Adım 2.4): playlist filtre ve dropdown desteği eklendi
// ✅ GÜNCELLEME (Adım 3.2): applyFiltersAndSearch URL durumunu yazıyor
// ✅ GÜNCELLEME (Adım 2.3): toggleFavorite ve updateLearningStatus offline destekli
import { dbAddFavorite, dbRemoveFavorite, dbDeleteVideo, dbUpdateLearningStatus } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { getFilteredVideos } from './tangoFilters.js';
import { translations } from './i18n.js';
import { store } from './store.js';
import { icon } from './icons.js';
import { showToast } from './toast.js';
import { showPlaylistDropdown } from './playlistManager.js';
import { writeUrlState } from './urlState.js';
import { enqueue } from './syncQueue.js';

let currentLang = 'tr';
let applyFiltersAndSearchCallback = null;
let fetchVideosCallback = null;
let openVideoModalCallback = null;
let openTagsEditModalCallback = null;
let startVideoEditFlowCallback = null;
let deleteVideoFlowCallback = null;
let scrollObserver = null;
let isLoadingMore = false;

export function setVideoHandlersGlobalData(lang) { currentLang = lang; }

export function initVideoHandlers(applyCb, fetchCb, openModalCb, openTagsCb, startEditCb, deleteCb) {
    applyFiltersAndSearchCallback = applyCb;
    fetchVideosCallback = fetchCb;
    openVideoModalCallback = openModalCb;
    openTagsEditModalCallback = openTagsCb;
    startVideoEditFlowCallback = startEditCb;
    deleteVideoFlowCallback = deleteCb;
}

// ✅ ADIM 2.3: Online → direkt DB; Offline → lokal güncelle + kuyruğa al
export async function toggleFavorite(videoId) {
    const isFav = store.get('globalFavorites').includes(videoId);

    if (!navigator.onLine) {
        // OFFLINE: lokal güncelle, kuyruğa ekle
        store.updateFavoriteLocally(videoId, !isFav);
        enqueue({
            type: isFav ? 'REMOVE_FAVORITE' : 'ADD_FAVORITE',
            payload: { videoId }
        });
        showToast(
            currentLang === 'tr'
                ? '📴 Çevrimdışı — değişiklik kaydedildi, bağlantı kurulunca gönderilecek'
                : '📴 Offline — change saved, will sync when online',
            'info', 4000
        );
        applyFiltersAndSearch();
        return;
    }

    // ONLINE: normal davranış
    try {
        if (isFav) {
            await dbRemoveFavorite(videoId);
            store.updateFavoriteLocally(videoId, false);
        } else {
            await dbAddFavorite(videoId);
            store.updateFavoriteLocally(videoId, true);
        }
        applyFiltersAndSearch();
    } catch (err) {
        showToast(translations[store.get('currentLang')].error || 'Favori güncellenemedi', 'error');
    }
}

// ✅ ADIM 2.3: Online → direkt DB; Offline → lokal güncelle + kuyruğa al
export async function updateLearningStatus(videoId, newStatus, currentReviewCount = 0) {
    const video = store.get('globalVideos').find(v => v.id === videoId);
    if (!video) return;

    if (!navigator.onLine) {
        // OFFLINE: lokal güncelle, kuyruğa ekle
        store.updateVideoLocally(videoId, {
            learning_status: newStatus,
            last_reviewed_at: new Date().toISOString(),
            review_count: (currentReviewCount || 0) + 1
        });
        enqueue({
            type: 'UPDATE_LEARNING_STATUS',
            // Adim 3.2: Çakışma koruması için videonun o anki updated_at'i de saklanır
            payload: {
                videoId,
                status: newStatus,
                reviewCount: currentReviewCount || 0,
                baseUpdatedAt: video.updated_at || null
            }
        });
        showToast(
            currentLang === 'tr'
                ? '📴 Çevrimdışı — değişiklik kaydedildi, bağlantı kurulunca gönderilecek'
                : '📴 Offline — change saved, will sync when online',
            'info', 4000
        );
        applyFiltersAndSearch();
        return;
    }

    // ONLINE: normal davranış
    try {
        const updatedVideo = await dbUpdateLearningStatus(videoId, newStatus, currentReviewCount, video.updated_at);
        if (updatedVideo) {
            store.updateVideoLocally(videoId, {
                learning_status: updatedVideo.learning_status,
                last_reviewed_at: updatedVideo.last_reviewed_at,
                review_count: updatedVideo.review_count,
                updated_at: updatedVideo.updated_at
            });
            showToast(getStatusText(newStatus), 'success');
            applyFiltersAndSearch();
        }
    } catch (err) {
        if (err.message.includes('CAKISMA') || err.message.includes('ÇAKIŞMA')) {
            showToast('Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.', 'error');
            location.reload();
        } else {
            showToast('Durum güncellenemedi: ' + err.message, 'error');
        }
    }
}

function getStatusText(status) {
    if (currentLang === 'tr') {
        if (status === 'new') return 'Yeni olarak işaretlendi';
        if (status === 'learning') return 'Çalışıyorum olarak işaretlendi';
        if (status === 'mastered') return 'Ustalaştım olarak işaretlendi';
    } else {
        if (status === 'new') return '🆕 Marked as New';
        if (status === 'learning') return '📚 Marked as Learning';
        if (status === 'mastered') return '✅ Marked as Mastered';
    }
    return status;
}

export function applyFiltersAndSearch() {
    const globalVideos = store.get('globalVideos');
    const currentView = store.get('currentView');
    const visibleCount = store.get('visibleCount');
    const favorites = store.get('globalFavorites');
    const activePlaylistId = store.get('activePlaylistId');
    const activePlaylistVideoIds = store.get('activePlaylistVideoIds') || [];

    // Koleksiyon ve pratik listem: sadece combination videoları
    // Tango Şovları: sadece show videoları
    const combinationVideos = globalVideos.filter(v => !v.content_type || v.content_type === 'combination');
    const showVideos        = globalVideos.filter(v => v.content_type === 'show');

    let source = combinationVideos;

    if (currentView === 'shows') {
        source = showVideos;
    } else if (activePlaylistId !== null && activePlaylistId !== undefined) {
        source = combinationVideos.filter(v => activePlaylistVideoIds.includes(v.id));
    } else if (currentView === 'favorites') {
        source = combinationVideos.filter(v => favorites.includes(v.id));
    }

    const searchInput = document.getElementById('search-input');
    const aramaMetni = searchInput ? searchInput.value : '';
    const rol = document.getElementById('filter-role-select')?.value || 'all';
    const egitmen = document.getElementById('filter-instructor-select')?.value || 'all';
    const etiket = document.getElementById('filter-tag-select')?.value || 'all';
    const tarih = document.getElementById('filter-date-select')?.value || 'all';
    const platform = document.getElementById('filter-platform-select')?.value || 'all';
    const learningStatus = document.getElementById('filter-learning-status-select')?.value || 'all';

    const filters = { aramaMetni, rol, egitmen, etiket, tarih, platform, learningStatus };

    // ✅ ADIM 3.2: Filtre durumunu URL'e yaz
    writeUrlState({
        view: currentView,
        instructor: egitmen,
        platform: platform,
        tag: etiket,
        status: learningStatus,
        role: rol,
        date: tarih,
        search: aramaMetni
    });

    const filtered = getFilteredVideos(source, filters, currentLang);
    const totalElem = document.getElementById('total-video-count');
    if (totalElem) {
        const label = currentView === 'favorites'
            ? translations[currentLang].favoritesCountLabel
            : (currentLang === 'tr' ? 'Toplam Video Sayısı:' : 'Total Videos:');
        totalElem.innerText = `${label} ${filtered.length}`;
    }

    const loadMoreDiv = document.getElementById('load-more-container');
    if (loadMoreDiv) {
        if (filtered.length > visibleCount) loadMoreDiv.classList.remove('d-none');
        else loadMoreDiv.classList.add('d-none');
    }

    renderVideoCards(filtered.slice(0, visibleCount), {
        currentLang,
        currentView,
        translations,
        favs: favorites,
        toggleFavorite,
        openTagsEditModal: (video) => openTagsEditModalCallback(video),
        startVideoEditFlow: startVideoEditFlowCallback,
        deleteVideoFlow: deleteVideoFlowCallback,
        openVideoModal: openVideoModalCallback,
        refreshList: applyFiltersAndSearchCallback,
        updateLearningStatus,
        showPlaylistDropdown
    });

    reconnectSentinel();
}

export function setVisibleCount(count) { store.set('visibleCount', count); }
export function incrementVisibleCount(inc) { store.set('visibleCount', store.get('visibleCount') + inc); }

export async function deleteVideoFlow(videoId) {
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okText, cancelText)) return;
    try {
        await dbDeleteVideo(videoId);
        store.removeVideoLocally(videoId);
        if (store.get('globalFavorites').includes(videoId)) store.updateFavoriteLocally(videoId, false);
        await showCustomAlert(lang.successDeleteVideo, okText);
        applyFiltersAndSearch();
    } catch (err) {
        await showCustomAlert(currentLang === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}

function reconnectSentinel() {
    if (scrollObserver) scrollObserver.disconnect();
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) return;
    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoadingMore) {
                const visibleCount = store.get('visibleCount');
                const globalVideos = store.get('globalVideos');
                const currentView = store.get('currentView');
                const favorites = store.get('globalFavorites');
                const activePlaylistId = store.get('activePlaylistId');
                const activePlaylistVideoIds = store.get('activePlaylistVideoIds') || [];
                const combVideos2 = globalVideos.filter(v => !v.content_type || v.content_type === 'combination');
                let source = currentView === 'shows'
                    ? globalVideos.filter(v => v.content_type === 'show')
                    : combVideos2;
                if (currentView !== 'shows') {
                    if (activePlaylistId !== null && activePlaylistId !== undefined) {
                        source = combVideos2.filter(v => activePlaylistVideoIds.includes(v.id));
                    } else if (currentView === 'favorites') {
                        source = combVideos2.filter(v => favorites.includes(v.id));
                    }
                }
                const searchInput = document.getElementById('search-input');
                const aramaMetni = searchInput ? searchInput.value : '';
                const filters = {
                    aramaMetni,
                    rol: document.getElementById('filter-role-select')?.value || 'all',
                    egitmen: document.getElementById('filter-instructor-select')?.value || 'all',
                    etiket: document.getElementById('filter-tag-select')?.value || 'all',
                    tarih: document.getElementById('filter-date-select')?.value || 'all',
                    platform: document.getElementById('filter-platform-select')?.value || 'all',
                    learningStatus: document.getElementById('filter-learning-status-select')?.value || 'all'
                };
                const filtered = getFilteredVideos(source, filters, currentLang);
                if (visibleCount < filtered.length) {
                    isLoadingMore = true;
                    const prevVisibleCount = visibleCount;
                    incrementVisibleCount(20);
                    // Adim 5.4: appendMode ile sadece yeni kartları ekle
                    const newVisibleCount = store.get('visibleCount');
                    const newCards = filtered.slice(prevVisibleCount, newVisibleCount);
                    if (newCards.length > 0) {
                        renderVideoCards(filtered.slice(0, newVisibleCount), {
                            currentLang,
                            currentView,
                            translations,
                            favs: favorites,
                            toggleFavorite,
                            openTagsEditModal: (video) => openTagsEditModalCallback(video),
                            startVideoEditFlow: startVideoEditFlowCallback,
                            deleteVideoFlow: deleteVideoFlowCallback,
                            openVideoModal: openVideoModalCallback,
                            refreshList: applyFiltersAndSearchCallback,
                            updateLearningStatus,
                            showPlaylistDropdown,
                            appendMode: true,
                            startIndex: prevVisibleCount
                        });
                        // load-more görünürlüğü güncelle
                        const loadMoreDiv = document.getElementById('load-more-container');
                        if (loadMoreDiv) {
                            if (newVisibleCount < filtered.length) loadMoreDiv.classList.remove('d-none');
                            else loadMoreDiv.classList.add('d-none');
                        }
                        reconnectSentinel();
                    }
                    setTimeout(() => { isLoadingMore = false; }, 300);
                }
            }
        });
    }, { threshold: 0.1 });
    scrollObserver.observe(sentinel);
}

// ─────────────────────────────────────────────────────────────
// pickRandomVideo — Adim 5.5 (duzeltilmis)
// Mevcut tüm filtreleri dikkate alarak rastgele bir video seçer
// ve kartına scroll edip vurgular.
// ─────────────────────────────────────────────────────────────
export function pickRandomVideo() {
    const globalVideos           = store.get('globalVideos') || [];
    const favorites              = store.get('globalFavorites') || [];
    const activePlaylistId       = store.get('activePlaylistId');
    const activePlaylistVideoIds = store.get('activePlaylistVideoIds') || [];

    const currentView2   = store.get('currentView');
    const combVideos3    = globalVideos.filter(v => !v.content_type || v.content_type === 'combination');
    let source = currentView2 === 'shows'
        ? globalVideos.filter(v => v.content_type === 'show')
        : combVideos3;
    if (currentView2 !== 'shows') {
        if (activePlaylistId != null) {
            source = combVideos3.filter(v => activePlaylistVideoIds.includes(v.id));
        } else if (currentView2 === 'favorites') {
            source = combVideos3.filter(v => favorites.includes(v.id));
        }
    }

    // Tüm aktif filtre değerlerini oku
    const filters = {
        aramaMetni:    document.getElementById('search-input')?.value || '',
        rol:           document.getElementById('filter-role-select')?.value || 'all',
        egitmen:       document.getElementById('filter-instructor-select')?.value || 'all',
        etiket:        document.getElementById('filter-tag-select')?.value || 'all',
        tarih:         document.getElementById('filter-date-select')?.value || 'all',
        platform:      document.getElementById('filter-platform-select')?.value || 'all',
        learningStatus:document.getElementById('filter-learning-status-select')?.value || 'all'
    };

    const filtered = getFilteredVideos(source, filters, currentLang);

    if (filtered.length === 0) {
        import('./toast.js').then(({ showToast }) => {
            showToast(
                currentLang === 'tr' ? 'Gösterilecek video yok.' : 'No videos to show.',
                'info'
            );
        });
        return;
    }

    const randomVideo  = filtered[Math.floor(Math.random() * filtered.length)];
    const visibleCount = store.get('visibleCount');
    const idx          = filtered.indexOf(randomVideo);

    if (idx >= visibleCount) {
        store.set('visibleCount', idx + 1);
        applyFiltersAndSearch();
    }

    setTimeout(() => {
        const card = document.querySelector(`[data-video-id="${randomVideo.id}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.outline    = '2px solid #f59e0b';
            card.style.boxShadow  = '0 0 20px rgba(245,158,11,0.4)';
            setTimeout(() => {
                card.style.outline   = '';
                card.style.boxShadow = '';
            }, 5000);
        }
    }, 200);
}

export function setupInfiniteScroll() {
    if (document.getElementById('scroll-sentinel')) {
        reconnectSentinel();
    } else {
        setTimeout(() => setupInfiniteScroll(), 500);
    }
}

export function toggleViewMode() {
    const current = store.get('viewMode');
    const next = current === 'grid' ? 'list' : 'grid';
    store.set('viewMode', next);
    const btn = document.getElementById('btn-view-toggle');
    if (btn) {
        const lang = store.get('currentLang');
        btn.innerHTML = next === 'list'
            ? `${icon('grid', { size: 15 })} Grid`
            : `${icon('list', { size: 15 })} ${lang === 'tr' ? 'Liste' : 'List'}`;
    }
    applyFiltersAndSearch();
}