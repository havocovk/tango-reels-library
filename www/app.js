import { translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { 
    dbSaveVideo, dbDeleteVideo, dbFetchInstructors, dbFetchVideos, 
    dbSaveInstructor, dbDeleteInstructor, dbFetchFavorites, dbAddFavorite,
    dbRemoveFavorite, dbClearAllFavorites, detectPlatform
} from './tangoVeritabani.js';
import { renderChips, setupAutocomplete, renderVideoCards } from './uiRenderer.js';
import { 
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly
} from './tangoModals.js';
import { updateSmartFilenameAssistant, updateInterfaceLanguage, switchView } from './tangoUI.js';
import { getFilteredVideos, getAllUniqueTagsPool, populateFilterDropdowns } from './tangoFilters.js';
import { computeStats, renderStats } from './tangoStats.js';
import { showLoading, setCurrentLangForUtils, showModernPrompt } from './utils.js';
import { initTagManager, updateTagManagerSelection, promptRenameTagModern, deleteSingleTag, deleteSelectedTags, mergeSelectedTags, cleanupUnusedTags } from './tagManager.js';

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = [];
let editInstructorId = null;
let editingVideoId = null;
let currentView = 'library';
let visibleCount = 20;
let globalInstructors = [];
let formTagsArray = [];

let selectedTagsForMerge = [];

// Utils'in dil bilgisini güncelle
setCurrentLangForUtils(currentLang);

const getUIState = () => ({
    currentLang, editingVideoId, editInstructorId, currentView,
    getFormTags: () => formTagsArray,
    resetFormTags: () => { formTagsArray = []; }
});

function callUpdateSmartAssistant() { updateSmartFilenameAssistant(currentLang, formTagsArray); }
function callUpdateInterfaceLanguage() {
    updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch, () => {
        if (globalVideos.length) populateFilterDropdowns(globalVideos, currentLang);
    });
    if (globalVideos.length) populateFilterDropdowns(globalVideos, currentLang);
    applyFiltersAndSearch();
    if (currentView === 'stats') renderStatsPanel();
}
function callSwitchView(viewName) {
    currentView = viewName;
    visibleCount = 20;
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch, renderFormChips, resetUploadedCoverUrl,
        renderTagManager: renderTagManagerUI
    });
    if (viewName === 'stats') renderStatsPanel();
    if (viewName === 'tagManager') renderTagManagerUI();
    applyFiltersAndSearch();
}

async function toggleFavorite(videoId) {
    try {
        if (globalFavorites.includes(videoId)) {
            await dbRemoveFavorite(videoId);
            globalFavorites = globalFavorites.filter(id => id !== videoId);
        } else {
            await dbAddFavorite(videoId);
            globalFavorites.push(videoId);
        }
        applyFiltersAndSearch();
    } catch (err) { console.error(err); }
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

async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
        globalInstructors = instructors;
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
        callUpdateSmartAssistant();
    } catch (err) { console.error(err); }
}

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
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `<div class="info-msg" style="color:#ef4444;">${translations[currentLang].error}</div>`;
        console.error(err);
    }
}

function startVideoEditFlow(video) {
    editingVideoId = video.id;
    callSwitchView('add');
    const lang = translations[currentLang];
    document.getElementById('form-title').innerText = lang.formTitleEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;
    document.getElementById('form-instructor-select').value = video.instructor_id;
    document.getElementById('form-video-url').value = video.url || '';
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t) : [];
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

async function deleteVideoFlow(videoId) {
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okText, cancelText)) return;
    try {
        await dbDeleteVideo(videoId);
        await showCustomAlert(lang.successDeleteVideo, okText);
        globalFavorites = globalFavorites.filter(id => id !== videoId);
        await fetchVideos();
    } catch (err) { 
        await showCustomAlert(currentLang === 'tr' ? 'Silme hatası!' : 'Deletion error!', okText);
    }
}

function renderFormChips() {
    renderChips('chips-area', formTagsArray, (index) => {
        formTagsArray.splice(index, 1);
        renderFormChips();
        callUpdateSmartAssistant();
    });
}

function applyFiltersAndSearch() {
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
        openTagsEditModal: (video) => openTagsEditModal(video, globalVideos, applyFiltersAndSearch),
        startVideoEditFlow, deleteVideoFlow, openVideoModal, refreshList: applyFiltersAndSearch
    });
}

