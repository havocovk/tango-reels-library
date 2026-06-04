// dataManager.js - Veri çekme, istatistik ve tag manager UI
// ✅ GÜNCELLEME (Adım 2.2): fetchVideos artık getDueTodayCount çağırır
// ✅ GÜNCELLEME (Adım 2.2): IndexedDB offline önbellek eklendi
// ✅ GÜNCELLEME (Adım 3.3): renderTagManagerUI tagManager.js'e taşındı
// ✅ GÜNCELLEME (Adım 3.3 v2): ensureAllTagsHaveColors çağrısı eklendi
import { translations } from './i18n.js';
import { dbFetchInstructors, dbFetchVideos, dbFetchVideosPage, dbFetchFavorites } from './tangoVeritabani.js';
import { populateFilterDropdowns } from './tangoFilters.js';
import { computeStats, renderStats } from './tangoStats.js';
import { updateSmartFilenameAssistant } from './tangoUI.js';
import {
    initTagManager,
    updateTagManagerSelection,
    renderTagManagerUI
} from './tagManager.js';
import { setVideoHandlersGlobalData } from './videoHandlers.js';
import { setInstructorHandlersGlobalData } from './instructorHandlers.js';
import { setFormHandlersGlobalData, formTagsArray } from './formHandlers.js';
import { exportToJSON, importFromJSON, setBackupLang } from './backup.js';
import { store } from './store.js';
import { getDueTodayCount } from './learning/spacedRepetition.js';
import { ensureAllTagsHaveColors } from './tagColorManager.js';
import { renderLearningPathCard } from './learningPathAdvisor.js'; // ✅ ADIM 4.3
import {
    initOfflineCache,
    cacheVideos,
    cacheInstructors,
    getCachedVideos,
    getCachedInstructors
} from './offlineCache.js';

// Önbelleği uygulama başlarken başlat
initOfflineCache().catch(() => {});

export async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
        store.set('globalInstructors', instructors);

        // ✅ ADIM 2.2: Başarılı çekimi önbelleğe yaz
        cacheInstructors(instructors).catch(() => {});

        const select = document.getElementById('form-instructor-select');
        if (select) {
            select.innerHTML = '';
            instructors.forEach(ins => {
                const opt = document.createElement('option');
                opt.value = ins.id;
                opt.innerText = ins.name;
                select.appendChild(opt);
            });
        }
        updateSmartFilenameAssistant(store.get('currentLang'), formTagsArray);
    } catch (err) {
        console.error(err);

        // ✅ ADIM 2.2: Ağ hatası → önbellekten eğitmenleri yükle
        const cached = await getCachedInstructors();
        if (cached) {
            store.set('globalInstructors', cached);
            const select = document.getElementById('form-instructor-select');
            if (select) {
                select.innerHTML = '';
                cached.forEach(ins => {
                    const opt = document.createElement('option');
                    opt.value = ins.id;
                    opt.innerText = ins.name;
                    select.appendChild(opt);
                });
            }
        }
    }
}

