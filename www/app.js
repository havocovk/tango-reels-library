import { translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { 
    dbSaveVideo, 
    dbDeleteVideo, 
    dbFetchInstructors, 
    dbFetchVideos, 
    dbSaveInstructor, 
    dbDeleteInstructor,
    dbFetchFavorites,
    dbAddFavorite,
    dbRemoveFavorite,
    dbClearAllFavorites,
    detectPlatform
} from './tangoVeritabani.js';
import { renderChips, setupAutocomplete, renderVideoCards } from './uiRenderer.js';
import { 
    openVideoModal, 
    closeVideoModal, 
    openTagsEditModal, 
    closeTagsEditModal,
    modalTagsArray,
    showCustomAlert,
    showCustomConfirm,
    saveTagsToSupabaseDirectly,
    openNoteEditModal
} from './tangoModals.js';
import { 
    updateSmartFilenameAssistant, 
    updateInterfaceLanguage, 
    switchView 
} from './tangoUI.js';
import { 
    getFilteredVideos, 
    getAllUniqueTagsPool,
    populateFilterDropdowns
} from './tangoFilters.js';
import { computeStats, renderStats } from './tangoStats.js';

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 
let visibleCount = 20;
let globalInstructors = [];
let formTagsArray = [];

const getUIState = () => ({
    currentLang,
    editingVideoId,
    editInstructorId,
    currentView,
    getFormTags: () => formTagsArray,
    resetFormTags: () => { formTagsArray = []; }
});

function callUpdateSmartAssistant() {
    updateSmartFilenameAssistant(currentLang, formTagsArray);
}

function callUpdateInterfaceLanguage() {
    updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch, () => {
        if (globalVideos.length) populateFilterDropdowns(globalVideos, currentLang);
    });
    if (globalVideos.length) {
        populateFilterDropdowns(globalVideos, currentLang);
    }
    applyFiltersAndSearch();
    if (currentView === 'stats') renderStatsPanel();
}

function callSwitchView(viewName) {
    currentView = viewName; 
    visibleCount = 20;
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch,
        renderFormChips,
        resetUploadedCoverUrl
    });
    if (viewName === 'stats') {
        renderStatsPanel();
    }
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
    } catch (err) {
        console.error("Favori güncellenirken hata oluştu:", err);
    }
}

function clearAllFavorites() {
    const lang = translations[currentLang];
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelTxt = currentLang === 'tr' ? 'İptal' : 'Cancel';
    showCustomConfirm(lang.confirmClearFavs, okTxt, cancelTxt).then(async (confirmed) => {
        if (confirmed) {
            try {
                await dbClearAllFavorites();
                globalFavorites = [];
                applyFiltersAndSearch();
            } catch (err) {
                console.error("Favoriler temizlenirken hata oluştu:", err);
            }
        }
    });
}

