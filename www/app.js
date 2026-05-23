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
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch,
        renderFormChips,
        resetUploadedCoverUrl
    });
    updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch);
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
        const instructors = await dbFetchInstructors() || [];
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
        const instructors = await dbFetchInstructors() || [];
        const rawVideos = await dbFetchVideos() || [];
        
        try {
            const favRows = await dbFetchFavorites();
            globalFavorites = Array.isArray(favRows) ? favRows.map(f => f.video_id) : [];
        } catch (favErr) {
            console.error("Favoriler çekilemedi:", favErr);
            globalFavorites = [];
        }
        
        // 🛡️ CRITICAL FIX: Verileri haritalarken hem yeni 'instructor_name' alanını 
        // hem de diger modüllerin bekledigi 'video.instructors.name' nesne yapısını koruma altına alıyoruz.
        globalVideos = Array.isArray(rawVideos) ? rawVideos.map(video => {
            const foundInstructor = instructors.find(ins => ins.id === video.instructor_id);
            const instructorName = foundInstructor ? foundInstructor.name : 'Bilinmeyen Eğitmen';
            return {
                ...video,
                instructor_name: instructorName,
                instructors: video.instructors ? video.instructors : { name: instructorName }
            };
        }) : [];

        populateFilterDropdowns(globalVideos);
        updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch);
    } catch (err) {
        console.error("Yükleme sırasında hata oluştu (Detay):", err);
        const grid = document.getElementById('video-grid');
        if (grid) {
            const errMsg = translations && translations[currentLang] && translations[currentLang].error 
                ? translations[currentLang].error 
                : (currentLang === 'tr' ? "Veritabanı yükleme hatası!" : "Database load error!");
            grid.innerHTML = `<div class="info-msg" style="color: #ef4444;">${errMsg}</div>`;
        }
    }
}

