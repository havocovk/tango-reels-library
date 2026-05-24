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
    dbClearAllFavorites
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
    saveTagsToSupabaseDirectly
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

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = []; 
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 
let visibleCount = 20; 

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
    currentView = viewName; 
    visibleCount = 20; 
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch,
        renderFormChips,
        resetUploadedCoverUrl
    });
    applyFiltersAndSearch();
}

function applyFiltersAndSearch() {
    const searchInput = document.getElementById('search-input');
    const query = searchInput ? searchInput.value.trim() : '';
    
    const rol = document.getElementById('filter-role-select')?.value || 'all';
    const egitmen = document.getElementById('filter-instructor-select')?.value || 'all';
    const etiket = document.getElementById('filter-tag-select')?.value || 'all';
    const tarih = document.getElementById('filter-date-select')?.value || 'all';
    const ortam = document.getElementById('filter-location-select')?.value || 'all';

    const filtered = getFilteredVideos(globalVideos, { query, rol, egitmen, etiket, tarih, ortam });
    
    const limitedVideos = filtered.slice(0, visibleCount);
    
    renderVideoCards(limitedVideos, {
        currentLang,
        currentView,
        translations,
        favs: globalFavorites,
        toggleFavorite,
        openTagsEditModal: (id, tags) => openTagsEditModal(id, tags, applyFiltersAndSearch),
        startVideoEditFlow,
        deleteVideoFlow,
        openVideoModal
    });

    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) {
        if (filtered.length > visibleCount) {
            loadMoreBtn.classList.remove('d-none');
        } else {
            loadMoreBtn.classList.add('d-none');
        }
    }
}

