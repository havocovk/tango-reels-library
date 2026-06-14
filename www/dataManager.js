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
// renderDashboard — Adim 4.1 (duzeltilmis)
// ─────────────────────────────────────────────────────────────
export function renderDashboard() {
    const videos = store.get('globalVideos') || [];
    const lang   = store.get('currentLang');
    const t      = lang === 'tr';

    // ── Başlık ────────────────────────────────────────────────
    const titleEl    = document.getElementById('dash-title');
    const subtitleEl = document.getElementById('dash-subtitle');
    if (titleEl)    titleEl.textContent    = t ? 'Genel Bakış' : 'Overview';
    if (subtitleEl) subtitleEl.textContent = t
        ? 'Kombinasyon koleksiyonunun özeti'
        : 'Summary of your combination collection';

    // İçerik türüne göre ayır
    const combinationVideos = videos.filter(v => !v.content_type || v.content_type === 'combination');
    const showVideos        = videos.filter(v => v.content_type === 'show');

    // ── Bugün tekrar edilecek — sadece kombinasyon videoları ──
    const dueVideos = getDueVideos(combinationVideos);
    const dueEl     = document.getElementById('dash-due-count');
    const dueLblEl  = document.getElementById('dash-due-label');
    if (dueEl)    dueEl.textContent    = dueVideos.length;
    if (dueLblEl) dueLblEl.textContent = t ? 'Bugün Tekrar' : 'Due Today';

    const practiceBtnEl   = document.getElementById('dash-start-practice');
    const practiceBtnText = document.getElementById('dash-practice-btn-text');
    if (practiceBtnText) practiceBtnText.textContent = t ? 'Pratik Başlat' : 'Start Practice';
    if (practiceBtnEl) {
        // Butonu her renderda yeniden bağla
        practiceBtnEl.replaceWith(practiceBtnEl.cloneNode(true));
        const freshBtn = document.getElementById('dash-start-practice');
        if (freshBtn) {
            freshBtn.style.display = dueVideos.length > 0 ? 'flex' : 'none';
            freshBtn.addEventListener('click', () => {
                import('./practiceSession.js').then(({ startPracticeSession }) => {
                    startPracticeSession(dueVideos);
                });
            });
        }
    }

    // ── Öğreniliyor ───────────────────────────────────────────
    const learningCount = combinationVideos.filter(v => v.learning_status === 'learning').length;
    const newCount      = combinationVideos.filter(v => !v.learning_status || v.learning_status === 'new').length;
    const learningEl    = document.getElementById('dash-learning-count');
    const learningLbl   = document.getElementById('dash-learning-label');
    if (learningEl)  learningEl.textContent  = learningCount + newCount;
    if (learningLbl) learningLbl.textContent = t ? 'Öğreniliyor' : 'In Progress';

    // ── Ustalaşıldı ───────────────────────────────────────────
    const masteredCount = combinationVideos.filter(v => v.learning_status === 'mastered').length;
    const masteredEl    = document.getElementById('dash-mastered-count');
    const masteredLbl   = document.getElementById('dash-mastered-label');
    if (masteredEl)  masteredEl.textContent  = masteredCount;
    if (masteredLbl) masteredLbl.textContent = t ? 'Ustalaşıldı' : 'Mastered';

    // ── Toplam video ──────────────────────────────────────────
    const totalEl  = document.getElementById('dash-total-count');
    const totalLbl = document.getElementById('dash-total-label');
    if (totalEl)  totalEl.textContent  = combinationVideos.length;
    if (totalLbl) totalLbl.textContent = t ? 'Kombinasyon' : 'Combinations';

    const showsEl  = document.getElementById('dash-shows-count');
    const showsLbl = document.getElementById('dash-shows-label');
    if (showsEl)  showsEl.textContent  = showVideos.length;
    if (showsLbl) showsLbl.textContent = t ? 'Tango Şovu' : 'Tango Shows';

    // ── Bu hafta çalışılan ────────────────────────────────────
    const now       = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekCount = combinationVideos.filter(v =>
        v.last_reviewed_at && new Date(v.last_reviewed_at) >= weekStart
    ).length;
    const weekEl  = document.getElementById('dash-week-count');
    const weekLbl = document.getElementById('dash-week-label');
    if (weekEl)  weekEl.textContent  = weekCount;
    if (weekLbl) weekLbl.textContent = t ? 'Bu Hafta Çalışıldı' : 'Practiced This Week';

    // ── En çok çalışılan teknikler ────────────────────────────
    const tagTitleEl = document.getElementById('dash-toptags-title');
    if (tagTitleEl) tagTitleEl.textContent = t ? 'En Çok Çalışılan Teknikler' : 'Most Practiced Techniques';

    const tagMap = new Map();
    combinationVideos.forEach(v => {
        if (!v.tags) return;
        const count = v.review_count || 0;
        v.tags.split(',').forEach(raw => {
            const tag = raw.trim();
            if (!tag) return;
            tagMap.set(tag, (tagMap.get(tag) || 0) + count);
        });
    });
    const topTags = Array.from(tagMap.entries())
        .filter(([, cnt]) => cnt > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const tagsListEl = document.getElementById('dash-toptags-list');
    if (tagsListEl) {
        tagsListEl.innerHTML = topTags.length === 0
            ? `<span class="dash-toptags-empty">${t ? 'Henüz pratik yapılmamış' : 'No practice data yet'}</span>`
            : topTags.map(([tag, cnt]) =>
                `<span class="dash-tag-chip">#${tag}<span class="dash-tag-chip-count">${cnt}</span></span>`
            ).join('');
    }

    // ── Son eklenen 5 video ───────────────────────────────────
    const recentTitleEl = document.getElementById('dash-recent-title');
    if (recentTitleEl) recentTitleEl.textContent = t ? 'Son Eklenen Videolar' : 'Recently Added Videos';

    const recentVideos = [...combinationVideos]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

    const recentListEl = document.getElementById('dash-recent-list');
    if (recentListEl) {
        recentListEl.innerHTML = recentVideos.map(v => {
            // Kapak resmi: cover_url alanı kullanılıyor (videoCardRenderer ile tutarlı)
            const coverUrl    = v.cover_url || '';
            const thumbHtml   = coverUrl
                ? `<img class="dash-recent-thumb" src="${coverUrl}" alt="">`
                : `<div class="dash-recent-thumb-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff007f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>`;

            // Video başlığı: eğitmen adı + ilk 2 etiket
            const instructorName = v.instructors ? v.instructors.name : (v.instructor_name || '');
            const tags = v.tags ? v.tags.split(',').map(s => s.trim()).filter(Boolean).slice(0, 2) : [];
            const displayName = instructorName || (t ? 'Bilinmeyen Eğitmen' : 'Unknown Instructor');
            const tagStr      = tags.length ? tags.map(tg => '#' + tg).join(' ') : '';

            const platform = v.platform || 'other';
            const dateStr   = v.created_at
                ? new Date(v.created_at).toLocaleDateString(t ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short' })
                : '';

            return `<div class="dash-recent-item">
                ${thumbHtml}
                <div class="dash-recent-info">
                    <div class="dash-recent-name">${displayName}</div>
                    <div class="dash-recent-meta">${[tagStr, dateStr].filter(Boolean).join(' · ')}</div>
                </div>
                <span class="dash-recent-platform ${platform}">${platform}</span>
            </div>`;
        }).join('');
    }
}

// ─────────────────────────────────────────────────────────────
// renderShows — Tango Şovları sayfasını doldurur
// ─────────────────────────────────────────────────────────────
let _showsCallbacks = null;
export function setShowsCallbacks(cb) { _showsCallbacks = cb; }

export function renderShows() {
    const lang      = store.get('currentLang');
    const t         = lang === 'tr';
    const allVideos = store.get('globalVideos') || [];
    const shows     = allVideos.filter(v => v.content_type === 'show');

    // Sanatçı dropdown'ı doldur
    const instrSelect = document.getElementById('shows-instructor-select');
    if (instrSelect) {
        const instructors = [...new Set(shows.map(v => v.instructor_name).filter(Boolean))].sort();
        instrSelect.innerHTML = `<option value="all">${t ? 'Tüm Sanatçılar' : 'All Artists'}</option>` +
            instructors.map(n => `<option value="${n}">${n}</option>`).join('');
    }

    // Etiket dropdown'ı doldur
    const tagSelect = document.getElementById('shows-tag-select');
    if (tagSelect) {
        const tags = [...new Set(shows.flatMap(v => v.tags ? v.tags.split(',').map(t => t.trim()) : []).filter(Boolean))].sort();
        tagSelect.innerHTML = `<option value="all">${t ? 'Tüm Etiketler' : 'All Tags'}</option>` +
            tags.map(tg => `<option value="${tg}">${tg}</option>`).join('');
    }

    // Rastgele buton
    const randomBtn = document.getElementById('shows-random-btn');
    if (randomBtn && !randomBtn.dataset.bound) {
        import('./icons.js').then(({ icon }) => {
            randomBtn.innerHTML = `${icon('shuffle', { size: 15, color: '#c026d3' })} ${t ? 'Rastgele' : 'Random'}`;
        });
        randomBtn.dataset.bound = '1';
        randomBtn.addEventListener('click', () => _applyShowsFilter(true));
    }

    // Arama + filtre event listener'ları (bir kez bağla)
    const searchInput = document.getElementById('shows-search-input');
    const searchBtn   = document.getElementById('shows-search-btn');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = '1';
        searchInput.addEventListener('input', () => _applyShowsFilter());
        if (searchBtn) searchBtn.addEventListener('click', () => _applyShowsFilter());
        document.getElementById('shows-instructor-select')?.addEventListener('change', () => _applyShowsFilter());
        document.getElementById('shows-tag-select')?.addEventListener('change', () => _applyShowsFilter());
        document.getElementById('shows-platform-select')?.addEventListener('change', () => _applyShowsFilter());
    }

    _applyShowsFilter();
}

async function _applyShowsFilter(random = false) {
    const lang     = store.get('currentLang');
    const t        = lang === 'tr';
    const allVideos = store.get('globalVideos') || [];
    let shows      = allVideos.filter(v => v.content_type === 'show');

    const search   = document.getElementById('shows-search-input')?.value?.toLowerCase() || '';
    const instr    = document.getElementById('shows-instructor-select')?.value || 'all';
    const tag      = document.getElementById('shows-tag-select')?.value || 'all';
    const platform = document.getElementById('shows-platform-select')?.value || 'all';

    if (search)          shows = shows.filter(v => [v.instructor_name, v.tags, v.notes, v.partner_name].filter(Boolean).join(' ').toLowerCase().includes(search));
    if (instr !== 'all') shows = shows.filter(v => v.instructor_name === instr);
    if (tag   !== 'all') shows = shows.filter(v => v.tags && v.tags.split(',').map(t => t.trim()).includes(tag));
    if (platform !== 'all') shows = shows.filter(v => v.platform === platform);

    const countEl = document.getElementById('shows-total-count');
    if (countEl) countEl.textContent = `${t ? 'Toplam:' : 'Total:'} ${shows.length}`;

    const grid = document.getElementById('shows-grid');
    if (!grid) return;

    if (shows.length === 0) {
        grid.innerHTML = `<div class="info-msg">${t ? 'Tango şovu bulunamadı.' : 'No tango shows found.'}</div>`;
        return;
    }

    // Rastgele modda: rastgele bir video vurgula
    let highlightId = null;
    if (random && shows.length > 0) {
        highlightId = shows[Math.floor(Math.random() * shows.length)].id;
    }

    // renderVideoCards ile tam kart desteği (düzenle/sil/⋮ menüsü)
    const cb = _showsCallbacks || {};
    renderVideoCards(shows, {
        currentLang:          lang,
        currentView:          'shows',
        translations:         (await import('./i18n.js')).translations,
        favs:                 store.get('globalFavorites') || [],
        toggleFavorite:       cb.toggleFavorite       || (() => {}),
        openTagsEditModal:    cb.openTagsEditModal     || (() => {}),
        startVideoEditFlow:   cb.startVideoEditFlow    || (() => {}),
        deleteVideoFlow:      cb.deleteVideoFlow       || (() => {}),
        openVideoModal:       cb.openVideoModal        || (() => {}),
        refreshList:          () => _applyShowsFilter(),
        updateLearningStatus: cb.updateLearningStatus  || (() => {}),
        showPlaylistDropdown: cb.showPlaylistDropdown  || (() => {}),
        containerId:          'shows-grid'
    });

    // Rastgele modda scroll + vurgula
    if (highlightId) {
        setTimeout(() => {
            const card = grid.querySelector(`[data-video-id="${highlightId}"]`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    if (card) { card.style.outline = ''; card.style.boxShadow = ''; }
                }, 5000);
            }
        }, 300);
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