function callGetUniqueTagsPool() {
    return getAllUniqueTagsPool(globalVideos);
}

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
    } catch (err) {
        console.error("Eğitmenler yüklenemedi:", err);
    }
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
        try {
            const favRows = await dbFetchFavorites();
            globalFavorites = favRows.map(f => f.video_id);
        } catch (favErr) {
            console.error("Favoriler çekilemedi:", favErr);
            globalFavorites = [];
        }
        globalVideos = rawVideos.map(video => {
            const foundInstructor = instructors.find(ins => ins.id === video.instructor_id);
            return {
                ...video,
                instructor_name: foundInstructor ? foundInstructor.name : 'Bilinmeyen Eğitmen'
            };
        });
        populateFilterDropdowns(globalVideos, currentLang);
        applyFiltersAndSearch();
        if (currentView === 'stats') renderStatsPanel();
    } catch (err) {
        const grid = document.getElementById('video-grid');
        if (grid) {
            grid.innerHTML = `<div class="info-msg" style="color: #ef4444;">${translations[currentLang].error}</div>`;
        }
        console.error("Hata:", err);
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
    formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
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
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelTxt = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.confirmDeleteVideo, okTxt, cancelTxt)) return;
    try {
        await dbDeleteVideo(videoId);
        await showCustomAlert(lang.successDeleteVideo, okTxt);
        globalFavorites = globalFavorites.filter(id => id !== videoId);
        await fetchVideos();
    } catch (err) {
        console.error(err);
        await showCustomAlert(currentLang === 'tr' ? "Silme hatası!" : "Deletion error!", okTxt);
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
    const favs = globalFavorites;
    let kaynakVideolar = globalVideos;
    if (currentView === 'favorites') {
        kaynakVideolar = globalVideos.filter(v => favs.includes(v.id));
    }
    const secilenFiltreler = {
        aramaMetni: '',
        rol: document.getElementById('filter-role-select')?.value || 'all',
        egitmen: document.getElementById('filter-instructor-select')?.value || 'all',
        etiket: document.getElementById('filter-tag-select')?.value || 'all',
        tarih: document.getElementById('filter-date-select')?.value || 'all',
        platform: document.getElementById('filter-platform-select')?.value || 'all'
    };
    const filtered = getFilteredVideos(kaynakVideolar, secilenFiltreler, currentLang);
    const totalCountElem = document.getElementById('total-video-count');
    if (totalCountElem) {
        const lang = translations[currentLang];
        let label = (currentView === 'favorites') ? lang.favoritesCountLabel : (currentLang === 'tr' ? 'Toplam Video Sayısı:' : 'Total Videos:');
        totalCountElem.innerText = `${label} ${filtered.length}`;
    }
    const loadMoreContainer = document.getElementById('load-more-container');
    if (loadMoreContainer) {
        if (filtered.length > visibleCount) loadMoreContainer.classList.remove('d-none');
        else loadMoreContainer.classList.add('d-none');
    }
    const videosToRender = filtered.slice(0, visibleCount);
    renderVideoCards(videosToRender, {
        currentLang, currentView, translations, favs, toggleFavorite,
        openTagsEditModal: (video) => openTagsEditModal(video, globalVideos, applyFiltersAndSearch),
        startVideoEditFlow, deleteVideoFlow, openVideoModal, refreshList: applyFiltersAndSearch
    });
}

