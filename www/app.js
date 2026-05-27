import { translations } from './config.js';
import { handlePasteEvent } from './storage.js';
import { 
    dbFetchFavorites, dbClearAllFavorites
} from './tangoVeritabani.js';
import { setupAutocomplete } from './uiRenderer.js';
import { 
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly
} from './tangoModals.js';
import { updateInterfaceLanguage, switchView, updateSmartFilenameAssistant } from './tangoUI.js';
import { getAllUniqueTagsPool, populateFilterDropdowns } from './tangoFilters.js';
import { computeStats, renderStats } from './tangoStats.js';
import { showLoading, setCurrentLangForUtils, showModernPrompt } from './utils.js';
import { initTagManager, updateTagManagerSelection, promptRenameTagModern, deleteSingleTag, deleteSelectedTags, mergeSelectedTags, cleanupUnusedTags } from './tagManager.js';
import { initVideoHandlers, toggleFavorite, applyFiltersAndSearch, setVisibleCount, incrementVisibleCount, deleteVideoFlow } from './videoHandlers.js';
import { initInstructorHandlers, fetchInstructors, handleInstructorSubmit, deleteInstructor } from './instructorHandlers.js';
import { initFormHandlers, renderFormChips, handleFormSubmit, setEditingVideoId, setFormTagsArray, getFormTagsArray } from './formHandlers.js';

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = [];
let editInstructorId = null;
let editingVideoId = null;
let currentView = 'library';
let visibleCount = 20;
let globalInstructors = [];
let formTagsArray = [];

// Utils dilini güncelle
setCurrentLangForUtils(currentLang);

// Callback'leri hazırla
const callbacks = {
    applyFiltersAndSearch: () => applyFiltersAndSearch(),
    fetchVideos: async () => { await fetchVideos(); },
    openVideoModal: (url) => openVideoModal(url),
    openTagsEditModal: (video) => openTagsEditModal(video, globalVideos, applyFiltersAndSearch),
    startVideoEditFlow: (video) => startVideoEditFlow(video),
    deleteVideoFlow: (videoId) => deleteVideoFlow(videoId),
    switchView: (viewName) => callSwitchView(viewName),
    renderFormChips: () => renderFormChips()
};

// Modülleri başlat
initVideoHandlers(currentLang, globalVideos, globalFavorites, currentView, visibleCount, callbacks);
initInstructorHandlers(currentLang, editInstructorId, globalInstructors, callbacks);
initFormHandlers(currentLang, editingVideoId, formTagsArray, globalVideos, callbacks);
initTagManager(currentLang, globalVideos, callbacks.fetchVideos, renderTagManagerUI);

const getUIState = () => ({
    currentLang, editingVideoId, editInstructorId, currentView,
    getFormTags: () => getFormTagsArray(),
    resetFormTags: () => { setFormTagsArray([]); }
});

function callUpdateSmartAssistant() {
    updateSmartFilenameAssistant(currentLang, getFormTagsArray());
}

function callUpdateInterfaceLanguage() {
    updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, getFormTagsArray(), applyFiltersAndSearch, () => {
        if (globalVideos.length) populateFilterDropdowns(globalVideos, currentLang);
    });
    if (globalVideos.length) populateFilterDropdowns(globalVideos, currentLang);
    applyFiltersAndSearch();
    if (currentView === 'stats') renderStatsPanel();
}

function callSwitchView(viewName) {
    currentView = viewName;
    visibleCount = 20;
    setVisibleCount(visibleCount);
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch, renderFormChips: () => renderFormChips(), resetUploadedCoverUrl: () => {},
        renderTagManager: renderTagManagerUI
    });
    if (viewName === 'stats') renderStatsPanel();
    if (viewName === 'tagManager') renderTagManagerUI();
    applyFiltersAndSearch();
}

