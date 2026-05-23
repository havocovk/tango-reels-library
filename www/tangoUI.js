// tangoUI.js
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

// Tüm Arayüzün Dil Metinlerini Günceller (Çökme Korumalı Sürüm)
export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch) {
    const lang = translations[currentLang];
    
    document.title = lang.title;
    
    // 1. innerText Güncellenecek Elemanlar Havuzu
    const textUpdates = {
        'sidebar-title': lang.brandTitle,
        'lang-toggle-btn': lang.langBtn,
        'menu-library': lang.menuLibrary,
        'menu-favorites': lang.menuFavorites,
        'menu-add-video': lang.menuAddVideo,
        'filter-btn': lang.filterBtn,
        'opt-all-roles': lang.allRoles,
        'opt-leader': lang.leader,
        'opt-follower': lang.follower,
        'opt-both': lang.both,
        'opt-all-locations': lang.allLocations,
        'opt-drive': lang.drive,
        'opt-social': lang.social,
        'form-title': editingVideoId ? lang.formTitleEdit : lang.formTitle,
        'lbl-instructor': lang.lblInstructor,
        'lbl-video-url': lang.lblVideoUrl,
        'lbl-role': lang.lblRole,
        'lbl-partner': lang.lblPartner,
        'lbl-tags': lang.lblTags,
        'lbl-downloaded': lang.lblDownloaded,
        'lbl-drive-url': lang.lblDriveUrl,
        'btn-submit-video': editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo,
        'lbl-new-instructor-name': lang.lblNewInstructorName,
        'lbl-cover-upload': lang.lblCoverUpload,
        'btn-clear-favorites': lang.btnClearFavorites,
        'edit-tags-title': lang.editTagsTitle,
        'assistant-title': lang.assistantTitle,
        'assistant-text': lang.assistantText
    };

    // Güvenli Text Ataması (Eleman yoksa pas geçer, asla çökmez)
    Object.entries(textUpdates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    });

    // 2. placeholder Güncellenecek Elemanlar Havuzu (Hata Veren Bölge)
    const placeholderUpdates = {
        'search-input': lang.searchPlaceholder,
        'form-tags-input': lang.tagsPlaceholder,
        'modal-tags-input': lang.addTagPlaceholder
    };

    // Güvenli Placeholder Ataması
    Object.entries(placeholderUpdates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = value;
    });

    // Özel Durumlu Diğer Eleman Kontrolleri
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
    
    const menuLib = document.getElementById('menu-library');
    const menuFav = document.getElementById('menu-favorites');
    const menuAdd = document.getElementById('menu-add-video');
    
    if (menuLib) menuLib.classList.remove('active');
    if (menuFav) menuFav.classList.remove('active');
    if (menuAdd) menuAdd.classList.remove('active');

    const clearFavBtnContainer = document.getElementById('clear-favorites-container');

    if (viewName === 'library' || viewName === 'favorites') {
        const viewLibContainer = document.getElementById('view-library-container');
        const viewAddContainer = document.getElementById('view-add-container');
        const activeMenu = document.getElementById(`menu-${viewName}`);

        if (viewLibContainer) viewLibContainer.classList.remove('d-none');
        if (viewAddContainer) viewAddContainer.classList.add('d-none');
        if (activeMenu) activeMenu.classList.add('active');
        
        if (clearFavBtnContainer) {
            if (viewName === 'favorites') {
                clearFavBtnContainer.classList.remove('d-none');
            } else {
                clearFavBtnContainer.classList.add('d-none');
            }
        }
        
        functions.applyFiltersAndSearch();
    } else if (viewName === 'add') {
        const viewLibContainer = document.getElementById('view-library-container');
        const viewAddContainer = document.getElementById('view-add-container');
        const menuAddVid = document.getElementById('menu-add-video');

        if (viewLibContainer) viewLibContainer.classList.add('d-none');
        if (viewAddContainer) viewAddContainer.classList.remove('d-none');
        if (menuAddVid) menuAddVid.classList.add('active');
        
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            const formTitle = document.getElementById('form-title');
            const btnSubmitVideo = document.getElementById('btn-submit-video');
            const addVideoForm = document.getElementById('add-video-form');
            const imgPreview = document.getElementById('image-preview');
            const dropAreaText = document.getElementById('drop-area-text');

            if (formTitle) formTitle.innerText = lang.formTitle;
            if (btnSubmitVideo) btnSubmitVideo.innerText = lang.btnSubmitVideo;
            if (addVideoForm) addVideoForm.reset();
            
            state.resetFormTags();
            functions.renderFormChips();
            
            if (imgPreview) imgPreview.classList.add('d-none');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            functions.resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant(state.currentLang, state.getFormTags());
    }
}