async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
    const name = input.value.trim();
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    if (!name) return showCustomAlert(lang.insAlert, okText);
    try {
        await dbSaveInstructor(editInstructorId, name);
        await showCustomAlert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess, okText);
        input.value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        await fetchInstructors();
        await fetchVideos();
    } catch (err) { console.error(err); }
}

async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    if (!select.value) return;
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.deleteConfirm, okText, cancelText)) return;
    try {
        await dbDeleteInstructor(select.value);
        await showCustomAlert(lang.insDeleteSuccess, okText);
        await fetchInstructors();
        await fetchVideos();
    } catch (err) { console.error(err); }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const instructor_id = document.getElementById('form-instructor-select').value;
    let url = document.getElementById('form-video-url').value.trim();
    const role_type = document.getElementById('form-role-select').value;
    const partner_name = document.getElementById('form-partner-name').value.trim();
    const tags = formTagsArray.join(', ');
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && editingVideoId) {
        const curr = globalVideos.find(v => v.id === editingVideoId);
        if (curr) cover_url = curr.cover_url;
    }
    if (!instructor_id) return showCustomAlert(currentLang === 'tr' ? 'Lütfen eğitmen seçin!' : 'Please select instructor!', okText);
    if (is_downloaded && !drive_url) return showCustomAlert(currentLang === 'tr' ? 'Drive linki zorunludur!' : 'Drive link is required!', okText);
    if (!is_downloaded && !url) return showCustomAlert(currentLang === 'tr' ? 'Video URL zorunludur!' : 'Video URL is required!', okText);
    let platform = is_downloaded ? 'drive' : detectPlatform(url, false);
    let finalUrl = url;
    if (is_downloaded && (!finalUrl || finalUrl === '')) {
        finalUrl = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
    const payload = {
        instructor_id: parseInt(instructor_id),
        url: finalUrl,
        role_type, partner_name: partner_name || null,
        tags: tags || null, is_downloaded,
        drive_url: is_downloaded ? drive_url : null,
        cover_url, platform
    };
    try {
        await dbSaveVideo(editingVideoId, payload);
        await showCustomAlert(editingVideoId ? lang.successUpdate : lang.successSave, okText);
        editingVideoId = null;
        formTagsArray = [];
        renderFormChips();
        document.getElementById('add-video-form').reset();
        document.getElementById('image-preview').classList.add('d-none');
        document.getElementById('drop-area-text').innerText = lang.dropText;
        document.getElementById('drive-url-container').classList.add('d-none');
        resetUploadedCoverUrl();
        callSwitchView('library');
        await fetchVideos();
    } catch (err) {
        let hata = `${currentLang === 'tr' ? 'İşlem hatası:' : 'Operation error:'} ${err.message}`;
        await showCustomAlert(hata, okText);
    }
}

// ----- TAG MANAGER UI RENDER (app.js içinde kalıyor) -----
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

// Tag Manager modülünü başlat
initTagManager(currentLang, globalVideos, fetchVideos, renderTagManagerUI);

// Olay dinleyicileri
document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();
    callUpdateInterfaceLanguage();

    document.getElementById('lang-toggle-btn').onclick = () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        setCurrentLangForUtils(currentLang);
        initTagManager(currentLang, globalVideos, fetchVideos, renderTagManagerUI);
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
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, renderFormChips, (newTag) => {
        formTagsArray.push(newTag);
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
    const handleFilter = () => { visibleCount = 20; applyFiltersAndSearch(); };
    document.getElementById('filter-role-select').onchange = handleFilter;
    document.getElementById('filter-instructor-select').onchange = handleFilter;
    document.getElementById('filter-tag-select').onchange = handleFilter;
    document.getElementById('filter-date-select').onchange = handleFilter;
    document.getElementById('filter-platform-select').onchange = handleFilter;
    document.getElementById('filter-btn').onclick = () => { visibleCount = 20; fetchVideos(); };
    document.getElementById('btn-load-more').onclick = () => { visibleCount += 20; applyFiltersAndSearch(); };
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
        selectedTagsForMerge = [];
        updateTagManagerSelection();
    };
    document.getElementById('tag-merge-confirm-btn').onclick = () => mergeSelectedTags();
    window.applyFiltersAndSearch = applyFiltersAndSearch;
});