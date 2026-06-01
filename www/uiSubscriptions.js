// uiSubscriptions.js - Store değişikliklerine tepki veren UI güncellemeleri
// ✅ GÜNCELLEME (Adım 2.2): dueTodayCount aboneliği eklendi.
//    Store'daki sayı değişince sol menüdeki "Pratik Listem" butonu
//    üzerindeki badge otomatik güncellenir.
import { store } from './store.js';
import { applyFiltersAndSearch, setVideoHandlersGlobalData } from './videoHandlers.js';
import { setInstructorHandlersGlobalData } from './instructorHandlers.js';
import { setFormHandlersGlobalData, formTagsArray } from './formHandlers.js';
import { initTagManager } from './tagManager.js';
import { renderStatsPanel, renderTagManagerUI, fetchVideos } from './dataManager.js';
import { callUpdateInterfaceLanguage } from './navigation.js';

let subscriptions = [];

// ─────────────────────────────────────────────────────────────
// updateDueBadge(count)
// Sol menüdeki "Pratik Listem" butonundaki badge'i günceller.
// count > 0 ise kırmızı sayı badge'i gösterir, 0 ise gizler.
// ─────────────────────────────────────────────────────────────
function updateDueBadge(count) {
    const btn = document.getElementById('menu-favorites');
    if (!btn) return;

    // Varsa eski badge'i kaldır
    const existing = btn.querySelector('.due-badge');
    if (existing) existing.remove();

    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'due-badge';
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            padding: 0 5px;
            margin-left: 6px;
            background: #ff007f;
            color: #fff;
            font-size: 0.7rem;
            font-weight: 700;
            border-radius: 10px;
            line-height: 1;
            box-shadow: 0 0 8px rgba(255, 0, 127, 0.5);
            vertical-align: middle;
        `;
        btn.appendChild(badge);
    }
}

export function setupStoreSubscriptions() {

    // 1. currentLang değişince
    subscriptions.push(
        store.subscribe('currentLang', (newLang, oldLang) => {
            console.log(`Language changed: ${oldLang} -> ${newLang}`);
            callUpdateInterfaceLanguage();
            if (store.get('currentView') === 'stats') renderStatsPanel();
            if (store.get('currentView') === 'tagManager') renderTagManagerUI();
            setVideoHandlersGlobalData(newLang);
            setInstructorHandlersGlobalData(newLang);
            setFormHandlersGlobalData(newLang, formTagsArray, store.get('globalVideos'));
            initTagManager(newLang, store.get('globalVideos'), fetchVideos, renderTagManagerUI);
            applyFiltersAndSearch();
        })
    );

    // 2. globalVideos değişince
    subscriptions.push(
        store.subscribe('globalVideos', (newVideos, oldVideos) => {
            console.log(`Videos updated: ${oldVideos?.length || 0} -> ${newVideos.length}`);
            setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, newVideos);
            initTagManager(store.get('currentLang'), newVideos, fetchVideos, renderTagManagerUI);
            applyFiltersAndSearch();
            if (store.get('currentView') === 'stats') renderStatsPanel();
            if (store.get('currentView') === 'tagManager') renderTagManagerUI();
        })
    );

    // 3. globalFavorites değişince
    subscriptions.push(
        store.subscribe('globalFavorites', (newFavs, oldFavs) => {
            console.log(`Favorites updated: ${oldFavs?.length || 0} -> ${newFavs.length}`);
            applyFiltersAndSearch();
        })
    );

    // 4. currentView değişince
    subscriptions.push(
        store.subscribe('currentView', (newView, oldView) => {
            console.log(`View changed: ${oldView} -> ${newView}`);
            applyFiltersAndSearch();
            if (newView === 'stats') renderStatsPanel();
            if (newView === 'tagManager') renderTagManagerUI();
        })
    );

    // 5. visibleCount değişince
    subscriptions.push(
        store.subscribe('visibleCount', (newCount, oldCount) => {
            console.log(`Visible count changed: ${oldCount} -> ${newCount}`);
            applyFiltersAndSearch();
        })
    );

    // 6. globalInstructors değişince
    subscriptions.push(
        store.subscribe('globalInstructors', (newIns, oldIns) => {
            console.log(`Instructors updated: ${oldIns?.length || 0} -> ${newIns.length}`);
        })
    );

    // ✅ 7. YENİ (Adım 2.2): dueTodayCount değişince badge güncellenir
    subscriptions.push(
        store.subscribe('dueTodayCount', (newCount) => {
            console.log(`Due today count updated: ${newCount}`);
            updateDueBadge(newCount);
        })
    );
}

export function cleanupSubscriptions() {
    subscriptions.forEach(unsubscribe => unsubscribe());
    subscriptions = [];
}