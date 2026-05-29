// dataManager.js - Veri çekme, istatistik ve tag manager UI
import { translations } from './config.js';
import { dbFetchInstructors, dbFetchVideos, dbFetchFavorites } from './tangoVeritabani.js';
import { populateFilterDropdowns } from './tangoFilters.js';
import { computeStats, renderStats } from './tangoStats.js';
import { updateSmartFilenameAssistant } from './tangoUI.js';
import { initTagManager, updateTagManagerSelection, promptRenameTagModern, deleteSingleTag, deleteSelectedTags, mergeSelectedTags, cleanupUnusedTags } from './tagManager.js';
import { setVideoHandlersGlobalData, applyFiltersAndSearch } from './videoHandlers.js';
import { setInstructorHandlersGlobalData } from './instructorHandlers.js';
import { setFormHandlersGlobalData, formTagsArray } from './formHandlers.js';
import { exportToJSON, importFromJSON, setBackupLang } from './backup.js';
import { store } from './store.js';

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
        
        populateFilterDropdowns(videos, store.get('currentLang'));
        
        setVideoHandlersGlobalData(store.get('currentLang'), store.get('currentView'), store.get('visibleCount'));
        setInstructorHandlersGlobalData(store.get('currentLang'));
        setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, videos);
        initTagManager(store.get('currentLang'), videos, fetchVideos, renderTagManagerUI);
        
        applyFiltersAndSearch();
        if (store.get('currentView') === 'stats') renderStatsPanel();
        if (store.get('currentView') === 'tagManager') renderTagManagerUI();
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `<div class="info-msg" style="color:#ef4444;">${translations[store.get('currentLang')].error}</div>`;
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
    exportBtn.onclick = () => { exportToJSON(store.get('globalVideos'), store.get('globalInstructors'), store.get('globalFavorites')); };
    importBtn.onclick = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'application/json';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                await importFromJSON(file, store.get('globalVideos'), store.get('globalInstructors'), store.get('globalFavorites'), fetchVideos, fetchInstructors);
            } catch (err) { console.error(err); }
        };
        fileInput.click();
    };
}

export function renderTagManagerUI() {
    const tbody = document.getElementById('tag-manager-tbody');
    if (!tbody) return;
    const tagMap = new Map();
    const videos = store.get('globalVideos');
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });
    const sortedTags = Array.from(tagMap.keys()).sort();
    tbody.innerHTML = '';
    sortedTags.forEach(tag => {
        const count = tagMap.get(tag);
        const row = tbody.insertRow();
        const cbCell = row.insertCell(0);
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'tag-checkbox';
        cb.dataset.tag = tag;
        cb.addEventListener('change', () => updateTagManagerSelection());
        cbCell.appendChild(cb);
        row.insertCell(1).innerText = tag;
        const countCell = row.insertCell(2);
        countCell.innerText = count;
        countCell.style.textAlign = 'center';
        const actionCell = row.insertCell(3);
        actionCell.style.textAlign = 'center';
        const renameBtn = document.createElement('button');
        renameBtn.innerText = '✏️';
        renameBtn.className = 'tag-action-btn';
        renameBtn.title = store.get('currentLang') === 'tr' ? 'Yeniden Adlandır' : 'Rename';
        renameBtn.onclick = () => promptRenameTagModern(tag);
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = '🗑️';
        deleteBtn.className = 'tag-action-btn tag-danger-btn';
        deleteBtn.title = store.get('currentLang') === 'tr' ? 'Tüm Videolardan Sil' : 'Delete from all videos';
        deleteBtn.onclick = () => deleteSingleTag(tag);
        actionCell.appendChild(renameBtn);
        actionCell.appendChild(deleteBtn);
    });
    const selectAll = document.getElementById('tag-select-all');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onclick = () => {
            document.querySelectorAll('#tag-manager-tbody .tag-checkbox').forEach(cb => cb.checked = selectAll.checked);
            updateTagManagerSelection();
        };
    }
    updateTagManagerSelection();
}

export function updateAllLanguages() {
    const currentLang = store.get('currentLang');
    import('./utils.js').then(utils => utils.setCurrentLangForUtils(currentLang));
    setBackupLang(currentLang);
    setVideoHandlersGlobalData(currentLang, store.get('currentView'), store.get('visibleCount'));
    setInstructorHandlersGlobalData(currentLang);
    setFormHandlersGlobalData(currentLang, formTagsArray, store.get('globalVideos'));
    initTagManager(currentLang, store.get('globalVideos'), fetchVideos, renderTagManagerUI);
    // setEditingVideoUpdatedAt import edilmeli
    import('./formHandlers.js').then(fh => fh.setEditingVideoUpdatedAt(null));
}