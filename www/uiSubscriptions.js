// uiSubscriptions.js - Store değişikliklerine tepki veren UI güncellemeleri
// ✅ GÜNCELLEME (Adım 2.2): dueTodayCount aboneliği
// ✅ GÜNCELLEME (Adım 2.4): activePlaylistId ve activePlaylistVideoIds abonelikleri
import { store } from './store.js';
import { applyFiltersAndSearch, setVideoHandlersGlobalData } from './videoHandlers.js';
import { setInstructorHandlersGlobalData } from './instructorHandlers.js';
import { setFormHandlersGlobalData, formTagsArray } from './formHandlers.js';
import { initTagManager } from './tagManager.js';
import { renderStatsPanel, renderTagManagerUI, fetchVideos } from './dataManager.js';
import { callUpdateInterfaceLanguage } from './navigation.js';
import { renderPlaylistsInSidebar } from './playlistManager.js';

let subscriptions = [];

function updateDueBadge(count) {
    const btn = document.getElementById('menu-favorites');
    if (!btn) return;
    const existing = btn.querySelector('.due-badge');
    if (existing) existing.remove();
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'due-badge';
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.cssText = `
            display:inline-flex;align-items:center;justify-content:center;
            min-width:20px;height:20px;padding:0 5px;margin-left:6px;
            background:#ff007f;color:#fff;font-size:0.7rem;font-weight:700;
            border-radius:10px;line-height:1;
            box-shadow:0 0 8px rgba(255,0,127,0.5);vertical-align:middle;
        `;
        btn.appendChild(badge);
    }
}

export function setupStoreSubscriptions() {

    subscriptions.push(store.subscribe('currentLang', (newLang) => {
        callUpdateInterfaceLanguage();
        if (store.get('currentView') === 'stats') renderStatsPanel();
        if (store.get('currentView') === 'tagManager') renderTagManagerUI();
        setVideoHandlersGlobalData(newLang);
        setInstructorHandlersGlobalData(newLang);
        setFormHandlersGlobalData(newLang, formTagsArray, store.get('globalVideos'));
        initTagManager(newLang, store.get('globalVideos'), fetchVideos, renderTagManagerUI);
        renderPlaylistsInSidebar();
        applyFiltersAndSearch();
    }));

    subscriptions.push(store.subscribe('globalVideos', (newVideos) => {
        setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, newVideos);
        initTagManager(store.get('currentLang'), newVideos, fetchVideos, renderTagManagerUI);
        applyFiltersAndSearch();
        if (store.get('currentView') === 'stats') renderStatsPanel();
        if (store.get('currentView') === 'tagManager') renderTagManagerUI();
    }));

    subscriptions.push(store.subscribe('globalFavorites', () => {
        applyFiltersAndSearch();
    }));

    subscriptions.push(store.subscribe('currentView', (newView) => {
        applyFiltersAndSearch();
        if (newView === 'stats') renderStatsPanel();
        if (newView === 'tagManager') renderTagManagerUI();
    }));

    subscriptions.push(store.subscribe('visibleCount', () => {
        applyFiltersAndSearch();
    }));

    subscriptions.push(store.subscribe('globalInstructors', () => {}));

    subscriptions.push(store.subscribe('dueTodayCount', (newCount) => {
        updateDueBadge(newCount);
    }));

    subscriptions.push(store.subscribe('globalPlaylists', () => {
        renderPlaylistsInSidebar();
    }));

    subscriptions.push(store.subscribe('activePlaylistVideoIds', () => {
        applyFiltersAndSearch();
    }));
}

export function cleanupSubscriptions() {
    subscriptions.forEach(u => u());
    subscriptions = [];
}