function startVideoEditFlow(video) {
    editingVideoId = video.id;
    callSwitchView('add'); 

    const insSelect = document.getElementById('form-instructor-select');
    if (insSelect) insSelect.value = video.instructor_id;

    const vidUrl = document.getElementById('form-video-url');
    if (vidUrl) vidUrl.value = video.url;

    const roleSelect = document.getElementById('form-role-select');
    if (roleSelect) roleSelect.value = video.role_type || 'Both';

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
        if (dropAreaText) dropAreaText.classList.remove('d-none');
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
    const favs = globalFavorites || [];
    let kaynakVideolar = globalVideos || [];
    if (currentView === 'favorites') {
        kaynakVideolar = kaynakVideolar.filter(v => favs.includes(v.id));
    }

    const secilenFiltreler = {
        aramaMetni: document.getElementById('search-input')?.value || '', 
        rol: document.getElementById('filter-role-select')?.value || 'all',
        egitmen: document.getElementById('filter-instructor-select')?.value || 'all',
        etiket: document.getElementById('filter-tag-select')?.value || 'all',
        tarih: document.getElementById('filter-date-select')?.value || 'all',
        ortam: document.getElementById('filter-location-select')?.value || 'all'
    };

    // 🛡️ UI Çizim Koruyucu: Filtreleme veya kart basma esnasında bir hata olursa ana akış kopmaz.
    try {
        const filtered = getFilteredVideos(kaynakVideolar, secilenFiltreler);

        renderVideoCards(filtered, {
            currentLang,
            currentView,
            translations,
            favs,
            toggleFavorite,
            openTagsEditModal: (video) => openTagsEditModal(video, globalVideos, () => { applyFiltersAndSearch(); }),
            startVideoEditFlow,
            deleteVideoFlow,
            openVideoModal
        });
    } catch (filterErr) {
        console.error("Filtreleme veya Kart Arayüzü Çizilirken Hata Yakalandı:", filterErr);
    }
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
        
        const btnSave = document.getElementById('btn-save-instructor');
        if (btnSave) btnSave.innerText = lang.btnAddIns;
        
        document.getElementById('new-instructor-container')?.classList.add('d-none');
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

    const instructorSelect = document.getElementById('form-instructor-select');
    const videoUrlInput = document.getElementById('form-video-url');
    const roleSelect = document.getElementById('form-role-select');
    const partnerNameInput = document.getElementById('form-partner-name');
    const isDownloadedInput = document.getElementById('form-is-downloaded');
    const driveUrlInput = document.getElementById('form-drive-url');

    const instructor_id = instructorSelect ? instructorSelect.value : '';
    const url = videoUrlInput ? videoUrlInput.value.trim() : '';
    const role_type = roleSelect ? roleSelect.value : 'Both';
    const partner_name = partnerNameInput ? partnerNameInput.value.trim() : '';
    const tags = formTagsArray.join(', ');
    const is_downloaded = isDownloadedInput ? isDownloadedInput.checked : false;
    const drive_url = driveUrlInput ? driveUrlInput.value.trim() : '';
    
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && editingVideoId) {
        const currentVid = globalVideos.find(v => v.id === editingVideoId);
        if (currentVid) cover_url = currentVid.cover_url;
    }

    if (!instructor_id) {
        await showCustomAlert(currentLang === 'tr' ? "Lütfen önce bir eğitmen seçin!" : "Please select an instructor first!", okTxt);
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
        await showCustomAlert(editingVideoId ? lang.successUpdate : lang.successSave, okTxt);
        
        editingVideoId = null;
        formTagsArray = [];
        
        document.getElementById('add-video-form')?.reset();
        if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
        if (document.getElementById('drop-area-text')) document.getElementById('drop-area-text').classList.remove('d-none');
        if (document.getElementById('drive-url-container')) document.getElementById('drive-url-container').classList.add('d-none');
        
        resetUploadedCoverUrl();
        renderFormChips();
        
        callSwitchView('library');
        await fetchVideos();
    } catch (err) {
        console.error("Kayıt işlemi hatası:", err);
        await showCustomAlert(currentLang === 'tr' ? "Kayıt sırasında bir hata oluştu!" : "An error occurred during saving!", okTxt);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();

    document.getElementById('lang-toggle-btn')?.addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        callUpdateInterfaceLanguage();
    });

    document.getElementById('menu-library')?.addEventListener('click', () => { editingVideoId = null; callSwitchView('library'); });
    document.getElementById('menu-favorites')?.addEventListener('click', () => { editingVideoId = null; callSwitchView('favorites'); });
    document.getElementById('menu-add-video')?.addEventListener('click', () => callSwitchView('add'));
    document.getElementById('btn-clear-favorites')?.addEventListener('click', clearAllFavorites);

    document.getElementById('search-input')?.addEventListener('input', applyFiltersAndSearch);

    document.getElementById('form-is-downloaded')?.addEventListener('change', (e) => {
        const driveUrlContainer = document.getElementById('drive-url-container');
        if (driveUrlContainer) {
            if (e.target.checked) {
                driveUrlContainer.classList.remove('d-none');
                if (document.getElementById('form-drive-url')) document.getElementById('form-drive-url').required = true;
            } else {
                driveUrlContainer.classList.add('d-none');
                if (document.getElementById('form-drive-url')) {
                    document.getElementById('form-drive-url').required = false;
                    document.getElementById('form-drive-url').value = '';
                }
            }
        }
    });

    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, renderFormChips, (newTag) => {
        formTagsArray.push(newTag);
        renderFormChips();
        callUpdateSmartAssistant();
    }, callGetUniqueTagsPool);

    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, () => {}, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly(globalVideos, () => { applyFiltersAndSearch(); });
    }, callGetUniqueTagsPool);

    document.getElementById('form-instructor-select')?.addEventListener('change', callUpdateSmartAssistant);

    document.getElementById('btn-toggle-new-instructor')?.addEventListener('click', () => {
        editInstructorId = null;
        if (document.getElementById('form-new-instructor-input')) document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('new-instructor-container')?.classList.toggle('d-none');
    });

    document.getElementById('btn-edit-instructor')?.addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select || !select.value) return;
        editInstructorId = select.value;
        if (document.getElementById('form-new-instructor-input')) {
            document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        }
        document.getElementById('new-instructor-container')?.classList.remove('d-none');
    });

    document.getElementById('btn-delete-instructor')?.addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor')?.addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form')?.addEventListener('submit', handleFormSubmit);
    
    const filterIds = ['filter-role-select', 'filter-instructor-select', 'filter-tag-select', 'filter-date-select', 'filter-location-select'];
    filterIds.forEach(id => document.getElementById(id)?.addEventListener('change', applyFiltersAndSearch));
    
    document.getElementById('filter-btn')?.addEventListener('click', fetchVideos);
    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => { if (e.target.id === 'video-modal') closeVideoModal(); });
    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});