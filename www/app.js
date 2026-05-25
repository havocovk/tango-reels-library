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
    closeVideoModal as closeTagsEditModal, // Dosyadaki isimlendirmeye göre eşitleme
    modalTagsArray,
    showCustomAlert,
    showCustomConfirm
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

// ⚡ GLOBAL UYGULAMA DURUMU (STATE)
let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = [];
let editInstructorId = null;
let editingVideoId = null;
let formTagsArray = [];
let visibleCount = 20;

// State'i alt modüllere aktarmak için paket nesneler
const appState = {
    get currentLang() { return currentLang; },
    set currentLang(val) { currentLang = val; },
    get editingVideoId() { return editingVideoId; },
    get currentView() { return window.currentView || 'library'; },
    set currentView(val) { window.currentView = val; },
    resetFormTags: () => { formTagsArray = []; },
    getFormTags: () => formTagsArray
};

const appFunctions = {
    applyFiltersAndSearch: applyFiltersAndSearch,
    renderFormChips: () => renderChips('form-tags-chips-container', formTagsArray, removeFormTag),
    resetUploadedCoverUrl: resetUploadedCoverUrl
};

// 📥 VERİTABANINDAN VERİLERİ ÇEKEN ANA MOTOR
async function fetchInstructors() {
    try {
        const data = await dbFetchInstructors();
        renderInstructorSelect(data);
        renderInstructorManagerList(data);
    } catch (err) {
        console.error(err);
    }
}

async function fetchVideos() {
    try {
        const loadingMsg = document.getElementById('video-grid');
        if (loadingMsg) loadingMsg.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#cbd5e1;">${translations[currentLang].loading}</div>`;
        
        globalVideos = await dbFetchVideos();
        populateFilterDropdowns(globalVideos);
        applyFiltersAndSearch();
    } catch (err) {
        console.error(err);
        const loadingMsg = document.getElementById('video-grid');
        if (loadingMsg) loadingMsg.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#ef4444;">${translations[currentLang].error}</div>`;
    }
}

async function fetchFavorites() {
    try {
        globalFavorites = await dbFetchFavorites();
    } catch (err) {
        console.error("Favoriler çekilemedi:", err);
    }
}

// 🎛️ FİLTRELEME VE EKRANA BASMA MOTORU
export function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input')?.value || '';
    const rol = document.getElementById('filter-role-select')?.value || 'all';
    const egitmen = document.getElementById('filter-instructor-select')?.value || 'all';
    const etiket = document.getElementById('filter-tag-select')?.value || 'all';
    const tarih = document.getElementById('filter-date-select')?.value || 'all';
    const ortam = document.getElementById('filter-location-select')?.value || 'all';

    let list = getFilteredVideos(globalVideos, searchVal, rol, egitmen, etiket, tarih, ortam);

    // Eğer favoriler görünümündeysek sadece favori listesinde olanları süz
    if (appState.currentView === 'favorites') {
        list = list.filter(v => globalFavorites.some(f => f.video_id === v.id));
    }

    // Sayfalama (Limit) Uygula
    const limitedList = list.slice(0, visibleCount);

    // "Daha Fazla Yükle" butonunun görünürlüğü
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) {
        if (list.length > visibleCount) {
            loadMoreBtn.classList.remove('d-none');
        } else {
            loadMoreBtn.classList.add('d-none');
        }
    }

    renderVideoCards(
        'video-grid',
        limitedList,
        globalFavorites,
        currentLang,
        openVideoModal,
        handleToggleFavorite,
        (id, tags) => openTagsEditModal(id, tags, fetchVideos),
        handleEditVideo,
        handleDeleteVideo
    );
}

// ⭐ FAVORİ EKLE / ÇIKAR YÖNETİMİ
async function handleToggleFavorite(videoId) {
    const isFav = globalFavorites.some(f => f.video_id === videoId);
    try {
        if (isFav) {
            await dbRemoveFavorite(videoId);
        } else {
            await dbAddFavorite(videoId);
        }
        await fetchFavorites();
        applyFiltersAndSearch();
    } catch (err) {
        alert("Favori işlemi başarısız oldu.");
    }
}

