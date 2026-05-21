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

// Yeni taşınan modal modülümüzü içeri alıyoruz
import { 
    openVideoModal, 
    closeVideoModal, 
    openTagsEditModal, 
    closeTagsEditModal,
    modalTagsArray,
    saveTagsToSupabaseDirectly
} from './tangoModals.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 

let formTagsArray = [];

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

function getAllUniqueTagsPool() {
    let pool = new Set();
    globalVideos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean) pool.add(clean);
            });
        }
    });
    return Array.from(pool);
}

function updateSmartFilenameAssistant() {
    const lang = translations[currentLang];
    const select = document.getElementById('form-instructor-select');
    const outputDiv = document.getElementById('assistant-filename-output');

    if (!select || !select.value || select.selectedIndex === -1) {
        if (outputDiv) outputDiv.innerText = lang.assistantAlert;
        return;
    }

    let instructorName = select.options[select.selectedIndex].text;
    let cleanName = instructorName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    let cleanTags = formTagsArray
        .map(t => t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''))
        .filter(t => t !== '')
        .join('_');

    let finalFilename = cleanName;
    if (cleanTags) {
        finalFilename += '_' + cleanTags;
    }
    finalFilename += '.mp4';

    if (outputDiv) outputDiv.innerText = finalFilename;
}

function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    
    document.title = lang.title;
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    document.getElementById('opt-all-roles').innerText = lang.allRoles;
    document.getElementById('opt-leader').innerText = lang.leader;
    document.getElementById('opt-follower').innerText = lang.follower;
    document.getElementById('opt-both').innerText = lang.both;
    document.getElementById('opt-all-locations').innerText = lang.allLocations;
    document.getElementById('opt-drive').innerText = lang.drive;
    document.getElementById('opt-social').innerText = lang.social;

    document.getElementById('form-title').innerText = editingVideoId ? lang.formTitleEdit : lang.formTitle;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-video-url').innerText = lang.lblVideoUrl;
    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-tags').innerText = lang.lblTags;
    document.getElementById('form-tags-input').placeholder = lang.tagsPlaceholder;
    document.getElementById('lbl-downloaded').innerText = lang.lblDownloaded;
    document.getElementById('lbl-drive-url').innerText = lang.lblDriveUrl;
    document.getElementById('btn-submit-video').innerText = editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    document.getElementById('btn-clear-favorites').innerText = lang.btnClearFavorites;
    document.getElementById('edit-tags-title').innerText = lang.editTagsTitle;
    document.getElementById('modal-tags-input').placeholder = lang.addTagPlaceholder;
    
    document.getElementById('assistant-title').innerText = lang.assistantTitle;
    document.getElementById('assistant-text').innerText = lang.assistantText;

    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }

    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) {
        saveInsBtn.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    }

    updateSmartFilenameAssistant();
    applyFiltersAndSearch();
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
        updateSmartFilenameAssistant();
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
    switchView('add'); 

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
    updateSmartFilenameAssistant();
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
        updateSmartFilenameAssistant();
    });
}

function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locationVal = document.getElementById('filter-location-select').value;
    const favs = getFavorites();

    const filtered = globalVideos.filter(video => {
        if (currentView === 'favorites' && !favs.includes(video.id)) {
            return false;
        }

        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const videoTags = video.tags ? video.tags.toLowerCase() : '';
        
        const matchesSearch = insName.includes(searchVal) || partnerName.includes(searchVal) || videoTags.includes(searchVal);
        const matchesRole = (roleVal === 'all') || (video.role_type === roleVal);
        
        let matchesLocation = true;
        if (locationVal === 'drive') {
            matchesLocation = (video.is_downloaded === true);
        } else if (locationVal === 'social') {
            matchesLocation = (video.is_downloaded === false || !video.is_downloaded);
        }

        return matchesSearch && matchesRole && matchesLocation;
    });

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
        
        document.getElementById('menu-library').click();
        await fetchVideos();
    } catch (err) {
        console.error(err);
        alert("İşlem sırasında bir hata oluştu!");
    }
}

function switchView(viewName) {
    currentView = viewName;
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

    const clearFavBtnContainer = document.getElementById('clear-favorites-container');

    if (viewName === 'library' || viewName === 'favorites') {
        document.getElementById('view-library-container').classList.remove('d-none');
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById(`menu-${viewName}`).classList.add('active');
        
        if (viewName === 'favorites') {
            clearFavBtnContainer.classList.remove('d-none');
        } else {
            clearFavBtnContainer.classList.add('d-none');
        }
        
        applyFiltersAndSearch();
    } else if (viewName === 'add') {
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
        
        if (!editingVideoId) {
            const lang = translations[currentLang];
            document.getElementById('form-title').innerText = lang.formTitle;
            document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            document.getElementById('add-video-form').reset();
            formTagsArray = [];
            renderFormChips();
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });

    document.getElementById('menu-library').addEventListener('click', () => {
        editingVideoId = null;
        switchView('library');
    });
    document.getElementById('menu-favorites').addEventListener('click', () => {
        editingVideoId = null;
        switchView('favorites');
    });
    document.getElementById('menu-add-video').addEventListener('click', () => switchView('add'));

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
        updateSmartFilenameAssistant();
    }, getAllUniqueTagsPool);

    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
    }, getAllUniqueTagsPool);

    document.getElementById('form-instructor-select').addEventListener('change', updateSmartFilenameAssistant);

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