function handleFilterChange() {
    visibleCount = 20; 
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

function renderFormChips() {
    renderChips('form-tags-chips-container', formTagsArray, (index) => {
        formTagsArray.splice(index, 1);
        renderFormChips();
        callUpdateSmartAssistant();
    });
}

async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
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

async function fetchVideos() {
    try {
        const instructors = await dbFetchInstructors();
        const rawVideos = await dbFetchVideos();
        
        try {
            const favRows = await dbFetchFavorites();
            globalFavorites = favRows.map(f => f.video_id);
        } catch (favErr) {
            console.error("Favoriler çekilemedi, liste sıfırlanıyor:", favErr);
            globalFavorites = [];
        }
        
        globalVideos = rawVideos.map(video => {
            const foundInstructor = instructors.find(ins => ins.id === video.instructor_id);
            return {
                ...video,
                instructor_name: foundInstructor ? foundInstructor.name : 'Bilinmeyen Eğitmen'
            };
        });

        populateFilterDropdowns(globalVideos);
        applyFiltersAndSearch();
    } catch (err) {
        const grid = document.getElementById('video-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="info-msg" style="color: #ef4444;">
                    ${translations[currentLang].error}
                </div>`;
        }
        console.error("Filtreleme veya yükleme hatası detayları:", err);
    }
}

function startVideoEditFlow(video) {
    editingVideoId = video.id;
    callSwitchView('add'); 

    const lang = translations[currentLang];
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = lang.formTitleEdit;
    
    const btnSubmit = document.getElementById('btn-submit-video');
    if (btnSubmit) btnSubmit.innerText = lang.btnUpdateVideo;

    const insSelect = document.getElementById('form-instructor-select');
    if (insSelect) insSelect.value = video.instructor_id;

    const vidUrl = document.getElementById('form-video-url');
    if (vidUrl) vidUrl.value = video.url;

    const roleSelect = document.getElementById('form-role-select');
    if (roleSelect) roleSelect.value = video.role_type || 'Couple';

    const partnerName = document.getElementById('form-partner-name');
    if (partnerName) partnerName.value = video.partner_name || '';

    formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    renderFormChips();

    const isDownloaded = document.getElementById('form-is-downloaded');
    if (isDownloaded) isDownloaded.checked = video.is_downloaded;

    const driveUrlContainer = document.getElementById('drive-url-container');
    const driveUrlInput = document.getElementById('form-drive-url');
    if (video.is_downloaded) {
        if (driveUrlContainer) driveUrlContainer.classList.remove('d-none');
        if (driveUrlInput) {
            driveUrlInput.value = video.drive_url || '';
            driveUrlInput.required = true;
        }
    } else {
        if (driveUrlContainer) driveUrlContainer.classList.add('d-none');
        if (driveUrlInput) {
            driveUrlInput.value = '';
            driveUrlInput.required = false;
        }
    }

    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        if (imgPreview) {
            imgPreview.src = video.cover_url;
            imgPreview.classList.remove('d-none');
        }
        if (dropAreaText) dropAreaText.classList.add('d-none');
    } else {
        if (imgPreview) imgPreview.classList.add('d-none');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
    }
    callUpdateSmartAssistant();
}

async function deleteVideoFlow(videoId) {
    const lang = translations[currentLang];
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelTxt = currentLang === 'tr' ? 'İptal' : 'Cancel';
    
    const confirmed = await showCustomConfirm(lang.confirmDeleteVideo, okTxt, cancelTxt);
    if (confirmed) {
        try {
            await dbDeleteVideo(videoId);
            showCustomAlert(lang.successDeleteVideo);
            fetchVideos();
        } catch (err) {
            console.error("Video silinirken hata oluştu:", err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchVideos();
    fetchInstructors();

    document.getElementById('menu-library')?.addEventListener('click', () => callSwitchView('library'));
    document.getElementById('menu-favorites')?.addEventListener('click', () => callSwitchView('favorites'));
    document.getElementById('menu-add-video')?.addEventListener('click', () => callSwitchView('add'));

    document.getElementById('lang-toggle-btn')?.addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        callUpdateInterfaceLanguage();
        applyFiltersAndSearch();
    });

    document.getElementById('search-input')?.addEventListener('input', applyFiltersAndSearch);

    document.getElementById('filter-instructor-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-tag-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-date-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-location-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-role-select')?.addEventListener('change', handleFilterChange);
    
    document.getElementById('filter-btn')?.addEventListener('click', () => {
        visibleCount = 20; 
        fetchVideos();
    });

    document.getElementById('btn-load-more')?.addEventListener('click', () => {
        visibleCount += 20;
        applyFiltersAndSearch();
    });

    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('click', () => document.getElementById('form-cover-file')?.click());
        dropArea.addEventListener('dragover', (e) => e.preventDefault());
        dropArea.addEventListener('drop', (e) => e.preventDefault());
    }

    document.addEventListener('paste', async (e) => {
        if (currentView === 'add') {
            await handlePasteEvent(e, currentLang);
        }
    });

    setupAutocomplete(
        'form-tags-input',
        'form-autocomplete-list',
        formTagsArray,
        renderFormChips,
        (tag) => {
            if (!formTagsArray.includes(tag)) {
                formTagsArray.push(tag);
                renderFormChips();
                callUpdateSmartAssistant();
            }
        },
        callGetUniqueTagsPool
    );

    document.getElementById('form-instructor-select')?.addEventListener('change', callUpdateSmartAssistant);

    document.getElementById('form-is-downloaded')?.addEventListener('change', (e) => {
        const driveContainer = document.getElementById('drive-url-container');
        const driveInput = document.getElementById('form-drive-url');
        if (e.target.checked) {
            driveContainer?.classList.remove('d-none');
            if (driveInput) driveInput.required = true;
        } else {
            driveContainer?.classList.add('d-none');
            if (driveInput) {
                driveInput.value = '';
                driveInput.required = false;
            }
        }
    });

    document.getElementById('add-video-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const lang = translations[currentLang];
        
        const videoData = {
            instructor_id: document.getElementById('form-instructor-select').value,
            url: document.getElementById('form-video-url').value,
            role_type: document.getElementById('form-role-select').value,
            partner_name: document.getElementById('form-partner-name').value.trim(),
            tags: formTagsArray.join(', '),
            is_downloaded: document.getElementById('form-is-downloaded').checked,
            drive_url: document.getElementById('form-drive-url').value.trim(),
            cover_url: getUploadedCoverUrl()
        };

        try {
            await dbSaveVideo(editingVideoId, videoData);
            showCustomAlert(editingVideoId ? lang.videoUpdateSuccess : lang.videoSuccess);
            editingVideoId = null;
            callSwitchView('library');
            fetchVideos();
        } catch (err) {
            console.error("Video kaydedilirken hata:", err);
        }
    });
    
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);
});