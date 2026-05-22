import { translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { 
    dbSaveVideo, 
    dbDeleteVideo, 
    dbFetchInstructors, 
    dbFetchVideos, 
    dbSaveInstructor, 
    dbDeleteInstructor 
} from './tangoVeritabani.js';
import { getFavorites, addOrRemoveFavorite, removeFavoriteDirectly, clearAllFavoritesData } from './favoritesManager.js';
import { renderChips, setupAutocomplete, renderVideoCards } from './uiRenderer.js';
import { 
    openVideoModal, 
    closeVideoModal, 
    openTagsEditModal, 
    closeTagsEditModal,
    modalTagsArray
} from './tangoModals.js';
import { 
    updateSmartFilenameAssistant, 
    updateInterfaceLanguage, 
    switchView 
} from './tangoUI.js';

// Yeni Filtre modülümüzü içeri alıyoruz
import { 
    getFilteredVideos, 
    getAllUniqueTagsPool 
} from './tangoFilters.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 

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
    updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch);
}

function callSwitchView(viewName) {
    currentView = viewName; // <-- Hatayı çözen, hafızayı güncelleyen kritik satır!
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch,
        renderFormChips,
        resetUploadedCoverUrl
    });
}

function toggleFavorite(videoId) {
    addOrRemoveFavorite(videoId);
    applyFiltersAndSearch(); 
}

function clearAllFavorites() {
    const lang = translations[currentLang];
    if (confirm(lang.confirmClearFavs)) {
        clearAllFavoritesData();
        applyFiltersAndSearch();
    }
}

function callGetUniqueTagsPool() {
    return getAllUniqueTagsPool(globalVideos);
}

async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
        const select = document.getElementById('form-instructor-select');
        select.innerHTML = '';
        instructors.forEach(ins => {
            const opt = document.createElement('option');
            opt.value = ins.id;
            opt.innerText = ins.name;
            select.appendChild(opt);
        });
        callUpdateSmartAssistant();
    } catch (err) {
        console.error("Eğitmenler yüklenemedi:", err);
    }
}

async function fetchVideos() {
    try {
        globalVideos = await dbFetchVideos();
        applyFiltersAndSearch();
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `
            <div class="info-msg" style="color: #ef4444;">
                ${translations[currentLang].error}
            </div>`;
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
    document.getElementById('form-video-url').value = video.url;
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    
    formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    renderFormChips();

    document.getElementById('form-is-downloaded').checked = video.is_downloaded;
    const driveUrlContainer = document.getElementById('drive-url-container');
    if (video.is_downloaded) {
        driveUrlContainer.classList.remove('d-none');
        document.getElementById('form-drive-url').value = video.drive_url || '';
        document.getElementById('form-drive-url').required = true;
    } else {
        driveUrlContainer.classList.add('d-none');
        document.getElementById('form-drive-url').value = '';
        document.getElementById('form-drive-url').required = false;
    }

    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        imgPreview.src = video.cover_url;
        imgPreview.classList.remove('d-none');
        if (dropAreaText) dropAreaText.classList.add('d-none');
    } else {
        imgPreview.classList.add('d-none');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
    }
    callUpdateSmartAssistant();
}

async function deleteVideoFlow(videoId) {
    const lang = translations[currentLang];
    if (!confirm(lang.confirmDeleteVideo)) return;

    try {
        await dbDeleteVideo(videoId);
        alert(lang.successDeleteVideo);
        removeFavoriteDirectly(videoId);
        await fetchVideos();
    } catch (err) {
        console.error(err);
        alert("Silme işlemi sırasında hata oluştu!");
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
    const favs = getFavorites();
    // Filtreleme işini yeni modülümüze delege ediyoruz
    const filtered = getFilteredVideos(globalVideos, currentView, favs);

    renderVideoCards(filtered, {
        currentLang,
        currentView,
        translations,
        favs,
        toggleFavorite,
        openTagsEditModal: (video) => openTagsEditModal(video, globalVideos, applyFiltersAndSearch),
        startVideoEditFlow,
        deleteVideoFlow,
        openVideoModal
    });
}

async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
    const name = input.value.trim();
    const lang = translations[currentLang];

    if (!name) {
        alert(lang.insAlert);
        return;
    }

    try {
        await dbSaveInstructor(editInstructorId, name);
        alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
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
    if (!select.value) return;

    const lang = translations[currentLang];
    if (!confirm(lang.deleteConfirm)) return;

    try {
        await dbDeleteInstructor(select.value);
        alert(lang.insDeleteSuccess);
        await fetchInstructors();
        await fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

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
        alert("Lütfen önce bir eğitmen seçin veya ekleyin!");
        return;
    }

    const payload = {
        instructor_id: parseInt(instructor_id),
        url,
        role_type,
        partner_name: partner_name || null,
        tags: tags || null,
        is_downloaded,
        drive_url: is_downloaded && drive_url ? drive_url : null,
        cover_url
    };

    try {
        await dbSaveVideo(editingVideoId, payload);
        alert(editingVideoId ? lang.successUpdate : lang.successSave);
        
        editingVideoId = null;
        formTagsArray = [];
        renderFormChips();
        document.getElementById('add-video-form').reset();
        
        if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
        const dropAreaText = document.getElementById('drop-area-text');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
        
        document.getElementById('drive-url-container').classList.add('d-none');
        resetUploadedCoverUrl();
        
        callSwitchView('library');
        await fetchVideos();
    } catch (err) {
        console.error(err);
        alert("İşlem sırasında bir hata oluştu!");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        callUpdateInterfaceLanguage();
    });

    document.getElementById('menu-library').addEventListener('click', () => {
        editingVideoId = null;
        callSwitchView('library');
    });
    document.getElementById('menu-favorites').addEventListener('click', () => {
        editingVideoId = null;
        callSwitchView('favorites');
    });
    document.getElementById('menu-add-video').addEventListener('click', () => callSwitchView('add'));

    document.getElementById('btn-clear-favorites').addEventListener('click', clearAllFavorites);

    document.getElementById('form-is-downloaded').addEventListener('change', (e) => {
        const driveUrlContainer = document.getElementById('drive-url-container');
        if (e.target.checked) {
            driveUrlContainer.classList.remove('d-none');
            document.getElementById('form-drive-url').required = true;
        } else {
            driveUrlContainer.classList.add('d-none');
            document.getElementById('form-drive-url').required = false;
            document.getElementById('form-drive-url').value = '';
        }
    });

    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, renderFormChips, (newTag) => {
        formTagsArray.push(newTag);
        renderFormChips();
        callUpdateSmartAssistant();
    }, callGetUniqueTagsPool);

    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
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
        if (!select.value) return;
        editInstructorId = select.value;
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    });

    document.getElementById('btn-delete-instructor').addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor').addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form').addEventListener('submit', handleFormSubmit);
    
    document.getElementById('search-input').addEventListener('input', applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-btn').addEventListener('click', applyFiltersAndSearch);

    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    document.getElementById('tags-modal-close-btn').addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});