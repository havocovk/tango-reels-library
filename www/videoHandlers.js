import { dbAddFavorite, dbRemoveFavorite, dbDeleteVideo } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { renderVideoCards } from './uiRenderer.js';
import { getFilteredVideos } from './tangoFilters.js';
import { translations } from './config.js';

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = [];
let currentView = 'library';
let visibleCount = 20;

// Bu fonksiyonları dışarıdan set edeceğiz
let applyFiltersAndSearchCallback = null;
let fetchVideosCallback = null;
let openVideoModalCallback = null;
let openTagsEditModalCallback = null;
let startVideoEditFlowCallback = null;
let deleteVideoFlowCallback = null;

export function initVideoHandlers(lang, videos, favorites, view, visible, callbacks) {
    currentLang = lang;
    globalVideos = videos;
    globalFavorites = favorites;
    currentView = view;
    visibleCount = visible;
    applyFiltersAndSearchCallback = callbacks.applyFiltersAndSearch;
    fetchVideosCallback = callbacks.fetchVideos;
    openVideoModalCallback = callbacks.openVideoModal;
    openTagsEditModalCallback = callbacks.openTagsEditModal;
    startVideoEditFlowCallback = callbacks.startVideoEditFlow;
    deleteVideoFlowCallback = callbacks.deleteVideoFlow;
}

export function setVideoHandlersLanguage(lang) {
    currentLang = lang;
}

export async function toggleFavorite(videoId) {
    try {
        if (globalFavorites.includes(videoId)) {
            await dbRemoveFavorite(videoId);
            globalFavorites = globalFavorites.filter(id => id !== videoId);
        } else {
            await dbAddFavorite(videoId);
            globalFavorites.push(videoId);
        }
        if (applyFiltersAndSearchCallback) applyFiltersAndSearchCallback();
    } catch (err) { console.error(err); }
}

export function applyFiltersAndSearch() {
    let source = globalVideos;
    if (currentView === 'favorites') source = globalVideos.filter(v => globalFavorites.includes(v.id));
    const filters = {
        aramaMetni: '',
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
        currentLang, currentView, translations, favs: globalFavorites, toggleFavorite,
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
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okText, cancelText)) return;
    try {
        await dbDeleteVideo(videoId);
        await showCustomAlert(lang.successDeleteVideo, okText);
        globalFavorites = globalFavorites.filter(id => id !== videoId);
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) { 
        await showCustomAlert(currentLang === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}