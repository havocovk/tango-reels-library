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
    let cleanName = instructorName.replace(/\\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    let cleanTags = formTagsArray
        .map(t => t.replace(/\\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''))
        .filter(t => t !== '')
        .join('_');

    let finalFilename = cleanName;
    if (cleanTags) {
        finalFilename += '_' + cleanTags;
    }
    finalFilename += '.mp4';

    if (outputDiv) outputDiv.innerText = finalFilename;
}

// Tüm Arayüzün Dil Metinlerini Günceller (Çökmeyen Güvenli Versiyon)
export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch) {
    const lang = translations[currentLang] || translations['tr'];
    
    // Güvenli yazı yerleştirici: Eleman DOM'da yoksa veya silindiyse hata fırlatmaz.
    const safeSetText = (id, text) => {
        const el = document.getElementById(id);
        if (el && text !== undefined) el.innerText = text;
    };

    // 1. Sol Menü ve Başlık Alanları
    safeSetText('brand-title', lang.brandTitle);
    safeSetText('main-title', lang.title);
    safeSetText('menu-library-text', lang.menuLibrary);
    safeSetText('menu-favorites-text', lang.menuFavorites);
    safeSetText('menu-add-video-text', lang.menuAddVideo);
    safeSetText('lang-btn', lang.langBtn);

    // 2. Arama ve Filtreleme Alanı Koruması
    const searchInput = document.getElementById('search-input') || document.querySelector('.search-header input');
    if (searchInput && lang.searchPlaceholder) {
        searchInput.placeholder = lang.searchPlaceholder;
    }
    safeSetText('filter-btn', lang.filterBtn);

    // 3. Form Etiketleri ve Alanları
    safeSetText('form-title', lang.formTitle);
    safeSetText('lbl-select-instructor', lang.lblSelectInstructor);
    safeSetText('lbl-partner-name', lang.lblPartnerName);
    safeSetText('lbl-video-url', lang.lblVideoUrl);
    safeSetText('lbl-role-type', lang.lblRoleType);
    safeSetText('lbl-location-type', lang.lblLocationType);
    safeSetText('lbl-video-tags', lang.lblVideoTags);
    safeSetText('lbl-smart-filename', lang.lblSmartFilename);
    safeSetText('btn-submit-video', editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo);
    
    // Eğitmen Yönetim Alanı Metinleri
    safeSetText('lbl-new-instructor-section', lang.lblNewInstructorSection);
    safeSetText('lbl-new-instructor-name', lang.lblNewInstructorName);
    safeSetText('btn-add-instructor', editInstructorId ? lang.btnUpdateIns : lang.btnAddIns);
    
    // Kapak Görseli Alanı
    safeSetText('lbl-cover-upload', lang.lblCoverUpload);
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }

    // Favori temizleme butonu metni
    safeSetText('btn-clear-favorites', lang.btnClearFavorites);

    // 🔄 NE OLURSA OLSUN MOTORU TETİKLE
    if (typeof applyFiltersAndSearch === 'function') {
        try {
            applyFiltersAndSearch();
        } catch (err) {
            console.error("Dil güncellemesi sonrası liste yenilenirken hata:", err);
        }
    }
}

// Görünümler (Kütüphane / Favoriler / Video Ekleme) Arasında Geçiş Yapar
export function switchView(viewName, state, functions) {
    state.currentView = viewName;
    
    const libraryContainer = document.getElementById('view-library-container');
    const addContainer = document.getElementById('view-add-container');
    const clearFavBtnContainer = document.getElementById('clear-favorites-btn-container');
    
    // Menü aktifliklerini sıfırla
    document.getElementById('menu-library')?.classList.remove('active');
    document.getElementById('menu-favorites')?.classList.remove('active');
    document.getElementById('menu-add-video')?.classList.remove('active');

    if (viewName === 'library' || viewName === 'favorites') {
        if (libraryContainer) libraryContainer.classList.remove('d-none');
        if (addContainer) addContainer.classList.add('d-none');
        
        if (viewName === 'library') {
            document.getElementById('menu-library')?.classList.add('active');
        } else {
            document.getElementById('menu-favorites')?.classList.add('active');
        }
        
        if (clearFavBtnContainer) {
            if (viewName === 'favorites') {
                clearFavBtnContainer.classList.remove('d-none');
            } else {
                clearFavBtnContainer.classList.add('d-none');
            }
        }
        
        functions.applyFiltersAndSearch();
    } else if (viewName === 'add') {
        if (libraryContainer) libraryContainer.classList.add('d-none');
        if (addContainer) addContainer.classList.remove('d-none');
        document.getElementById('menu-add-video')?.classList.add('active');
        
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            if (document.getElementById('form-title')) document.getElementById('form-title').innerText = lang.formTitle;
            if (document.getElementById('btn-submit-video')) document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            document.getElementById('add-video-form')?.reset();
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