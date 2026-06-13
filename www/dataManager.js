// dataManager.js - Veri çekme, istatistik ve tag manager UI
// ✅ GÜNCELLEME (Adım 2.2): fetchVideos artık getDueTodayCount çağırır
// ✅ GÜNCELLEME (Adım 2.2): IndexedDB offline önbellek eklendi
// ✅ GÜNCELLEME (Adım 3.3): renderTagManagerUI tagManager.js'e taşındı
// ✅ GÜNCELLEME (Adım 3.3 v2): ensureAllTagsHaveColors çağrısı eklendi
// ✅ GÜNCELLEME (Backup v2.0): setupBackupButtons içinde exportToJSON async oldu
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
import { getDueTodayCount, getDueVideos } from './learning/spacedRepetition.js';
import { ensureAllTagsHaveColors } from './tagColorManager.js';
import { renderLearningPathCard } from './learningPathAdvisor.js';
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

        // Başarılı çekimi önbelleğe yaz
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
        console.error('fetchInstructors hatası:', err);

        // Ağ hatası → önbellekten eğitmenleri yükle
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

        // Başarılı çekimi IndexedDB'e yaz (arka planda)
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

        // Ağ hatası → önbellekten yükle
        const cachedVideos     = await getCachedVideos();
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

            import('./toast.js').then(({ showToast }) => {
                showToast('📴 Çevrimdışı mod — son kayıtlı veri gösteriliyor', 'info', 5000);
            });
        } else {
            const grid = document.getElementById('video-grid');
            if (grid) grid.innerHTML = `<div class="info-msg" style="color:#ef4444;">${translations[store.get('currentLang')]?.error || 'Bağlantı hatası'}</div>`;
        }
    }
}

export function renderStatsPanel() {
    if (store.get('currentView') !== 'stats') return;
    const stats = computeStats(store.get('globalVideos'), store.get('globalInstructors'));
    renderStats(stats, store.get('currentLang'));
    setupBackupButtons();
    // Öğrenme yolu önerisi kartını render et
    renderLearningPathCard(store.get('globalVideos'), store.get('currentLang'));
}

function setupBackupButtons() {
    const exportBtn = document.getElementById('btn-export-backup');
    const importBtn = document.getElementById('btn-import-backup');
    if (!exportBtn || !importBtn) return;
    if (exportBtn.dataset.wired === 'true') return;
    exportBtn.dataset.wired = 'true';
    importBtn.dataset.wired = 'true';

    // ✅ GÜNCELLEME (Backup v2.0): exportToJSON artık async,
    //    await ile çağrılmadan da çalışır ama hataları yakalamak için
    //    async onclick kullanılır.
    exportBtn.onclick = async () => {
        await exportToJSON(
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
            } catch (err) {
                console.error('İçe aktarma beklenmeyen hata:', err);
            }
        };
        fileInput.click();
    };
}

export { renderTagManagerUI };

