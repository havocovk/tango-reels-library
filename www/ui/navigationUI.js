// ui/navigationUI.js - SAYFA GEÇİŞLERİ
export function switchView(viewName, state, functions) {
    // Aktif menü butonlarını sıfırla
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-stats').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');
    const tagManagerBtn = document.getElementById('menu-tag-manager');
    if (tagManagerBtn) tagManagerBtn.classList.remove('active');

    // Tüm görünümleri gizle
    const libraryView = document.getElementById('view-library-container');
    const statsView = document.getElementById('view-stats-container');
    const addView = document.getElementById('view-add-container');
    const tagView = document.getElementById('view-tag-manager-container');
    const clearFavContainer = document.getElementById('clear-favorites-container');

    if (libraryView) libraryView.classList.add('d-none');
    if (statsView) statsView.classList.add('d-none');
    if (addView) addView.classList.add('d-none');
    if (tagView) tagView.classList.add('d-none');
    if (clearFavContainer) clearFavContainer.classList.add('d-none');

    // Seçilen görünümü göster
    if (viewName === 'library' || viewName === 'favorites') {
        if (libraryView) libraryView.classList.remove('d-none');
        document.getElementById(`menu-${viewName}`).classList.add('active');
        if (viewName === 'favorites' && clearFavContainer) clearFavContainer.classList.remove('d-none');
        if (functions.applyFiltersAndSearch) functions.applyFiltersAndSearch();
    } 
    else if (viewName === 'stats') {
        if (statsView) statsView.classList.remove('d-none');
        document.getElementById('menu-stats').classList.add('active');
        if (functions.updateStats) functions.updateStats();
    } 
    else if (viewName === 'add') {
        if (addView) addView.classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
        if (!state.editingVideoId) {
            const lang = functions.translations[state.currentLang];
            if (document.getElementById('form-title')) document.getElementById('form-title').innerText = lang.formTitle;
            if (document.getElementById('btn-submit-video')) document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            if (document.getElementById('add-video-form')) document.getElementById('add-video-form').reset();
            if (functions.renderFormChips) functions.renderFormChips();
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            const dropText = document.getElementById('drop-area-text');
            if (dropText) {
                dropText.innerText = lang.dropText;
                dropText.classList.remove('d-none');
            }
            if (functions.resetUploadedCoverUrl) functions.resetUploadedCoverUrl();
        }
        if (functions.updateSmartAssistant) functions.updateSmartAssistant(state.currentLang, state.getFormTags());
    } 
    else if (viewName === 'tagManager' && tagView) {
        if (tagView) tagView.classList.remove('d-none');
        if (tagManagerBtn) tagManagerBtn.classList.add('active');
        if (functions.renderTagManager) functions.renderTagManager();
    }
}