// 👤 EĞİTMEN SEÇİM KUTUSUNU DOLDURMA
function renderInstructorSelect(data) {
    const select = document.getElementById('form-instructor-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">-- ${translations[currentLang].lblSelectInstructor} --</option>`;
    data.forEach(ins => {
        select.innerHTML += `<option value="${ins.id}">${ins.name}</option>`;
    });
    if (currentVal) select.value = currentVal;
}

// 👤 EĞİTMEN YÖNETİM LİSTESİNİ BASMA
function renderInstructorManagerList(data) {
    const container = document.getElementById('instructor-manager-list');
    if (!container) return;
    container.innerHTML = '';
    data.forEach(ins => {
        const row = document.createElement('div');
        row.className = 'instructor-management-row';
        row.innerHTML = `
            <span class="instructor-row-name">${ins.name}</span>
            <div class="instructor-row-actions">
                <button class="btn-ins-edit" data-id="${ins.id}" data-name="${ins.name}">✏️</button>
                <button class="btn-ins-delete" data-id="${ins.id}">🗑️</button>
            </div>
        `;
        
        row.querySelector('.btn-ins-edit').addEventListener('click', () => {
            editInstructorId = ins.id;
            const input = document.getElementById('new-instructor-name');
            if (input) input.value = ins.name;
            const btn = document.getElementById('btn-add-instructor');
            if (btn) btn.innerText = translations[currentLang].btnUpdateIns;
        });

        row.querySelector('.btn-ins-delete').addEventListener('click', async () => {
            const confirmDel = await showCustomConfirm(translations[currentLang].deleteConfirm);
            if (confirmDel) {
                try {
                    await dbDeleteInstructor(ins.id);
                    await showCustomAlert(translations[currentLang].insDeleteSuccess);
                    fetchInstructors();
                    fetchVideos();
                } catch (err) {
                    alert("Eğitmen silinemedi.");
                }
            }
        });

        container.appendChild(row);
    });
}

// 🏷️ FORM ETİKET CHIP EKLEME / SİLME
function addFormTag(tag) {
    const clean = tag.trim();
    if (clean && !formTagsArray.includes(clean)) {
        formTagsArray.push(clean);
        renderChips('form-tags-chips-container', formTagsArray, removeFormTag);
        updateSmartFilenameAssistant(currentLang, formTagsArray);
    }
}

function removeFormTag(index) {
    formTagsArray.splice(index, 1);
    renderChips('form-tags-chips-container', formTagsArray, removeFormTag);
    updateSmartFilenameAssistant(currentLang, formTagsArray);
}

// 🎬 VİDEO DÜZENLEME MODUNA ALMA
function handleEditVideo(video) {
    editingVideoId = video.id;
    switchView('add', appState, appState, appFunctions);
    
    document.getElementById('form-title').innerText = translations[currentLang].btnUpdateVideo;
    document.getElementById('btn-submit-video').innerText = translations[currentLang].btnUpdateVideo;

    document.getElementById('form-instructor-select').value = video.instructor_id || '';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    document.getElementById('form-video-url').value = video.url || '';
    document.getElementById('form-role-type').value = video.role_type || 'Both';
    document.getElementById('form-location-type').value = video.is_downloaded ? 'Drive' : 'Social';

    if (video.tags) {
        formTagsArray = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
    } else {
        formTagsArray = [];
    }
    renderChips('form-tags-chips-container', formTagsArray, removeFormTag);

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
            dropAreaText.innerText = translations[currentLang].dropText;
            dropAreaText.classList.remove('d-none');
        }
    }
    updateSmartFilenameAssistant(currentLang, formTagsArray);
}

// 🗑️ VİDEO SİLME İŞLEMİ
async function handleDeleteVideo(videoId) {
    const confirmDel = await showCustomConfirm(translations[currentLang].confirmDeleteVideo);
    if (confirmDel) {
        try {
            await dbDeleteVideo(videoId);
            await showCustomAlert(translations[currentLang].successDeleteVideo);
            fetchVideos();
        } catch (err) {
            alert("Video silinirken hata oluştu.");
        }
    }
}

// 🔄 DİNAMİK LİSTE YENİLEME TETİKLEYİCİLERİ
function handleFilterChange() {
    visibleCount = 20; // Filtre değiştiğinde limiti sıfırla
    applyFiltersAndSearch();
}