async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
    if (!input) return;
    const name = input.value.trim();
    const lang = translations[currentLang];
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    if (!name) {
        await showCustomAlert(lang.insAlert, okTxt);
        return;
    }
    try {
        await dbSaveInstructor(editInstructorId, name);
        await showCustomAlert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess, okTxt);
        input.value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        await fetchInstructors();
        await fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    if (!select || !select.value) return;
    const lang = translations[currentLang];
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelTxt = currentLang === 'tr' ? 'İptal' : 'Cancel';
    if (!await showCustomConfirm(lang.deleteConfirm, okTxt, cancelTxt)) return;
    try {
        await dbDeleteInstructor(select.value);
        await showCustomAlert(lang.insDeleteSuccess, okTxt);
        await fetchInstructors();
        await fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const instructor_id = document.getElementById('form-instructor-select').value;
    const url = document.getElementById('form-video-url').value.trim();
    const role_type = document.getElementById('form-role-select').value;
    const partner_name = document.getElementById('form-partner-name').value.trim();
    const tags = formTagsArray.join(', ');
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && editingVideoId) {
        const currentVid = globalVideos.find(v => v.id === editingVideoId);
        if (currentVid) cover_url = currentVid.cover_url;
    }
    if (!instructor_id) {
        await showCustomAlert(currentLang === 'tr' ? "Lütfen eğitmen seçin!" : "Please select instructor!", okTxt);
        return;
    }
    if (is_downloaded) {
        if (!drive_url) {
            await showCustomAlert(currentLang === 'tr' ? "Drive linki zorunludur!" : "Drive link is required!", okTxt);
            return;
        }
    } else {
        if (!url) {
            await showCustomAlert(currentLang === 'tr' ? "Video URL zorunludur!" : "Video URL is required!", okTxt);
            return;
        }
    }
    
    let platform;
    if (is_downloaded) {
        platform = 'drive';
    } else {
        platform = detectPlatform(url, false);
    }
    
    // Drive videosu için benzersiz url oluştur (UNIQUE constraint için)
    let finalUrl = url;
    if (is_downloaded && (!finalUrl || finalUrl === '')) {
        finalUrl = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
    
    const payload = {
        instructor_id: parseInt(instructor_id),
        url: finalUrl,
        role_type,
        partner_name: partner_name || null,
        tags: tags || null,
        is_downloaded,
        drive_url: is_downloaded ? drive_url : null,
        cover_url,
        platform
    };
    try {
        await dbSaveVideo(editingVideoId, payload);
        await showCustomAlert(editingVideoId ? lang.successUpdate : lang.successSave, okTxt);
        editingVideoId = null;
        formTagsArray = [];
        renderFormChips();
        document.getElementById('add-video-form').reset();
        document.getElementById('image-preview').classList.add('d-none');
        const dropAreaText = document.getElementById('drop-area-text');
        dropAreaText.innerText = lang.dropText;
        dropAreaText.classList.remove('d-none');
        document.getElementById('drive-url-container').classList.add('d-none');
        resetUploadedCoverUrl();
        callSwitchView('library');
        await fetchVideos();
    } catch (err) {
        console.error("Kayıt hatası:", err);
        let hataMesaji = currentLang === 'tr' ? "İşlem hatası: " : "Operation error: ";
        hataMesaji += err.message || (currentLang === 'tr' ? "Bilinmeyen hata" : "Unknown error");
        await showCustomAlert(hataMesaji, okTxt);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();
    callUpdateInterfaceLanguage();
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        callUpdateInterfaceLanguage();
        if (currentView === 'stats') renderStatsPanel();
    });
    document.getElementById('menu-library').addEventListener('click', () => {
        editingVideoId = null;
        callSwitchView('library');
    });
    document.getElementById('menu-favorites').addEventListener('click', () => {
        editingVideoId = null;
        callSwitchView('favorites');
    });
    document.getElementById('menu-stats').addEventListener('click', () => {
        editingVideoId = null;
        callSwitchView('stats');
    });
    document.getElementById('menu-add-video').addEventListener('click', () => callSwitchView('add'));
    document.getElementById('btn-clear-favorites').addEventListener('click', clearAllFavorites);
    document.getElementById('form-is-downloaded').addEventListener('change', (e) => {
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
    });
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, renderFormChips, (newTag) => {
        formTagsArray.push(newTag);
        renderFormChips();
        callUpdateSmartAssistant();
    }, callGetUniqueTagsPool);
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
    }, callGetUniqueTagsPool);
    document.getElementById('form-instructor-select').addEventListener('change', callUpdateSmartAssistant);
    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        editInstructorId = null;
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
        document.getElementById('new-instructor-container').classList.toggle('d-none');
    });
    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select || !select.value) return;
        editInstructorId = select.value;
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    });
    document.getElementById('btn-delete-instructor').addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor').addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form').addEventListener('submit', handleFormSubmit);
    const handleFilterChange = () => { visibleCount = 20; applyFiltersAndSearch(); };
    document.getElementById('filter-role-select').addEventListener('change', handleFilterChange);
    document.getElementById('filter-instructor-select').addEventListener('change', handleFilterChange);
    document.getElementById('filter-tag-select').addEventListener('change', handleFilterChange);
    document.getElementById('filter-date-select').addEventListener('change', handleFilterChange);
    document.getElementById('filter-platform-select').addEventListener('change', handleFilterChange);
    document.getElementById('filter-btn').addEventListener('click', () => { visibleCount = 20; fetchVideos(); });
    document.getElementById('btn-load-more').addEventListener('click', () => { visibleCount += 20; applyFiltersAndSearch(); });
    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => { if (e.target.id === 'video-modal') closeVideoModal(); });
    document.getElementById('tags-modal-close-btn').addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); });
    const dropArea = document.getElementById('drop-area');
    if (dropArea) dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    window.applyFiltersAndSearch = applyFiltersAndSearch;
});