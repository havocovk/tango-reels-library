import { translations } from './config.js';

// Akıllı Dosya Adı Asistanını Günceller
export function updateSmartFilenameAssistant(currentLang, formTagsArray) {
    const lang = translations[currentLang];
    const select = document.getElementById('form-instructor-select');
    const outputDiv = document.getElementById('assistant-filename-output');

    if (!select || !select.value || select.selectedIndex === -1) {
        if (outputDiv && lang) outputDiv.innerText = lang.assistantAlert;
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

// Tüm Arayüzün Dil Metinlerini Günceller (Güvenli Hale Getirildi)
export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch) {
    const lang = translations[currentLang];
    if (!lang) return;
    
    document.title = lang.title || 'Tango Library';
    
    const sidebarTitle = document.getElementById('sidebar-title');
    if (sidebarTitle) sidebarTitle.innerText = lang.brandTitle;

    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) langToggleBtn.innerText = lang.langBtn;

    const menuLibrary = document.getElementById('menu-library');
    if (menuLibrary) menuLibrary.innerText = lang.menuLibrary;

    const menuFavorites = document.getElementById('menu-favorites');
    if (menuFavorites) menuFavorites.innerText = lang.menuFavorites;

    const menuAddVideo = document.getElementById('menu-add-video');
    if (menuAddVideo) menuAddVideo.innerText = lang.menuAddVideo;

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;

    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.innerText = lang.filterBtn;
    
    const optAllRoles = document.getElementById('opt-all-roles');
    if (optAllRoles) optAllRoles.innerText = lang.allRoles;

    const optLeader = document.getElementById('opt-leader');
    if (optLeader) optLeader.innerText = lang.leader;

    const optFollower = document.getElementById('opt-follower');
    if (optFollower) optFollower.innerText = lang.follower;

    const optBoth = document.getElementById('opt-both');
    if (optBoth) optBoth.innerText = lang.both;

    const optAllLocations = document.getElementById('opt-all-locations');
    if (optAllLocations) optAllLocations.innerText = lang.allLocations;

    const optDrive = document.getElementById('opt-drive');
    if (optDrive) optDrive.innerText = lang.drive;

    const optSocial = document.getElementById('opt-social');
    if (optSocial) optSocial.innerText = lang.social;

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

    const formTagsInput = document.getElementById('form-tags-input');
    if (formTagsInput) formTagsInput.placeholder = lang.tagsPlaceholder;

    const lblDownloaded = document.getElementById('lbl-downloaded');
    if (lblDownloaded) lblDownloaded.innerText = lang.lblDownloaded;

    const lblDriveUrl = document.getElementById('lbl-drive-url');
    if (lblDriveUrl) lblDriveUrl.innerText = lang.lblDriveUrl;

    const btnSubmitVideo = document.getElementById('btn-submit-video');
    if (btnSubmitVideo) btnSubmitVideo.innerText = editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo;

    const lblNewInstructorName = document.getElementById('lbl-new-instructor-name');
    if (lblNewInstructorName) lblNewInstructorName.innerText = lang.lblNewInstructorName;

    const lblCoverUpload = document.getElementById('lbl-cover-upload');
    if (lblCoverUpload) lblCoverUpload.innerText = lang.lblCoverUpload;

    const btnClearFavorites = document.getElementById('btn-clear-favorites');
    if (btnClearFavorites) btnClearFavorites.innerText = lang.btnClearFavorites;

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

    updateSmartFilenameAssistant(currentLang, formTagsArray);
    if (typeof applyFiltersAndSearch === 'function') {
        applyFiltersAndSearch();
    }
}

// Görünümler (Kütüphane / Ekleme Formu) Arasında Geçiş Yapar
export function switchView(viewName, state, functions) {
    state.currentView = viewName;
    
    const menuLibrary = document.getElementById('menu-library');
    const menuFavorites = document.getElementById('menu-favorites');
    const menuAddVideo = document.getElementById('menu-add-video');
    
    if (menuLibrary) menuLibrary.classList.remove('active');
    if (menuFavorites) menuFavorites.classList.remove('active');
    if (menuAddVideo) menuAddVideo.classList.remove('active');

    const clearFavBtnContainer = document.getElementById('clear-favorites-container');
    const viewLibraryContainer = document.getElementById('view-library-container');
    const viewAddContainer = document.getElementById('view-add-container');

    if (viewName === 'library' || viewName === 'favorites') {
        if (viewLibraryContainer) viewLibraryContainer.classList.remove('d-none');
        if (viewAddContainer) viewAddContainer.classList.add('d-none');
        
        const activeMenu = document.getElementById(`menu-${viewName}`);
        if (activeMenu) activeMenu.classList.add('active');
        
        if (clearFavBtnContainer) {
            if (viewName === 'favorites') {
                clearFavBtnContainer.classList.remove('d-none');
            } else {
                clearFavBtnContainer.classList.add('d-none');
            }
        }
        
        if (functions && typeof functions.applyFiltersAndSearch === 'function') {
            functions.applyFiltersAndSearch();
        }
    } else if (viewName === 'add') {
        if (viewLibraryContainer) viewLibraryContainer.classList.add('d-none');
        if (viewAddContainer) viewAddContainer.classList.remove('d-none');
        if (menuAddVideo) menuAddVideo.classList.add('active');
        
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            const formTitle = document.getElementById('form-title');
            if (formTitle && lang) formTitle.innerText = lang.formTitle;
            
            const btnSubmitVideo = document.getElementById('btn-submit-video');
            if (btnSubmitVideo && lang) btnSubmitVideo.innerText = lang.btnSubmitVideo;
            
            const addVideoForm = document.getElementById('add-video-form');
            if (addVideoForm) addVideoForm.reset();
            
            state.resetFormTags();
            if (functions && typeof functions.renderFormChips === 'function') {
                functions.renderFormChips();
            }
            
            const imagePreview = document.getElementById('image-preview');
            if (imagePreview) imagePreview.classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText && lang) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            if (functions && typeof functions.resetUploadedCoverUrl === 'function') {
                functions.resetUploadedCoverUrl();
            }
        }
        updateSmartFilenameAssistant(state.currentLang, state.getFormTags());
    }
}