// 🚀 UYGULAMA BAŞLANGICI VE EVENT LISTENERS
document.addEventListener('DOMContentLoaded', () => {
    // İlk verileri yükle
    fetchInstructors();
    fetchFavorites().then(() => fetchVideos());

    // 🌐 CRITICAL FIX: DİL DEĞİŞTİRME BUTONU EVENT LISTENER'I
    document.getElementById('lang-btn')?.addEventListener('click', () => {
        // Dili tersine çevir
        currentLang = (currentLang === 'tr') ? 'en' : 'tr';
        
        // 1. Arayüzün statik metinlerini korumalı şekilde güncelle
        updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch);
        
        // 2. Form asistanını ve kutuları yeni dile göre tazele
        updateSmartFilenameAssistant(currentLang, formTagsArray);
        dbFetchInstructors().then(data => {
            renderInstructorSelect(data);
            renderInstructorManagerList(data);
        });
    });

    // Görünüm Değiştirme Butonları
    document.getElementById('menu-library')?.addEventListener('click', () => switchView('library', appState, appFunctions));
    document.getElementById('menu-favorites')?.addEventListener('click', () => switchView('favorites', appState, appFunctions));
    document.getElementById('menu-add-video')?.addEventListener('click', () => switchView('add', appState, appFunctions));

    // Eğitmen Ekleme / Güncelleme Formu
    document.getElementById('btn-add-instructor')?.addEventListener('click', async () => {
        const input = document.getElementById('new-instructor-name');
        if (!input) return;
        const name = input.value.trim();

        if (!name) {
            alert(translations[currentLang].insAlert);
            return;
        }

        try {
            await dbSaveInstructor(name, editInstructorId);
            await showCustomAlert(editInstructorId ? translations[currentLang].insUpdateSuccess : translations[currentLang].insSuccess);
            input.value = '';
            editInstructorId = null;
            document.getElementById('btn-add-instructor').innerText = translations[currentLang].btnAddIns;
            fetchInstructors();
        } catch (err) {
            alert("Eğitmen kaydedilemedi.");
        }
    });

    // Otomatik Öneri (Autocomplete) Kurulumu
    setupAutocomplete(
        'form-video-tags-input',
        'form-autocomplete-list',
        formTagsArray,
        () => renderChips('form-tags-chips-container', formTagsArray, removeFormTag),
        addFormTag,
        getAllUniqueTagsPool
    );

    // Form Değişim Takipleri
    document.getElementById('form-instructor-select')?.addEventListener('change', () => updateSmartFilenameAssistant(currentLang, formTagsArray));

    // Video Kaydetme / Güncelleme Form Gönderimi
    document.getElementById('add-video-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const instructorId = document.getElementById('form-instructor-select').value;
        const partnerName = document.getElementById('form-partner-name').value.trim();
        const url = document.getElementById('form-video-url').value.trim();
        const roleType = document.getElementById('form-role-type').value;
        const locationType = document.getElementById('form-location-type').value;
        const uploadedCoverUrl = getUploadedCoverUrl();

        if (!instructorId || !url) {
            alert("Lütfen eğitmen ve video linki alanlarını doldurun!");
            return;
        }

        const videoPayload = {
            instructor_id: parseInt(instructorId),
            partner_name: partnerName || null,
            url: url,
            role_type: roleType,
            is_downloaded: (locationType === 'Drive'),
            tags: formTagsArray.join(','),
            cover_url: uploadedCoverUrl || null
        };

        try {
            await dbSaveVideo(videoPayload, editingVideoId);
            await showCustomAlert(editingVideoId ? "Video başarıyla güncellendi!" : "Video başarıyla kütüphaneye eklendi!");
            
            // Formu resetle ve kütüphaneye dön
            editingVideoId = null;
            document.getElementById('add-video-form').reset();
            formTagsArray = [];
            resetUploadedCoverUrl();
            
            switchView('library', appState, appFunctions);
            fetchVideos();
        } catch (err) {
            alert("Video veritabanına kaydedilirken hata oluştu.");
        }
    });

    // Düzenleme İptal Butonu
    document.getElementById('add-video-form')?.addEventListener('reset', () => {
        if (editingVideoId) {
            editingVideoId = null;
            switchView('library', appState, appFunctions);
        }
    });

    // Canlı Filtre Dinleyicileri
    document.getElementById('search-input')?.addEventListener('input', handleFilterChange);
    document.getElementById('filter-role-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-instructor-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-tag-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-date-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-location-select')?.addEventListener('change', handleFilterChange);

    // "Daha Fazla Video Yükle" Butonu
    document.getElementById('btn-load-more')?.addEventListener('click', () => {
        visibleCount += 20;
        applyFiltersAndSearch();
    });

    // Modalları Kapatma Tetikleyicileri
    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    // Sürükle-Bırak / Ctrl+V Kapak Resmi Dinleyicisi
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('click', () => {
            const mockInput = document.createElement('input');
            mockInput.type = 'file';
            mockInput.accept = 'image/*';
            mockInput.onchange = async (e) => {
                if (e.target.files && e.target.files[0]) {
                    const fakeEvent = {
                        clipboardData: {
                            items: [{
                                type: e.target.files[0].type,
                                getAsFile: () => e.target.files[0]
                            }]
                        }
                    };
                    await handlePasteEvent(fakeEvent, currentLang);
                }
            };
            mockInput.click();
        });
    }

    window.addEventListener('paste', async (e) => {
        // Sadece video ekleme görünümündeyken paste event'ini yakala
        if (appState.currentView === 'add') {
            await handlePasteEvent(e, currentLang);
        }
    });

    // Pratik listesini (favorileri) toplu temizleme butonu
    document.getElementById('btn-clear-favorites')?.addEventListener('click', async () => {
        const confirmClear = await showCustomConfirm(translations[currentLang].confirmClearFavs);
        if (confirmClear) {
            try {
                await dbClearAllFavorites();
                await fetchFavorites();
                applyFiltersAndSearch();
            } catch (err) {
                alert("Liste temizlenirken bir hata oluştu.");
            }
        }
    });
});