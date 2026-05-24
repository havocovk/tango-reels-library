import { translations } from './config.js';

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

export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch) {
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
    document.getElementById('btn-clear-favorites').innerText = lang.btnClearFavorites;

    document.getElementById('lbl-form-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-form-video-url').innerText = lang.lblVideoUrl;
    document.getElementById('lbl-form-role').innerText = lang.role;
    document.getElementById('form-role-select').options[0].text = lang.couple;
    document.getElementById('form-role-select').options[1].text = lang.leader;
    document.getElementById('form-role-select').options[2].text = lang.follower;
    document.getElementById('lbl-form-partner').innerText = lang.lblPartnerName;
    document.getElementById('form-partner-name').placeholder = lang.partnerPlaceholder;
    document.getElementById('lbl-form-tags').innerText = lang.lblTags;
    document.getElementById('form-tags-input').placeholder = lang.addTagPlaceholder;
    document.getElementById('lbl-form-downloaded').innerText = lang.lblIsDownloaded;
    document.getElementById('lbl-form-drive-url').innerText = lang.lblDriveUrl;
    document.getElementById('lbl-form-cover').innerText = lang.lblCoverUpload;
    document.getElementById('drop-area-text').innerText = lang.dropText;

    if (editingVideoId) {
        document.getElementById('form-title').innerText = lang.formTitleEdit;
        document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;
    } else {
        document.getElementById('form-title').innerText = lang.formTitle;
        document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
    }

    document.getElementById('ins-section-title').innerText = lang.insSectionTitle;
    document.getElementById('lbl-new-ins-name').innerText = lang.lblNewInstructorName;
    
    if (editInstructorId) {
        document.getElementById('btn-submit-instructor').innerText = lang.btnUpdateIns;
    } else {
        document.getElementById('btn-submit-instructor').innerText = lang.btnAddIns;
    }

    document.getElementById('modal-tags-title').innerText = lang.editTagsTitle;
    document.getElementById('modal-add-tag-input').placeholder = lang.addTagPlaceholder;

    updateSmartFilenameAssistant(currentLang, formTagsArray);
}

export function switchView(viewName, state, functions) {
    const clearFavBtnContainer = document.getElementById('clear-fav-btn-container');
    
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

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