// ─────────────────────────────────────────────────────────────
// renderDashboard — Adim 4.1
// Dashboard view'ını güncel verilerle doldurur.
// ─────────────────────────────────────────────────────────────
export function renderDashboard() {
    const videos      = store.get('globalVideos') || [];
    const lang        = store.get('currentLang');
    const t           = lang === 'tr';

    // ── Başlık ────────────────────────────────────────────────
    const titleEl    = document.getElementById('dash-title');
    const subtitleEl = document.getElementById('dash-subtitle');
    if (titleEl)    titleEl.textContent    = t ? '📊 Genel Bakış' : '📊 Overview';
    if (subtitleEl) subtitleEl.textContent = t ? 'Tango arşivinin özeti' : 'Summary of your tango archive';

    // ── Bugün tekrar edilecek ──────────────────────────────────
    const dueVideos = getDueVideos(videos);
    const dueEl     = document.getElementById('dash-due-count');
    const dueLblEl  = document.getElementById('dash-due-label');
    if (dueEl)    dueEl.textContent    = dueVideos.length;
    if (dueLblEl) dueLblEl.textContent = t ? 'Bugün Tekrar' : 'Due Today';

    const practiceBtnEl   = document.getElementById('dash-start-practice');
    const practiceBtnText = document.getElementById('dash-practice-btn-text');
    if (practiceBtnText) practiceBtnText.textContent = t ? 'Pratik Başlat' : 'Start Practice';
    if (practiceBtnEl) {
        practiceBtnEl.onclick = () => {
            import('./practiceSession.js').then(({ startPracticeSession }) => {
                startPracticeSession();
            });
        };
        practiceBtnEl.style.display = dueVideos.length > 0 ? 'flex' : 'none';
    }

    // ── Öğreniliyor ───────────────────────────────────────────
    const learningCount = videos.filter(v => v.learning_status === 'learning').length;
    const newCount      = videos.filter(v => !v.learning_status || v.learning_status === 'new').length;
    const learningEl    = document.getElementById('dash-learning-count');
    const learningLbl   = document.getElementById('dash-learning-label');
    if (learningEl)  learningEl.textContent  = learningCount + newCount;
    if (learningLbl) learningLbl.textContent = t ? 'Öğreniliyor' : 'In Progress';

    // ── Ustalaşıldı ───────────────────────────────────────────
    const masteredCount = videos.filter(v => v.learning_status === 'mastered').length;
    const masteredEl    = document.getElementById('dash-mastered-count');
    const masteredLbl   = document.getElementById('dash-mastered-label');
    if (masteredEl)  masteredEl.textContent  = masteredCount;
    if (masteredLbl) masteredLbl.textContent = t ? 'Ustalaşıldı' : 'Mastered';

    // ── Toplam video ──────────────────────────────────────────
    const totalEl  = document.getElementById('dash-total-count');
    const totalLbl = document.getElementById('dash-total-label');
    if (totalEl)  totalEl.textContent  = videos.length;
    if (totalLbl) totalLbl.textContent = t ? 'Toplam Video' : 'Total Videos';

    // ── Bu hafta çalışılan ────────────────────────────────────
    const now       = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0,0,0,0);
    const weekCount = videos.filter(v => {
        if (!v.last_reviewed_at) return false;
        return new Date(v.last_reviewed_at) >= weekStart;
    }).length;
    const weekEl  = document.getElementById('dash-week-count');
    const weekLbl = document.getElementById('dash-week-label');
    if (weekEl)  weekEl.textContent  = weekCount;
    if (weekLbl) weekLbl.textContent = t ? 'Bu Hafta Çalışıldı' : 'Practiced This Week';

    // ── En çok çalışılan teknikler (top tags by review_count) ──
    const tagTitle = document.getElementById('dash-toptags-title');
    if (tagTitle) tagTitle.textContent = t ? 'En Çok Çalışılan Teknikler' : 'Most Practiced Techniques';

    const tagMap = new Map();
    videos.forEach(v => {
        if (!v.tags) return;
        const count = v.review_count || 0;
        v.tags.split(',').forEach(tag => {
            tag = tag.trim();
            if (!tag) return;
            tagMap.set(tag, (tagMap.get(tag) || 0) + count);
        });
    });
    const topTags = Array.from(tagMap.entries())
        .filter(([, c]) => c > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const tagsListEl = document.getElementById('dash-toptags-list');
    const tagsEmptyEl = document.getElementById('dash-toptags-empty');
    if (tagsListEl) {
        if (topTags.length === 0) {
            tagsListEl.innerHTML = `<span class="dash-toptags-empty">${t ? 'Henüz veri yok' : 'No data yet'}</span>`;
        } else {
            tagsListEl.innerHTML = topTags.map(([tag, cnt]) =>
                `<span class="dash-tag-chip">
                    #${tag}
                    <span class="dash-tag-chip-count">${cnt}</span>
                </span>`
            ).join('');
        }
    }

    // ── Son eklenen 5 video ───────────────────────────────────
    const recentTitle = document.getElementById('dash-recent-title');
    if (recentTitle) recentTitle.textContent = t ? 'Son Eklenen Videolar' : 'Recently Added Videos';

    const recentVideos = [...videos]
        .sort((a, b) => new Date(b.created_at||0) - new Date(a.created_at||0))
        .slice(0, 5);

    const recentListEl = document.getElementById('dash-recent-list');
    if (recentListEl) {
        recentListEl.innerHTML = recentVideos.map(v => {
            const thumb = v.cover_image_url
                ? `<img class="dash-recent-thumb" src="${v.cover_image_url}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                : '';
            const placeholder = `<div class="dash-recent-thumb-placeholder" style="${v.cover_image_url ? 'display:none' : ''}">🎬</div>`;
            const platform = v.platform || 'other';
            const dateStr  = v.created_at ? new Date(v.created_at).toLocaleDateString(t ? 'tr-TR' : 'en-US', { day:'numeric', month:'short' }) : '';
            const instructor = v.instructor_name || '';
            const meta = [instructor, dateStr].filter(Boolean).join(' · ');
            return `<div class="dash-recent-item">
                ${thumb}${placeholder}
                <div class="dash-recent-info">
                    <div class="dash-recent-name">${v.combination_name || (t ? 'İsimsiz' : 'Unnamed')}</div>
                    <div class="dash-recent-meta">${meta}</div>
                </div>
                <span class="dash-recent-platform ${platform}">${platform}</span>
            </div>`;
        }).join('');
    }
}

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