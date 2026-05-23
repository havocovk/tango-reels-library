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

// Tüm Arayüzün Dil Metinlerini Günceller
export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch) {
    const lang = translations[currentLang];
    
    document.title = lang.title;
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    
    // HTML'de bulunmayan arama input'u için güvenli kontrol eklendi
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.placeholder = lang.searchPlaceholder;
    }
    
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

    updateSmartFilenameAssistant(currentLang, formTagsArray);
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