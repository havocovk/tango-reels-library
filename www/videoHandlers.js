// videoHandlers.js - Optimize edilmiş (yerel güncelleme)
import { dbAddFavorite, dbRemoveFavorite, dbDeleteVideo } from './tangoVeritabani.js';
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
        // Sadece UI'ı yenile (fetchVideos yok)
        applyFiltersAndSearch();
    } catch (err) {
        console.error(err);
        const lang = translations[store.get('currentLang')];
        showToast(lang.error || 'Favori güncellenemedi', 'error');
    }
}

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
        platform: document.getElementById('filter-platform-select')?.value || 'all'
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
        refreshList: applyFiltersAndSearchCallback
    });
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
        // Yerel state'den kaldır
        store.removeVideoLocally(videoId);
        // Favorilerden de kaldır
        if (store.get('globalFavorites').includes(videoId)) {
            store.updateFavoriteLocally(videoId, false);
        }
        await showCustomAlert(lang.successDeleteVideo, okText);
        applyFiltersAndSearch();
    } catch (err) { 
        await showCustomAlert(currentLang === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}