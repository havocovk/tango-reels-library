// dataManager.js - Veri çekme, istatistik ve tag manager UI
// ✅ GÜNCELLEME (Adım 2.2): fetchVideos artık getDueTodayCount çağırır
// ✅ GÜNCELLEME (Adım 3.3): renderTagManagerUI tagManager.js'e taşındı
// ✅ GÜNCELLEME (Adım 3.3 v2): ensureAllTagsHaveColors çağrısı eklendi
import { translations } from './i18n.js';
import { dbFetchInstructors, dbFetchVideos, dbFetchFavorites } from './tangoVeritabani.js';
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
import { ensureAllTagsHaveColors } from './tagColorManager.js'; // ✅ YENİ

export async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
        store.set('globalInstructors', instructors);
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
    } catch (err) { console.error(err); }
}

export async function fetchVideos() {
    try {
        const instructors = await dbFetchInstructors();
        store.set('globalInstructors', instructors);
        const rawVideos = await dbFetchVideos();
        const favRows = await dbFetchFavorites().catch(() => []);
        store.set('globalFavorites', favRows.map(f => f.video_id));

        const videos = rawVideos.map(video => ({
            ...video,
            instructor_name: instructors.find(ins => ins.id === video.instructor_id)?.name || 'Bilinmeyen Eğitmen'
        }));
        store.set('globalVideos', videos);

        // Adım 2.2: Bugün tekrar edilmesi gereken video sayısı
        const count = getDueTodayCount(videos);
        store.set('dueTodayCount', count);

        // ✅ Adım 3.3 v2: Tüm etiketlerin rengi olduğunu garanti et
        // loadTagColors() zaten app.js'de çalıştı; bu fonksiyon sadece
        // renksiz kalan etiketleri bulup otomatik renk atar.
        ensureAllTagsHaveColors(videos); // await yok — arka planda çalışır

        populateFilterDropdowns(videos, store.get('currentLang'));

        setVideoHandlersGlobalData(store.get('currentLang'), store.get('currentView'), store.get('visibleCount'));
        setInstructorHandlersGlobalData(store.get('currentLang'));
        setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, videos);
        initTagManager(store.get('currentLang'), videos, fetchVideos, renderTagManagerUI);

        if (store.get('currentView') === 'stats') renderStatsPanel();
        if (store.get('currentView') === 'tagManager') renderTagManagerUI();
    } catch (err) {
        const grid = document.getElementById('video-grid');
        if (grid) grid.innerHTML = `<div class="info-msg" style="color:#ef4444;">${translations[store.get('currentLang')].error}</div>`;
        console.error(err);
    }
}

export function renderStatsPanel() {
    if (store.get('currentView') !== 'stats') return;
    const stats = computeStats(store.get('globalVideos'), store.get('globalInstructors'));
    renderStats(stats, store.get('currentLang'));
    setupBackupButtons();
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