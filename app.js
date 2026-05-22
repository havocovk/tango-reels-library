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
    modalTagsArray,
    showCustomAlert,
    showCustomConfirm
} from './tangoModals.js';
import { 
    updateSmartFilenameAssistant, 
    updateInterfaceLanguage, 
    switchView 
} from './tangoUI.js';

// ⚙️ Filtre modülümüzden süzme fonksiyonunu ve sepet doldurucuyu içeri alıyoruz
import { 
    getFilteredVideos, 
    getAllUniqueTagsPool,
    populateFilterDropdowns
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
    currentView = viewName; 
    switchView(viewName, getUIState(), {
        applyFiltersAndSearch,
        renderFormChips,
        resetUploadedCoverUrl
    });
    applyFiltersAndSearch();
}

function toggleFavorite(videoId) {
    addOrRemoveFavorite(videoId);
    applyFiltersAndSearch(); 
}

function clearAllFavorites() {
    const lang = translations[currentLang];
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelTxt = currentLang === 'tr' ? 'İptal' : 'Cancel';
    
    showCustomConfirm(lang.confirmClearFavs, okTxt, cancelTxt).then(confirmed => {
        if (confirmed) {
            clearAllFavoritesData();
            applyFiltersAndSearch();
        }
    });
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

/**
 * 🔄 SİHİRLİ GÜNCELLEME: Hem Eğitmen İsimlerini Eşleştirir Hem de Kutuları Taze Tutar
 */
async function fetchVideos() {
    try {
        // 1. Önce veritabanındaki güncel eğitmen listesini isimleriyle çekiyoruz
        const instructors = await dbFetchInstructors();
        
        // 2. Veritabanındaki ham videoları çekiyoruz
        const rawVideos = await dbFetchVideos();
        
        // 3. Videolardaki ID numaralarına bakarak isimleri eşleştiriyoruz
        globalVideos = rawVideos.map(video => {
            const foundInstructor = instructors.find(ins => ins.id === video.instructor_id);
            return {
                ...video,
                instructor_name: foundInstructor ? foundInstructor.name : 'Bilinmeyen Eğitmen'
            };
        });

        // 4. Şimdi yenilenmiş listeyi süzgeç kutularına gönderiyoruz
        populateFilterDropdowns(globalVideos);
        
        // 5. Videoları ekrana çiziyoruz
        applyFiltersAndSearch();
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `
            <div class="info-msg" style="color: #ef4444;">
                ${translations[currentLang].error}
            </div>`;
        console.error("Filtreleme veya yükleme hatası detayları:", err);
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
    const okTxt = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelTxt = currentLang === 'tr' ? 'İptal' : 'Cancel';

    if (!await showCustomConfirm(lang.confirmDeleteVideo, okTxt, cancelTxt)) return;

    try {
        await dbDeleteVideo(videoId);
        await showCustomAlert(lang.successDeleteVideo, okTxt);
        removeFavoriteDirectly(videoId);
        await fetchVideos();
    } catch (err) {
        console.error(err);
        await showCustomAlert(currentLang === 'tr' ? "Silme işlemi sırasında hata oluştu!" : "An error occurred during deletion!", okTxt);
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
    
    let kaynakVideolar = globalVideos;
    if (currentView === 'favorites') {
        kaynakVideolar = globalVideos.filter(v => favs.includes(v.id));
    }

    const secilenFiltreler = {
        aramaMetni: document.getElementById('search-input')?.value || '',
        rol: document.getElementById('filter-role-select')?.value || 'all',
        egitmen: document.getElementById('filter-instructor-select')?.value || 'all',
        etiket: document.getElementById('filter-tag-select')?.value || 'all',
        tarih: document.getElementById('filter-date-select')?.value || 'all',
        ortam: document.getElementById('filter-location-select')?.value || 'all'
    };

    const filtered = getFilteredVideos(kaynakVideolar, secilenFiltreler);

    renderVideoCards(filtered, {
        currentLang,
        currentView,
        translations,
        favs,
        toggleFavorite,
        openTagsEditModal: (video) => openTagsEditModal(video, globalVideos, fetchVideos),
        startVideoEditFlow,
        deleteVideoFlow,
        openVideoModal
    });
}

async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
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
    if (!select.value) return;

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
        await showCustomAlert(currentLang === 'tr' ? "Lütfen önce bir eğitmen seçin veya ekleyin!" : "Please select or add an instructor first!", okTxt);
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
        await showCustomAlert(currentLang === 'tr' ? "İşlem sırasında bir hata oluştu!" : "An error occurred during the operation!", okTxt);
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
    document.getElementById('filter-instructor-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-tag-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-date-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', applyFiltersAndSearch);
    
    document.getElementById('filter-btn').addEventListener('click', fetchVideos);

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