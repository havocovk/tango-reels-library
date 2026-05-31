// videoHandlers.js - Optimize edilmiş + Sonsuz Kaydırma + Öğrenme Durumu
import { dbAddFavorite, dbRemoveFavorite, dbDeleteVideo, dbUpdateLearningStatus } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { getFilteredVideos } from './tangoFilters.js';
import { translations } from './i18n.js';
import { store } from './store.js';
import { showToast } from './toast.js';

let currentLang = 'tr';

let applyFiltersAndSearchCallback = null;
let fetchVideosCallback = null;
let openVideoModalCallback = null;
let openTagsEditModalCallback = null;
let startVideoEditFlowCallback = null;
let deleteVideoFlowCallback = null;

let scrollObserver = null;
let isLoadingMore = false;

export function setVideoHandlersGlobalData(lang) {
    currentLang = lang;
}

export function initVideoHandlers(applyCb, fetchCb, openModalCb, openTagsCb, startEditCb, deleteCb) {
    applyFiltersAndSearchCallback = applyCb;
    fetchVideosCallback = fetchCb;
    openVideoModalCallback = openModalCb;
    openTagsEditModalCallback = openTagsCb;
    startVideoEditFlowCallback = startEditCb;
    deleteVideoFlowCallback = deleteCb;
}

// Favori ekleme/çıkarma
export async function toggleFavorite(videoId) {
    try {
        let currentFavorites = store.get('globalFavorites');
        const isFav = currentFavorites.includes(videoId);
        if (isFav) {
            await dbRemoveFavorite(videoId);
            store.updateFavoriteLocally(videoId, false);
        } else {
            await dbAddFavorite(videoId);
            store.updateFavoriteLocally(videoId, true);
        }
        applyFiltersAndSearch();
    } catch (err) {
        console.error(err);
        const lang = translations[store.get('currentLang')];
        showToast(lang.error || 'Favori güncellenemedi', 'error');
    }
}

// 🔥 YENİ: Öğrenme durumu güncelleme (yerel + supabase)
export async function updateLearningStatus(videoId, newStatus) {
    const video = store.get('globalVideos').find(v => v.id === videoId);
    if (!video) return;
    const oldUpdatedAt = video.updated_at;
    try {
        const updatedVideo = await dbUpdateLearningStatus(videoId, newStatus, oldUpdatedAt);
        if (updatedVideo) {
            store.updateVideoLocally(videoId, {
                learning_status: updatedVideo.learning_status,
                last_reviewed_at: updatedVideo.last_reviewed_at,
                review_count: updatedVideo.review_count,
                updated_at: updatedVideo.updated_at
            });
            showToast(`Öğrenme durumu: ${getStatusText(newStatus)}`, 'success');
            applyFiltersAndSearch();
        }
    } catch (err) {
        if (err.message.includes('ÇAKIŞMA')) {
            showToast('Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.', 'error');
            location.reload();
        } else {
            showToast('Durum güncellenemedi: ' + err.message, 'error');
        }
    }
}

function getStatusText(status) {
    const lang = currentLang;
    if (lang === 'tr') {
        if (status === 'new') return 'Yeni';
        if (status === 'learning') return 'Çalışıyorum';
        if (status === 'mastered') return 'Ustalaştım';
    } else {
        if (status === 'new') return 'New';
        if (status === 'learning') return 'Learning';
        if (status === 'mastered') return 'Mastered';
    }
    return status;
}

// Filtreleme ve listeleme
export function applyFiltersAndSearch() {
    const globalVideos = store.get('globalVideos');
    const currentView = store.get('currentView');
    const visibleCount = store.get('visibleCount');
    const favorites = store.get('globalFavorites');
    
    let source = globalVideos;
    if (currentView === 'favorites') {
        source = globalVideos.filter(v => favorites.includes(v.id));
    }
    
    const searchInput = document.getElementById('search-input');
    const aramaMetni = searchInput ? searchInput.value : '';
    
    const filters = {
        aramaMetni: aramaMetni,
        rol: document.getElementById('filter-role-select')?.value || 'all',
        egitmen: document.getElementById('filter-instructor-select')?.value || 'all',
        etiket: document.getElementById('filter-tag-select')?.value || 'all',
        tarih: document.getElementById('filter-date-select')?.value || 'all',
        platform: document.getElementById('filter-platform-select')?.value || 'all',
        learningStatus: document.getElementById('filter-learning-status-select')?.value || 'all'  // 🔥 YENİ
    };
    
    const filtered = getFilteredVideos(source, filters, currentLang);
    const totalElem = document.getElementById('total-video-count');
    if (totalElem) {
        let label = currentView === 'favorites' ? translations[currentLang].favoritesCountLabel : (currentLang === 'tr' ? 'Toplam Video Sayısı:' : 'Total Videos:');
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
        updateLearningStatus   // 🔥 YENİ: Kart içinden çağırmak için
    });
    
    reconnectSentinel();
}

export function setVisibleCount(count) {
    store.set('visibleCount', count);
}

export function incrementVisibleCount(inc) {
    const current = store.get('visibleCount');
    store.set('visibleCount', current + inc);
}

export async function deleteVideoFlow(videoId) {
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okText, cancelText)) return;
    try {
        await dbDeleteVideo(videoId);
        store.removeVideoLocally(videoId);
        if (store.get('globalFavorites').includes(videoId)) {
            store.updateFavoriteLocally(videoId, false);
        }
        await showCustomAlert(lang.successDeleteVideo, okText);
        applyFiltersAndSearch();
    } catch (err) { 
        await showCustomAlert(currentLang === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}

// Infinite Scroll
function reconnectSentinel() {
    if (scrollObserver) {
        scrollObserver.disconnect();
    }
    const sentinel = document.getElementById('scroll-sentinel');
    if (!sentinel) return;
    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoadingMore) {
                const visibleCount = store.get('visibleCount');
                const globalVideos = store.get('globalVideos');
                const currentView = store.get('currentView');
                const favorites = store.get('globalFavorites');
                let source = globalVideos;
                if (currentView === 'favorites') {
                    source = globalVideos.filter(v => favorites.includes(v.id));
                }
                const searchInput = document.getElementById('search-input');
                const aramaMetni = searchInput ? searchInput.value : '';
                const filters = {
                    aramaMetni: aramaMetni,
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
                    incrementVisibleCount(20);
                    applyFiltersAndSearch();
                    setTimeout(() => { isLoadingMore = false; }, 500);
                }
            }
        });
    }, { threshold: 0.1 });
    scrollObserver.observe(sentinel);
}

export function setupInfiniteScroll() {
    if (document.getElementById('scroll-sentinel')) {
        reconnectSentinel();
    } else {
        setTimeout(() => setupInfiniteScroll(), 500);
    }
}