export async function fetchVideos() {
    try {
        const instructors = await dbFetchInstructors();
        store.set('globalInstructors', instructors);
        cacheInstructors(instructors).catch(() => {});

        const favRows = await dbFetchFavorites().catch(() => []);
        store.set('globalFavorites', favRows.map(f => f.video_id));

        const enrich = (arr) => arr.map(video => ({
            ...video,
            instructor_name: instructors.find(ins => ins.id === video.instructor_id)?.name || 'Bilinmeyen Eğitmen'
        }));

        const PAGE_SIZE = 100;
        let allVideos = [];

        try {
            const first = await dbFetchVideosPage(0, PAGE_SIZE);
            store.set('totalVideoCount', first.totalCount);
            store.set('currentPage', 0);
            allVideos = enrich(first.videos);
            store.set('globalVideos', [...allVideos]);

            let page = 1;
            let lastPageSize = first.videos.length;
            while (lastPageSize === PAGE_SIZE) {
                const next = await dbFetchVideosPage(page, PAGE_SIZE);
                lastPageSize = next.videos.length;
                if (lastPageSize === 0) break;
                allVideos = allVideos.concat(enrich(next.videos));
                store.set('currentPage', page);
                store.set('globalVideos', [...allVideos]);
                if (allVideos.length > (store.get('totalVideoCount') || 0)) {
                    store.set('totalVideoCount', allVideos.length);
                }
                page++;
            }
        } catch (pageErr) {
            console.warn('Sayfalı yükleme başarısız oldu, tam yüklemeye geçiliyor:', pageErr);
            const rawVideos = await dbFetchVideos();
            allVideos = enrich(rawVideos);
            store.set('totalVideoCount', allVideos.length);
            store.set('globalVideos', [...allVideos]);
        }

        // ✅ ADIM 2.2: Başarılı çekimi IndexedDB'e yaz (arka planda)
        cacheVideos(allVideos).catch(() => {});

        const finalVideos = store.get('globalVideos');

        const count = getDueTodayCount(finalVideos);
        store.set('dueTodayCount', count);

        ensureAllTagsHaveColors(finalVideos);

        populateFilterDropdowns(finalVideos, store.get('currentLang'));
        setVideoHandlersGlobalData(store.get('currentLang'), store.get('currentView'), store.get('visibleCount'));
        setInstructorHandlersGlobalData(store.get('currentLang'));
        setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, finalVideos);
        initTagManager(store.get('currentLang'), finalVideos, fetchVideos, renderTagManagerUI);

        if (store.get('currentView') === 'stats') renderStatsPanel();
        if (store.get('currentView') === 'tagManager') renderTagManagerUI();

    } catch (err) {
        console.error('fetchVideos hatası:', err);

        // ✅ ADIM 2.2: Ağ hatası → önbellekten yükle
        const cachedVideos = await getCachedVideos();
        const cachedInstructors = await getCachedInstructors();

        if (cachedVideos) {
            const instructors = cachedInstructors || store.get('globalInstructors') || [];
            const enriched = cachedVideos.map(video => ({
                ...video,
                instructor_name: instructors.find(ins => ins.id === video.instructor_id)?.name || 'Bilinmeyen Eğitmen'
            }));

            store.set('globalVideos', enriched);
            store.set('globalInstructors', instructors);

            const count = getDueTodayCount(enriched);
            store.set('dueTodayCount', count);

            populateFilterDropdowns(enriched, store.get('currentLang'));
            setVideoHandlersGlobalData(store.get('currentLang'), store.get('currentView'), store.get('visibleCount'));
            setInstructorHandlersGlobalData(store.get('currentLang'));
            setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, enriched);
            initTagManager(store.get('currentLang'), enriched, fetchVideos, renderTagManagerUI);

            if (store.get('currentView') === 'stats') renderStatsPanel();
            if (store.get('currentView') === 'tagManager') renderTagManagerUI();

            // Kullanıcıya offline modda olduğunu bildir
            import('./toast.js').then(({ showToast }) => {
                showToast('📴 Çevrimdışı mod — son kayıtlı veri gösteriliyor', 'info', 5000);
            });
        } else {
            const grid = document.getElementById('video-grid');
            if (grid) grid.innerHTML = `<div class="info-msg" style="color:#ef4444;">${translations[store.get('currentLang')].error || 'Bağlantı hatası'}</div>`;
        }
    }
}

export function renderStatsPanel() {
    if (store.get('currentView') !== 'stats') return;
    const stats = computeStats(store.get('globalVideos'), store.get('globalInstructors'));
    renderStats(stats, store.get('currentLang'));
    setupBackupButtons();
    // ✅ ADIM 4.3: Öğrenme yolu önerisi kartını render et
    renderLearningPathCard(store.get('globalVideos'), store.get('currentLang'));
}

function setupBackupButtons() {
    const exportBtn = document.getElementById('btn-export-backup');
    const importBtn = document.getElementById('btn-import-backup');
    if (!exportBtn || !importBtn) return;
    if (exportBtn.dataset.wired === 'true') return;
    exportBtn.dataset.wired = 'true';
    importBtn.dataset.wired = 'true';
    exportBtn.onclick = () => {
        exportToJSON(
            store.get('globalVideos'),
            store.get('globalInstructors'),
            store.get('globalFavorites')
        );
    };
    importBtn.onclick = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await importFromJSON(
                    file,
                    store.get('globalVideos'),
                    store.get('globalInstructors'),
                    store.get('globalFavorites'),
                    fetchVideos,
                    fetchInstructors
                );
            } catch (err) { console.error(err); }
        };
        fileInput.click();
    };
}

export { renderTagManagerUI };

export function updateAllLanguages() {
    const currentLang = store.get('currentLang');
    import('./utils.js').then(utils => utils.setCurrentLangForUtils(currentLang));
    setBackupLang(currentLang);
    setVideoHandlersGlobalData(currentLang, store.get('currentView'), store.get('visibleCount'));
    setInstructorHandlersGlobalData(currentLang);
    setFormHandlersGlobalData(currentLang, formTagsArray, store.get('globalVideos'));
    initTagManager(currentLang, store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    import('./formHandlers.js').then(fh => fh.setEditingVideoUpdatedAt(null));
}