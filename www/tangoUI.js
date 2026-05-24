import { translations } from './config.js';

// 🧠 Akıllı Dosya Adı Asistanını Günceller
export function updateSmartFilenameAssistant(currentLang, formTagsArray) {
    const lang = translations[currentLang];
    const select = document.getElementById('form-instructor-select');
    const outputDiv = document.getElementById('assistant-filename-output');

    if (!select || !select.value || select.selectedIndex === -1) {
        if (outputDiv) outputDiv.innerText = lang.insAlert || "Lütfen eğitmen seçin.";
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

// 🌐 Tüm Arayüzün Dil Metinlerini Günceller (Sayfa İngilizceye dönünce terimler de döner)
export function updateInterfaceLanguage(currentLang, editingVideoId) {
    const lang = translations[currentLang];
    if (!lang) return;

    // DOM elemanlarını ve karşılık gelen sözlük anahtarlarını eşleştiriyoruz
    const elements = {
        'brand-title': lang.brandTitle,
        'main-title': lang.title,
        'menu-library': lang.menuLibrary,
        'menu-favorites': lang.menuFavorites,
        'menu-add-video': lang.menuAddVideo,
        'filter-btn': lang.filterBtn,
        'lbl-role': lang.role,
        'lbl-location': lang.location,
        'btn-clear-favorites': lang.btnClearFavorites,
        'drop-area-text': lang.dropText,
        'form-title': editingVideoId ? (lang.formTitleEdit || "✏️ Videoyu Düzenle") : lang.formTitle,
        'btn-submit-video': editingVideoId ? (lang.btnUpdateVideo || "Güncelle") : lang.btnSubmitVideo
    };

    for (const [id, text] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el && text) el.innerHTML = text;
    }

    // Arama çubuğu placeholder ayarı
    const searchInput = document.getElementById('search-input');
    if (searchInput && lang.searchPlaceholder) {
        searchInput.placeholder = lang.searchPlaceholder;
    }
}

// 🔄 Görünüm (Sekme) Geçişlerini Güvenli Şekilde Yönetir
export function switchView(viewName, currentLang, editingVideoId, formTagsArray, callbacks) {
    const lang = translations[currentLang];
    const clearFavBtnContainer = document.getElementById('clear-favorites-container');

    // Menü butonlarındaki aktiflik sınıflarını temizle
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));

    if (viewName === 'library' || viewName === 'favorites') {
        document.getElementById('view-library-container')?.classList.remove('d-none');
        document.getElementById('view-add-container')?.classList.add('d-none');
        
        const activeMenuId = viewName === 'library' ? 'menu-library' : 'menu-favorites';
        document.getElementById(activeMenuId)?.classList.add('active');
        
        if (clearFavBtnContainer) {
            if (viewName === 'favorites') clearFavBtnContainer.classList.remove('d-none');
            else clearFavBtnContainer.classList.add('d-none');
        }
        
        // Listeyi tazelemek için ana dosyadan gelen callback'i çağırıyoruz
        if (callbacks && typeof callbacks.applyFiltersAndSearch === 'function') {
            callbacks.applyFiltersAndSearch();
        }
    } else if (viewName === 'add') {
        document.getElementById('view-library-container')?.classList.add('d-none');
        document.getElementById('view-add-container')?.classList.remove('d-none');
        document.getElementById('menu-add-video')?.classList.add('active');
        
        if (!editingVideoId) {
            const form = document.getElementById('add-video-form');
            if (form) form.reset();
            
            if (callbacks && typeof callbacks.resetFormTags === 'function') callbacks.resetFormTags();
            if (callbacks && typeof callbacks.renderFormChips === 'function') callbacks.renderFormChips();
            
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            if (callbacks && typeof callbacks.resetUploadedCoverUrl === 'function') callbacks.resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant(currentLang, formTagsArray);
    }
}