function clearAllFavorites() {
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    showCustomConfirm(lang.confirmClearFavs, okText, cancelText).then(async confirmed => {
        if (confirmed) {
            await dbClearAllFavorites();
            globalFavorites = [];
            applyFiltersAndSearch();
        }
    });
}

function callGetUniqueTagsPool() { return getAllUniqueTagsPool(globalVideos); }

function renderStatsPanel() {
    if (currentView !== 'stats') return;
    const stats = computeStats(globalVideos, globalInstructors);
    renderStats(stats, currentLang);
}

async function fetchVideos() {
    try {
        const instructors = await dbFetchInstructors();
        globalInstructors = instructors;
        const rawVideos = await dbFetchVideos();
        const favRows = await dbFetchFavorites().catch(() => []);
        globalFavorites = favRows.map(f => f.video_id);
        globalVideos = rawVideos.map(video => ({
            ...video,
            instructor_name: instructors.find(ins => ins.id === video.instructor_id)?.name || 'Bilinmeyen Eğitmen'
        }));
        populateFilterDropdowns(globalVideos, currentLang);
        applyFiltersAndSearch();
        if (currentView === 'stats') renderStatsPanel();
        if (currentView === 'tagManager') renderTagManagerUI();
        // Video handlers'daki global dizileri güncelle
        initVideoHandlers(currentLang, globalVideos, globalFavorites, currentView, visibleCount, callbacks);
        initTagManager(currentLang, globalVideos, callbacks.fetchVideos, renderTagManagerUI);
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `<div class="info-msg" style="color:#ef4444;">${translations[currentLang].error}</div>`;
        console.error(err);
    }
}

function startVideoEditFlow(video) {
    editingVideoId = video.id;
    setEditingVideoId(video.id);
    callSwitchView('add');
    const lang = translations[currentLang];
    document.getElementById('form-title').innerText = lang.formTitleEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;
    document.getElementById('form-instructor-select').value = video.instructor_id;
    document.getElementById('form-video-url').value = video.url || '';
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    const tagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t) : [];
    setFormTagsArray(tagsArray);
    renderFormChips();
    const isDownloaded = document.getElementById('form-is-downloaded');
    const driveUrlContainer = document.getElementById('drive-url-container');
    const driveUrlInput = document.getElementById('form-drive-url');
    if (video.is_downloaded) {
        isDownloaded.checked = true;
        driveUrlContainer.classList.remove('d-none');
        driveUrlInput.value = video.drive_url || '';
        driveUrlInput.required = true;
    } else {
        isDownloaded.checked = false;
        driveUrlContainer.classList.add('d-none');
        driveUrlInput.value = '';
        driveUrlInput.required = false;
    }
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        imgPreview.src = video.cover_url;
        imgPreview.classList.remove('d-none');
        dropAreaText.classList.add('d-none');
    } else {
        imgPreview.classList.add('d-none');
        dropAreaText.innerText = lang.dropText;
        dropAreaText.classList.remove('d-none');
    }
    callUpdateSmartAssistant();
}

