// www/videoHandlers.js
import { dbAddFavorite, dbRemoveFavorite, dbDeleteVideo } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { getFilteredVideos } from './tangoFilters.js';
import { translations } from './config.js';
import { store } from './store.js';  // ★ YENİ

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = [];
let currentView = 'library';
let visibleCount = 20;

let applyFiltersAndSearchCallback = null;
let fetchVideosCallback = null;
let openVideoModalCallback = null;
let openTagsEditModalCallback = null;
let startVideoEditFlowCallback = null;
let deleteVideoFlowCallback = null;

// ★ Bu fonksiyon artık store'dan veri alabilir, ama mevcut kodla uyum için parametreleri koruyoruz
export function setVideoHandlersGlobalData(lang, videos, favorites, view, visible) {
    currentLang = lang;
    globalVideos = videos;
    globalFavorites = favorites;
    currentView = view;
    visibleCount = visible;
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
        if (currentFavorites.includes(videoId)) {
            await dbRemoveFavorite(videoId);
            const newFavorites = currentFavorites.filter(id => id !== videoId);
            store.set('globalFavorites', newFavorites);
        } else {
            await dbAddFavorite(videoId);
            const newFavorites = [...currentFavorites, videoId];
            store.set('globalFavorites', newFavorites);
        }
        if (applyFiltersAndSearchCallback) applyFiltersAndSearchCallback();
    } catch (err) { console.error(err); }
}

export function applyFiltersAndSearch() {
    // ★ Artık store'dan güncel verileri al
    const videos = store.get('globalVideos');
    const favorites = store.get('globalFavorites');
    const view = store.get('currentView');
    const lang = store.get('currentLang');
    
    let source = videos;
    if (view === 'favorites') {
        source = videos.filter(v => favorites.includes(v.id));
    }
    const filters = {
        aramaMetni: '',
        rol: document.getElementById('filter-role-select')?.value || 'all',
        egitmen: document.getElementById('filter-instructor-select')?.value || 'all',
        etiket: document.getElementById('filter-tag-select')?.value || 'all',
        tarih: document.getElementById('filter-date-select')?.value || 'all',
        platform: document.getElementById('filter-platform-select')?.value || 'all'
    };
    const filtered = getFilteredVideos(source, filters, lang);
    const totalElem = document.getElementById('total-video-count');
    if (totalElem) {
        let label = view === 'favorites' ? translations[lang].favoritesCountLabel : (lang === 'tr' ? 'Toplam Video Sayısı:' : 'Total Videos:');
        totalElem.innerText = `${label} ${filtered.length}`;
    }
    const loadMoreDiv = document.getElementById('load-more-container');
    if (loadMoreDiv) {
        if (filtered.length > visibleCount) loadMoreDiv.classList.remove('d-none');
        else loadMoreDiv.classList.add('d-none');
    }
    renderVideoCards(filtered.slice(0, visibleCount), {
        currentLang: lang,
        currentView: view,
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
    visibleCount = count;
}

export function incrementVisibleCount(inc) {
    visibleCount += inc;
}

export async function deleteVideoFlow(videoId) {
    const lang = translations[store.get('currentLang')];
    const okText = store.get('currentLang') === 'tr' ? 'Tamam' : 'OK';
    const cancelText = store.get('currentLang') === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okText, cancelText)) return;
    try {
        await dbDeleteVideo(videoId);
        await showCustomAlert(lang.successDeleteVideo, okText);
        // ★ Store'daki favorileri güncelle
        const newFavorites = store.get('globalFavorites').filter(id => id !== videoId);
        store.set('globalFavorites', newFavorites);
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { 
        await showCustomAlert(store.get('currentLang') === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}