// dataManager.js - Veri çekme, istatistik ve tag manager UI
// ✅ GÜNCELLEME (Adım 2.2): fetchVideos artık getDueTodayCount çağırır
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
        const favRows = await dbFetchFavorites().catch(() => []);
        store.set('globalFavorites', favRows.map(f => f.video_id));

        // Eğitmen adını her videoya ekleyen yardımcı (kartlarda "Bilinmeyen" yazmaması için)
        const enrich = (arr) => arr.map(video => ({
            ...video,
            instructor_name: instructors.find(ins => ins.id === video.instructor_id)?.name || 'Bilinmeyen Eğitmen'
        }));

        // ✅ Adım 4.3: Sayfa sayfa (paginated) yükleme.
        // Büyük koleksiyonlarda tek dev istek yerine küçük sayfalar çekilir.
        // ÖNEMLİ: Tüm sayfalar birleştirilerek bellekte tam liste oluşturulur;
        // böylece arama, filtreleme, istatistikler vb. istemci tarafında
        // aynen çalışmaya devam eder (yol haritası notu gereği).
        const PAGE_SIZE = 100;
        let allVideos = [];

        try {
            // İlk sayfa
            const first = await dbFetchVideosPage(0, PAGE_SIZE);
            store.set('totalVideoCount', first.totalCount);
            store.set('currentPage', 0);
            allVideos = enrich(first.videos);
            store.set('globalVideos', [...allVideos]);

            // Kalan sayfaları çek. Sayıma (count) GÜVENMİYORUZ:
            // bir sayfa PAGE_SIZE'dan az kayıt döndürürse son sayfadır → dur.
            // Bu, count=exact çalışmasa bile tüm videoların yüklenmesini garanti eder.
            let page = 1;
            let lastPageSize = first.videos.length;
            while (lastPageSize === PAGE_SIZE) {
                const next = await dbFetchVideosPage(page, PAGE_SIZE);
                lastPageSize = next.videos.length;
                if (lastPageSize === 0) break;
                allVideos = allVideos.concat(enrich(next.videos));
                store.set('currentPage', page);
                store.set('globalVideos', [...allVideos]);
                // totalCount güncel değilse, çekilen kadarını yansıt
                if (allVideos.length > (store.get('totalVideoCount') || 0)) {
                    store.set('totalVideoCount', allVideos.length);
                }
                page++;
            }
        } catch (pageErr) {
            // ── Güvenlik ağı: sayfalı çekme başarısız olursa hepsini birden çek ──
            // (Range header'ı bir nedenle çalışmazsa uygulama eskisi gibi yüklenir.)
            console.warn('Sayfalı yükleme başarısız oldu, tam yüklemeye geçiliyor:', pageErr);
            const rawVideos = await dbFetchVideos();
            allVideos = enrich(rawVideos);
            store.set('totalVideoCount', allVideos.length);
            store.set('globalVideos', [...allVideos]);
        }

        // ── Tüm veri hazır: pahalı hesaplamalar yalnızca bir kez ──
        const finalVideos = store.get('globalVideos');

        // Adım 2.2: Bugün tekrar edilmesi gereken video sayısı
        const count = getDueTodayCount(finalVideos);
        store.set('dueTodayCount', count);

        // ✅ Adım 3.3 v2: Tüm etiketlerin rengi olduğunu garanti et
        ensureAllTagsHaveColors(finalVideos); // await yok — arka planda çalışır

        populateFilterDropdowns(finalVideos, store.get('currentLang'));

        setVideoHandlersGlobalData(store.get('currentLang'), store.get('currentView'), store.get('visibleCount'));
        setInstructorHandlersGlobalData(store.get('currentLang'));
        setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, finalVideos);
        initTagManager(store.get('currentLang'), finalVideos, fetchVideos, renderTagManagerUI);

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