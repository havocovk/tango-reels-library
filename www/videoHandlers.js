// www/videoHandlers.js
import { dbAddFavorite, dbRemoveFavorite, dbDeleteVideo } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { getFilteredVideos } from './tangoFilters.js';
import { translations } from './config.js';
import { store } from './store.js';

let applyFiltersAndSearchCallback = null;
let fetchVideosCallback = null;
let openVideoModalCallback = null;
let openTagsEditModalCallback = null;
let startVideoEditFlowCallback = null;
let deleteVideoFlowCallback = null;

export function setVideoHandlersGlobalData(lang, videos, favorites, view, visible) {
    // Artık store kullanıldığı için bu fonksiyon boş olabilir veya kaldırılabilir.
    // Ancak eski kodlarla uyum için doldurmuyoruz, store'dan okuyacağız.
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
            currentFavorites = currentFavorites.filter(id => id !== videoId);
        } else {
            await dbAddFavorite(videoId);
            currentFavorites = [...currentFavorites, videoId];
        }
        store.set('globalFavorites', currentFavorites);
        if (applyFiltersAndSearchCallback) applyFiltersAndSearchCallback();
    } catch (err) { console.error(err); }
}

export function applyFiltersAndSearch() {
    const videos = store.get('globalVideos');
    const favorites = store.get('globalFavorites');
    const view = store.get('currentView');
    const lang = store.get('currentLang');
    const visibleCount = store.get('visibleCount');
    
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
    store.set('visibleCount', count);
}

export function incrementVisibleCount(inc) {
    const newCount = store.get('visibleCount') + inc;
    store.set('visibleCount', newCount);
}

export async function deleteVideoFlow(videoId) {
    const lang = translations[store.get('currentLang')];
    const okText = store.get('currentLang') === 'tr' ? 'Tamam' : 'OK';
    const cancelText = store.get('currentLang') === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okText, cancelText)) return;
    try {
        await dbDeleteVideo(videoId);
        await showCustomAlert(lang.successDeleteVideo, okText);
        let favs = store.get('globalFavorites');
        if (favs.includes(videoId)) {
            favs = favs.filter(id => id !== videoId);
            store.set('globalFavorites', favs);
        }
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { 
        await showCustomAlert(store.get('currentLang') === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}