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
let formTags = [];
let visibleCount = 20;
let currentView = 'library'; 

// İzleme modülü entegrasyonu için window objesine bağlama
window.openVideoModal = openVideoModal;

async function initApp() {
    updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTags, applyFiltersAndSearch);
    await fetchInstructors();
    await fetchVideos();
    
    setupAutocomplete('form-tag-input', 'form-autocomplete-list', formTags, renderFormChips, (newTag) => {
        formTags.push(newTag);
        renderFormChips();
        updateSmartFilenameAssistant(currentLang, formTags);
    }, () => getAllUniqueTagsPool(globalVideos));
}

function renderFormChips() {
    renderChips('form-chips-container', formTags, (idx) => {
        formTags.splice(idx, 1);
        renderFormChips();
        updateSmartFilenameAssistant(currentLang, formTags);
    });
}

async function fetchInstructors() {
    try {
        const instructors = await dbFetchInstructors();
        const select = document.getElementById('form-instructor-select');
        if (select) {
            select.innerHTML = `<option value="">${currentLang === 'tr' ? '-- Eğitmen Seçin --' : '-- Select Instructor --'}</option>`;
            instructors.forEach(ins => {
                const opt = document.createElement('option');
                opt.value = ins.id;
                opt.innerText = ins.name;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchVideos() {
    try {
        globalVideos = await dbFetchVideos();
        try {
            globalFavorites = await dbFetchFavorites();
        } catch (e) {
            globalFavorites = [];
        }
        populateFilterDropdowns(globalVideos, currentLang);
        applyFiltersAndSearch();
    } catch (err) {
        console.error(err);
        const grid = document.getElementById('video-grid');
        if (grid) grid.innerHTML = `<div class="error-message">${translations[currentLang].error}</div>`;
    }
}

function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input')?.value || '';
    const roleVal = document.getElementById('filter-role-select')?.value || 'all';
    const insVal = document.getElementById('filter-instructor-select')?.value || 'all';
    const tagVal = document.getElementById('filter-tag-select')?.value || 'all';
    const dateVal = document.getElementById('filter-date-select')?.value || 'all';
    const locVal = document.getElementById('filter-location-select')?.value || 'all';

    let videosToDisplay = globalVideos;
    if (currentView === 'favorites') {
        videosToDisplay = globalVideos.filter(v => globalFavorites.some(f => f.video_id === v.id));
    }

    const filtered = getFilteredVideos(videosToDisplay, searchVal, roleVal, insVal, tagVal, dateVal, locVal, currentLang);
    
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (filtered.length <= visibleCount) {
        loadMoreBtn?.classList.add('d-none');
    } else {
        loadMoreBtn?.classList.remove('d-none');
    }

    const sliced = filtered.slice(0, visibleCount);
    renderVideoCards(currentView === 'favorites' ? 'video-grid' : 'video-grid', sliced, globalFavorites, currentLang);
}

function handleFilterChange() {
    visibleCount = 20; 
    applyFiltersAndSearch();
}

// OLAY DİNLEYİCİLERİ VE BAĞLANTILAR
document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Görünüm Menüleri Geçişleri
    document.getElementById('menu-library')?.addEventListener('click', (e) => {
        e.preventDefault();
        currentView = 'library';
        visibleCount = 20;
        switchView('library', { currentLang, editingVideoId }, { applyFiltersAndSearch });
    });

    document.getElementById('menu-favorites')?.addEventListener('click', (e) => {
        e.preventDefault();
        currentView = 'favorites';
        visibleCount = 20;
        switchView('favorites', { currentLang, editingVideoId }, { applyFiltersAndSearch });
    });

    document.getElementById('menu-add-video')?.addEventListener('click', (e) => {
        e.preventDefault();
        currentView = 'add';
        editingVideoId = null;
        switchView('add', { currentLang, editingVideoId, getFormTags: () => formTags, resetFormTags: () => formTags = [] }, { renderFormChips, resetUploadedCoverUrl });
    });

    // 🇬🇧 🇹🇷 Dil Değiştirme Aksiyonu (Tüm sorunları kökten çözen tetikleyici)
    document.getElementById('lang-btn')?.addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        
        // 1. Dinamik açılır kutu başlıklarını ve tarih formatlarını yeni dile göre güncelle
        populateFilterDropdowns(globalVideos, currentLang);
        
        // 2. Sayfadaki tüm statik etiketleri ve buton yazılarını çevir
        updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTags, applyFiltersAndSearch);
    });

    // Canlı Filtreleme Tetikleyicileri
    document.getElementById('search-input')?.addEventListener('input', applyFiltersAndSearch);
    document.getElementById('filter-role-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-instructor-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-tag-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-date-select')?.addEventListener('change', handleFilterChange);
    document.getElementById('filter-location-select')?.addEventListener('change', handleFilterChange);
    
    document.getElementById('filter-btn')?.addEventListener('click', () => {
        visibleCount = 20; 
        fetchVideos();
    });

    // Dahası Video Göster Butonu
    document.getElementById('btn-load-more')?.addEventListener('click', () => {
        visibleCount += 20;
        applyFiltersAndSearch();
    });

    // Modal Kapatma Arayüzleri
    document.getElementById('modal-close-btn')?.addEventListener('click', closeVideoModal);
    document.getElementById('video-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    document.getElementById('tags-modal-close-btn')?.addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    // Ctrl+V Görsel Yakalama Alanı
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('click', () => document.getElementById('form-file-input')?.click());
        window.addEventListener('paste', (e) => {
            const container = document.getElementById('view-add-container');
            if (container && !container.classList.contains('d-none')) {
                handlePasteEvent(e, currentLang);
            }
        });
    }

    // Form Değişiklik Asistanı Takibi
    document.getElementById('form-instructor-select')?.addEventListener('change', () => updateSmartFilenameAssistant(currentLang, formTags));

    // Video Kaydetme / Düzenleme Form Gönderimi
    document.getElementById('add-video-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const instructorId = document.getElementById('form-instructor-select').value;
        const partnerName = document.getElementById('form-partner-input').value.trim();
        const roleType = document.getElementById('form-role-select').value;
        const urlInput = document.getElementById('form-url-input').value.trim();
        
        if (!instructorId) {
            alert(translations[currentLang].insAlert);
            return;
        }

        const isDrive = urlInput.includes('drive.google.com');
        const coverUrl = getUploadedCoverUrl();

        const videoData = {
            instructor_id: instructorId,
            partner_name: partnerName,
            role_type: roleType,
            tags: formTags.join(', '),
            cover_url: coverUrl,
            is_downloaded: isDrive
        };

        if (isDrive) {
            videoData.drive_url = urlInput;
            videoData.url = '';
        } else {
            videoData.url = urlInput;
            videoData.drive_url = '';
        }

        if (editingVideoId) {
            videoData.id = editingVideoId;
        }

        try {
            await dbSaveVideo(videoData);
            showCustomAlert(editingVideoId ? (currentLang === 'tr' ? '🎉 Video başarıyla güncellendi!' : '🎉 Video successfully updated!') : (currentLang === 'tr' ? '🎉 Video başarıyla eklendi!' : '🎉 Video successfully added!'));
            editingVideoId = null;
            resetUploadedCoverUrl();
            formTags = [];
            document.getElementById('add-video-form').reset();
            currentView = 'library';
            switchView('library', { currentLang, editingVideoId }, { applyFiltersAndSearch });
            await fetchVideos();
        } catch (err) {
            console.error(err);
        }
    });

    // Eğitmen Ekleme Form Gönderimi
    document.getElementById('add-instructor-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputName = document.getElementById('new-instructor-name');
        const name = inputName.value.trim();
        if (!name) {
            alert(translations[currentLang].insAlert);
            return;
        }
        try {
            await dbSaveInstructor({ name, id: editInstructorId });
            showCustomAlert(editInstructorId ? translations[currentLang].insUpdateSuccess : translations[currentLang].insSuccess);
            editInstructorId = null;
            inputName.value = '';
            const btnAddIns = document.getElementById('btn-add-instructor');
            if (btnAddIns) btnAddIns.innerText = translations[currentLang].btnAddIns;
            await fetchInstructors();
            await fetchVideos();
        } catch (err) {
            console.error(err);
        }
    });

    // Pratik Listesini Toplu Temizleme
    document.getElementById('btn-clear-favorites')?.addEventListener('click', async () => {
        const confirmClear = await showCustomConfirm(translations[currentLang].confirmClearFavs);
        if (confirmClear) {
            try {
                await dbClearAllFavorites();
                await fetchVideos();
            } catch (err) {
                console.error(err);
            }
        }
    });

    // Kart Üzerindeki Delegasyon Yönetimi (Favori, Düzenle, Sil, Anlık Etiket)
    const videoGrid = document.getElementById('video-grid');
    videoGrid?.addEventListener('click', async (e) => {
        const target = e.target;
        
        // 1. Yıldız Butonu (Favori Ekle / Sil)
        const favBtn = target.closest('.fav-star-btn');
        if (favBtn) {
            const videoId = favBtn.getAttribute('data-id');
            const isFav = favBtn.classList.contains('active');
            try {
                if (isFav) {
                    await dbRemoveFavorite(videoId);
                } else {
                    await dbAddFavorite(videoId);
                }
                await fetchVideos();
            } catch (err) {
                console.error(err);
            }
            return;
        }

        // 2. Silme Butonu
        const deleteBtn = target.closest('.btn-card-delete');
        if (deleteBtn) {
            const videoId = deleteBtn.getAttribute('data-id');
            const confirmDec = await showCustomConfirm(translations[currentLang].confirmDeleteVideo);
            if (confirmDec) {
                try {
                    await dbDeleteVideo(videoId);
                    showCustomAlert(translations[currentLang].successDeleteVideo);
                    await fetchVideos();
                } catch (err) {
                    console.error(err);
                }
            }
            return;
        }

        // 3. Düzenleme Butonu
        const editBtn = target.closest('.btn-card-edit');
        if (editBtn) {
            const videoId = editBtn.getAttribute('data-id');
            const videoToEdit = globalVideos.find(v => v.id == videoId);
            if (videoToEdit) {
                editingVideoId = videoId;
                currentView = 'add';
                switchView('add', { editingVideoId, currentLang, getFormTags: () => formTags, resetFormTags: () => formTags = [] }, { renderFormChips });
                
                document.getElementById('form-instructor-select').value = videoToEdit.instructor_id || '';
                document.getElementById('form-partner-input').value = videoToEdit.partner_name || '';
                document.getElementById('form-role-select').value = videoToEdit.role_type || 'both';
                document.getElementById('form-url-input').value = videoToEdit.url || videoToEdit.drive_url || '';
                
                formTags = videoToEdit.tags ? videoToEdit.tags.split(',').map(t => t.trim()) : [];
                renderFormChips();
                
                const imgPreview = document.getElementById('image-preview');
                const dropAreaText = document.getElementById('drop-area-text');
                if (videoToEdit.cover_url) {
                    if (imgPreview) {
                        imgPreview.src = videoToEdit.cover_url;
                        imgPreview.classList.remove('d-none');
                    }
                    if (dropAreaText) dropAreaText.classList.add('d-none');
                } else {
                    if (imgPreview) imgPreview.classList.add('d-none');
                    if (dropAreaText) dropAreaText.classList.remove('d-none');
                }
                updateSmartFilenameAssistant(currentLang, formTags);
            }
            return;
        }

        // 4. Anlık Etiket Düzenleme Pop-up Butonu
        const editTagsBtn = target.closest('.inline-edit-tags-btn');
        if (editTagsBtn) {
            const videoId = editTagsBtn.getAttribute('data-id');
            openTagsEditModal(videoId, globalVideos, () => fetchVideos());
            return;
        }
    });
});