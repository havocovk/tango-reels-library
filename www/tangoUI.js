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
    if (document.getElementById('sidebar-title')) document.getElementById('sidebar-title').innerText = lang.brandTitle;
    if (document.getElementById('lang-toggle-btn')) document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    if (document.getElementById('menu-library')) document.getElementById('menu-library').innerText = lang.menuLibrary;
    if (document.getElementById('menu-favorites')) document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    if (document.getElementById('menu-add-video')) document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    if (document.getElementById('search-input')) document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    if (document.getElementById('filter-btn')) document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    if (document.getElementById('opt-all-roles')) document.getElementById('opt-all-roles').innerText = lang.allRoles;
    if (document.getElementById('opt-leader')) document.getElementById('opt-leader').innerText = lang.leader;
    if (document.getElementById('opt-follower')) document.getElementById('opt-follower').innerText = lang.follower;
    if (document.getElementById('opt-both')) document.getElementById('opt-both').innerText = lang.both;
    if (document.getElementById('opt-all-locations')) document.getElementById('opt-all-locations').innerText = lang.allLocations;
    if (document.getElementById('opt-drive')) document.getElementById('opt-drive').innerText = lang.drive;
    if (document.getElementById('opt-social')) document.getElementById('opt-social').innerText = lang.social;

    if (document.getElementById('form-title')) document.getElementById('form-title').innerText = editingVideoId ? lang.formTitleEdit : lang.formTitle;
    if (document.getElementById('lbl-instructor')) document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    if (document.getElementById('lbl-video-url')) document.getElementById('lbl-video-url').innerText = lang.lblVideoUrl;
    if (document.getElementById('lbl-role')) document.getElementById('lbl-role').innerText = lang.lblRole;
    if (document.getElementById('lbl-partner')) document.getElementById('lbl-partner').innerText = lang.lblPartner;
    if (document.getElementById('lbl-tags')) document.getElementById('lbl-tags').innerText = lang.lblTags;
    if (document.getElementById('form-tags-input')) document.getElementById('form-tags-input').placeholder = lang.tagsPlaceholder;
    if (document.getElementById('lbl-downloaded')) document.getElementById('lbl-downloaded').innerText = lang.lblDownloaded;
    if (document.getElementById('lbl-drive-url')) document.getElementById('lbl-drive-url').innerText = lang.lblDriveUrl;
    if (document.getElementById('btn-submit-video')) document.getElementById('btn-submit-video').innerText = editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo;
    if (document.getElementById('lbl-new-instructor-name')) document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    if (document.getElementById('lbl-cover-upload')) document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    if (document.getElementById('btn-clear-favorites')) document.getElementById('btn-clear-favorites').innerText = lang.btnClearFavorites;
    if (document.getElementById('edit-tags-title')) document.getElementById('edit-tags-title').innerText = lang.editTagsTitle;
    if (document.getElementById('modal-tags-input')) document.getElementById('modal-tags-input').placeholder = lang.addTagPlaceholder;
    
    if (document.getElementById('assistant-title')) document.getElementById('assistant-title').innerText = lang.assistantTitle;
    if (document.getElementById('assistant-text')) document.getElementById('assistant-text').innerText = lang.assistantText;

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
    if (document.getElementById('menu-library')) document.getElementById('menu-library').classList.remove('active');
    if (document.getElementById('menu-favorites')) document.getElementById('menu-favorites').classList.remove('active');
    if (document.getElementById('menu-add-video')) document.getElementById('menu-add-video').classList.remove('active');

    const clearFavBtnContainer = document.getElementById('clear-favorites-container');

    if (viewName === 'library' || viewName === 'favorites') {
        if (document.getElementById('view-library-container')) document.getElementById('view-library-container').classList.remove('d-none');
        if (document.getElementById('view-add-container')) document.getElementById('view-add-container').classList.add('d-none');
        if (document.getElementById(`menu-${viewName}`)) document.getElementById(`menu-${viewName}`).classList.add('active');
        
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
        if (document.getElementById('view-library-container')) document.getElementById('view-library-container').classList.add('d-none');
        if (document.getElementById('view-add-container')) document.getElementById('view-add-container').classList.remove('d-none');
        if (document.getElementById('menu-add-video')) document.getElementById('menu-add-video').classList.add('active');
        
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            if (document.getElementById('form-title')) document.getElementById('form-title').innerText = lang.formTitle;
            if (document.getElementById('btn-submit-video')) document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            if (document.getElementById('add-video-form')) document.getElementById('add-video-form').reset();
            state.resetFormTags();
            if (functions && typeof functions.renderFormChips === 'function') {
                functions.renderFormChips();
            }
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
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