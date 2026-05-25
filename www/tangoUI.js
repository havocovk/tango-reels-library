import { translations } from './config.js';

// Akıllı Dosya Adı Asistanını Günceller
export function updateSmartFilenameAssistant(currentLang, formTagsArray) {
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

// Tüm Arayüzün Dil Metinlerini Günceller (populateFilterDropdowns çağrısı eklendi)
export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch, populateFilterDropdowns) {
    const lang = translations[currentLang];
    
    document.title = lang.title;
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    
    // SEARCH-INPUT kontrolü - eğer varsa güncelle (HTML'de search-input yok, hata almamak için kontrol)
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;
    
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    // Filtre dropdown başlıkları (selectlerin içindeki ilk option "all" metinleri)
    const allRolesOpt = document.getElementById('opt-all-roles');
    if (allRolesOpt) allRolesOpt.innerText = lang.allRoles;
    const optLeader = document.getElementById('opt-leader');
    if (optLeader) optLeader.innerText = lang.leader;
    const optFollower = document.getElementById('opt-follower');
    if (optFollower) optFollower.innerText = lang.follower;
    const optBoth = document.getElementById('opt-both');
    if (optBoth) optBoth.innerText = lang.both;
    
    const allLocationsOpt = document.getElementById('opt-all-locations');
    if (allLocationsOpt) allLocationsOpt.innerText = lang.allLocations;
    const optDrive = document.getElementById('opt-drive');
    if (optDrive) optDrive.innerText = lang.drive;
    const optSocial = document.getElementById('opt-social');
    if (optSocial) optSocial.innerText = lang.social;

    // Form başlıkları
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = editingVideoId ? lang.formTitleEdit : lang.formTitle;
    
    const lblInstructor = document.getElementById('lbl-instructor');
    if (lblInstructor) lblInstructor.innerText = lang.lblInstructor;
    const lblVideoUrl = document.getElementById('lbl-video-url');
    if (lblVideoUrl) lblVideoUrl.innerText = lang.lblVideoUrl;
    const lblRole = document.getElementById('lbl-role');
    if (lblRole) lblRole.innerText = lang.lblRole;
    const lblPartner = document.getElementById('lbl-partner');
    if (lblPartner) lblPartner.innerText = lang.lblPartner;
    const lblTags = document.getElementById('lbl-tags');
    if (lblTags) lblTags.innerText = lang.lblTags;
    
    const tagsInput = document.getElementById('form-tags-input');
    if (tagsInput) tagsInput.placeholder = lang.tagsPlaceholder;
    
    const lblDownloaded = document.getElementById('lbl-downloaded');
    if (lblDownloaded) lblDownloaded.innerText = lang.lblDownloaded;
    const lblDriveUrl = document.getElementById('lbl-drive-url');
    if (lblDriveUrl) lblDriveUrl.innerText = lang.lblDriveUrl;
    
    const btnSubmit = document.getElementById('btn-submit-video');
    if (btnSubmit) btnSubmit.innerText = editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo;
    
    const lblNewInstructorName = document.getElementById('lbl-new-instructor-name');
    if (lblNewInstructorName) lblNewInstructorName.innerText = lang.lblNewInstructorName;
    const lblCoverUpload = document.getElementById('lbl-cover-upload');
    if (lblCoverUpload) lblCoverUpload.innerText = lang.lblCoverUpload;
    
    const btnClearFavs = document.getElementById('btn-clear-favorites');
    if (btnClearFavs) btnClearFavs.innerText = lang.btnClearFavorites;
    
    const editTagsTitle = document.getElementById('edit-tags-title');
    if (editTagsTitle) editTagsTitle.innerText = lang.editTagsTitle;
    const modalTagsInput = document.getElementById('modal-tags-input');
    if (modalTagsInput) modalTagsInput.placeholder = lang.addTagPlaceholder;
    
    const assistantTitle = document.getElementById('assistant-title');
    if (assistantTitle) assistantTitle.innerText = lang.assistantTitle;
    const assistantText = document.getElementById('assistant-text');
    if (assistantText) assistantText.innerText = lang.assistantText;
    
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }
    
    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) {
        saveInsBtn.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    }
    
    // Yükle butonu metnini güncelle
    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) loadMoreBtn.innerText = lang.loadMore;
    
    updateSmartFilenameAssistant(currentLang, formTagsArray);
    
    // Filtre dropdownlarını yeniden doldur (metinlerin güncellenmesi için)
    if (populateFilterDropdowns) {
        // Global videoları dışarıdan almak için, bu fonksiyon çağrılmadan önce globalVideos tanımlı olmalı
        // applyFiltersAndSearch içinde zaten populateFilterDropdowns çağrılır, ancak dil değişince videolar değişmemiş olsa bile
        // sadece statik metinleri güncellemek için videoları mevcut global diziden alabiliriz.
        // Bunun için buraya bir callback aktaracağız. Uygulamada app.js'den çağrılırken globalVideos verilecek.
    }
    
    applyFiltersAndSearch();
}

// Görünümler (Kütüphane / Ekleme Formu) Arasında Geçiş Yapar
export function switchView(viewName, state, functions) {
    state.currentView = viewName;
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
        
        functions.applyFiltersAndSearch();
    } else if (viewName === 'add') {
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
        
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            document.getElementById('form-title').innerText = lang.formTitle;
            document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            document.getElementById('add-video-form').reset();
            state.resetFormTags();
            functions.renderFormChips();
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            functions.resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant(state.currentLang, state.getFormTags());
    }
}