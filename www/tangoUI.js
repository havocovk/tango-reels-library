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
    
    // Sol Menü Öğeleri
    const menuLibrary = document.getElementById('menu-library');
    if (menuLibrary) menuLibrary.innerText = lang.menuLibrary;
    
    const menuFavorites = document.getElementById('menu-favorites');
    if (menuFavorites) menuFavorites.innerText = lang.menuFavorites;
    
    const menuAddVideo = document.getElementById('menu-add-video');
    if (menuAddVideo) menuAddVideo.innerText = lang.menuAddVideo;
    
    // Ana Başlık
    const mainTitle = document.querySelector('.sidebar-glass h2') || document.querySelector('h1');
    if (mainTitle && mainTitle.id !== 'form-title') mainTitle.innerText = lang.title;
    
    // Arama Çubuğu Placeholder
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;
    
    // Filtreleme Butonu
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.innerText = lang.filterBtn;
    
    // ➕ "Daha Fazla Video Göster" Butonu Güncellemesi
    const btnLoadMore = document.getElementById('btn-load-more');
    if (btnLoadMore) btnLoadMore.innerText = lang.btnLoadMore;
    
    // Dil Değiştirme Butonu
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) langBtn.innerText = lang.langBtn;

    // 🎬 Statik Filtre Dropdown Güncellemesi: Rol Seçimi
    const roleSelect = document.getElementById('filter-role-select');
    if (roleSelect && roleSelect.options.length >= 4) {
        roleSelect.options[0].text = lang.allRoles;
        roleSelect.options[1].text = lang.leader;
        roleSelect.options[2].text = lang.follower;
        roleSelect.options[3].text = lang.both;
    }
    
    // 📍 Statik Filtre Dropdown Güncellemesi: Ortam Seçimi
    const locationSelect = document.getElementById('filter-location-select');
    if (locationSelect && locationSelect.options.length >= 4) {
        locationSelect.options[0].text = lang.allLocations;
        locationSelect.options[1].text = lang.drive;
        locationSelect.options[2].text = lang.social;
    }

    // Pratik Listesini Temizleme Butonu
    const clearFavsBtn = document.getElementById('btn-clear-favorites');
    if (clearFavsBtn) clearFavsBtn.innerText = lang.btnClearFavorites;

    // Form Başlıkları ve Butonları
    const formTitle = document.getElementById('form-title');
    if (formTitle) {
        formTitle.innerText = editingVideoId ? (currentLang === 'tr' ? '✏️ Videoyu Düzenle' : '✏️ Edit Video') : lang.formTitle;
    }
    const btnSubmitVideo = document.getElementById('btn-submit-video');
    if (btnSubmitVideo) {
        btnSubmitVideo.innerText = editingVideoId ? (currentLang === 'tr' ? '💾 Değişiklikleri Kaydet' : '💾 Save Changes') : lang.btnSubmitVideo;
    }
    
    // Eğitmen Yönetim Alanı
    const manageTitle = document.querySelector('.instructor-management h3');
    if (manageTitle) manageTitle.innerText = lang.manageInsTitle;
    
    const lblInsName = document.querySelector('label[for="new-instructor-name"]');
    if (lblInsName) lblInsName.innerText = lang.lblNewInstructorName;
    
    const btnAddIns = document.getElementById('btn-add-instructor');
    if (btnAddIns) btnAddIns.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    
    // Video Form Alan Etiketleri
    const labelIns = document.querySelector('label[for="form-instructor-select"]');
    if (labelIns) labelIns.innerText = lang.lblInstructor;
    const labelPart = document.querySelector('label[for="form-partner-input"]');
    if (labelPart) labelPart.innerText = lang.lblPartner;
    const labelRoleType = document.querySelector('label[for="form-role-select"]');
    if (labelRoleType) labelRoleType.innerText = lang.lblRole;
    const labelUrl = document.querySelector('label[for="form-url-input"]');
    if (labelUrl) labelUrl.innerText = lang.lblUrl;
    const labelCover = document.querySelector('.form-group label[for="drop-area"]') || document.querySelector('label:has(+ #drop-area)');
    if (labelCover) labelCover.innerText = lang.lblCoverUpload;
    const labelTags = document.querySelector('label[for="form-tag-input"]');
    if (labelTags) labelTags.innerText = lang.lblTags;
    
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }
    
    const assistantTitle = document.querySelector('.smart-assistant h4');
    if (assistantTitle) assistantTitle.innerText = lang.assistantTitle;
    
    if (applyFiltersAndSearch) applyFiltersAndSearch();
}

// Görünüm pencereleri (Kütüphane / Favoriler / Ekle) arası geçişi sağlar
export function switchView(viewName, state, functions) {
    const clearFavBtnContainer = document.getElementById('clear-favorites-container');
    if (!clearFavBtnContainer) return;

    if (viewName === 'library' || viewName === 'favorites') {
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById('view-library-container').classList.remove('d-none');
        
        document.getElementById('menu-library').classList.remove('active');
        document.getElementById('menu-favorites').classList.remove('active');
        document.getElementById('menu-add-video').classList.remove('active');
        
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