function renderTagManagerUI() {
    const tbody = document.getElementById('tag-manager-tbody');
    if (!tbody) return;
    const tagMap = new Map();
    globalVideos.forEach(v => {
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
        renameBtn.title = currentLang === 'tr' ? 'Yeniden Adlandır' : 'Rename';
        renameBtn.onclick = () => promptRenameTagModern(tag);
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = '🗑️';
        deleteBtn.className = 'tag-action-btn tag-danger-btn';
        deleteBtn.title = currentLang === 'tr' ? 'Tüm Videolardan Sil' : 'Delete from all videos';
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

// Dil değişiminde modüllerin dilini güncelle
function updateAllLanguages() {
    setCurrentLangForUtils(currentLang);
    initVideoHandlers(currentLang, globalVideos, globalFavorites, currentView, visibleCount, callbacks);
    initInstructorHandlers(currentLang, editInstructorId, globalInstructors, callbacks);
    initFormHandlers(currentLang, editingVideoId, getFormTagsArray(), globalVideos, callbacks);
    initTagManager(currentLang, globalVideos, callbacks.fetchVideos, renderTagManagerUI);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();
    callUpdateInterfaceLanguage();

    document.getElementById('lang-toggle-btn').onclick = () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateAllLanguages();
        callUpdateInterfaceLanguage();
        if (currentView === 'stats') renderStatsPanel();
        if (currentView === 'tagManager') renderTagManagerUI();
    };
    document.getElementById('menu-library').onclick = () => { editingVideoId = null; callSwitchView('library'); };
    document.getElementById('menu-favorites').onclick = () => { editingVideoId = null; callSwitchView('favorites'); };
    document.getElementById('menu-stats').onclick = () => { editingVideoId = null; callSwitchView('stats'); };
    document.getElementById('menu-add-video').onclick = () => callSwitchView('add');
    document.getElementById('menu-tag-manager').onclick = () => callSwitchView('tagManager');
    document.getElementById('btn-clear-favorites').onclick = clearAllFavorites;
    document.getElementById('form-is-downloaded').onchange = (e) => {
        const container = document.getElementById('drive-url-container');
        const input = document.getElementById('form-drive-url');
        if (e.target.checked) {
            container.classList.remove('d-none');
            input.required = true;
        } else {
            container.classList.add('d-none');
            input.required = false;
            input.value = '';
        }
    };
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, () => renderFormChips(), (newTag) => {
        const currentTags = getFormTagsArray();
        currentTags.push(newTag);
        setFormTagsArray(currentTags);
        renderFormChips();
        callUpdateSmartAssistant();
    }, callGetUniqueTagsPool);
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
    }, callGetUniqueTagsPool);
    document.getElementById('form-instructor-select').onchange = callUpdateSmartAssistant;
    document.getElementById('btn-toggle-new-instructor').onclick = () => {
        editInstructorId = null;
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
        document.getElementById('new-instructor-container').classList.toggle('d-none');
    };
    document.getElementById('btn-edit-instructor').onclick = () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return;
        editInstructorId = select.value;
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    };
    document.getElementById('btn-delete-instructor').onclick = deleteInstructor;
    document.getElementById('btn-save-instructor').onclick = handleInstructorSubmit;
    document.getElementById('add-video-form').onsubmit = handleFormSubmit;
    const handleFilter = () => { setVisibleCount(20); applyFiltersAndSearch(); };
    document.getElementById('filter-role-select').onchange = handleFilter;
    document.getElementById('filter-instructor-select').onchange = handleFilter;
    document.getElementById('filter-tag-select').onchange = handleFilter;
    document.getElementById('filter-date-select').onchange = handleFilter;
    document.getElementById('filter-platform-select').onchange = handleFilter;
    document.getElementById('filter-btn').onclick = () => { setVisibleCount(20); fetchVideos(); };
    document.getElementById('btn-load-more').onclick = () => { incrementVisibleCount(20); applyFiltersAndSearch(); };
    document.getElementById('modal-close-btn').onclick = closeVideoModal;
    document.getElementById('video-modal').onclick = (e) => { if (e.target.id === 'video-modal') closeVideoModal(); };
    document.getElementById('tags-modal-close-btn').onclick = closeTagsEditModal;
    document.getElementById('tags-edit-modal').onclick = (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); };
    document.getElementById('drop-area')?.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    document.getElementById('tag-manager-merge-btn').onclick = () => mergeSelectedTags();
    document.getElementById('tag-manager-delete-btn').onclick = () => deleteSelectedTags();
    document.getElementById('tag-manager-cleanup-btn').onclick = () => cleanupUnusedTags();
    document.getElementById('tag-merge-cancel-btn').onclick = () => {
        document.getElementById('tag-merge-panel').classList.add('d-none');
        updateTagManagerSelection();
    };
    document.getElementById('tag-merge-confirm-btn').onclick = () => mergeSelectedTags();
    window.applyFiltersAndSearch = applyFiltersAndSearch;
});