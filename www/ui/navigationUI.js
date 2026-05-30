// ui/navigation.js - Görünüm geçişi (view switch) - 7. adım güncellemesi
import { translations } from '../i18n.js';
import { updateSmartFilenameAssistant } from './language.js';

// Dışarıdan alınacak fonksiyonlar (app.js'den)
let globalLoadView = null;
let globalRenderTagManager = null;
let globalApplyFiltersAndSearch = null;
let globalRenderStats = null;
let globalResetCover = null;
let globalRenderFormChips = null;

export function setNavigationCallbacks(loadViewFn, renderTagManagerFn, applyFiltersAndSearchFn, renderStatsFn, resetCoverFn, renderFormChipsFn) {
    globalLoadView = loadViewFn;
    globalRenderTagManager = renderTagManagerFn;
    globalApplyFiltersAndSearch = applyFiltersAndSearchFn;
    globalRenderStats = renderStatsFn;
    globalResetCover = resetCoverFn;
    globalRenderFormChips = renderFormChipsFn;
}

export async function switchView(viewName, state, functions) {
    state.currentView = viewName;
    
    // Menü aktiflik sınıflarını güncelle
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-stats').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');
    const tagManagerBtn = document.getElementById('menu-tag-manager');
    if (tagManagerBtn) tagManagerBtn.classList.remove('active');
    
    // View'ı yükle (eğer library veya favorites ise aynı view'ı kullan, fakat içerik aynı)
    // Favori görünümü için aslında aynı library.html kullanılır, sadece filtre favori olur.
    // Bu durumu app.js'deki callSwitchView zaten handle ediyor. Burada sadece HTML yüklenir.
    let viewFile = viewName;
    if (viewName === 'favorites') viewFile = 'library'; // favorites için de library.html kullan
    if (globalLoadView) await globalLoadView(viewFile);
    
    // Görünüm tipine göre ekstra işlemler
    if (viewName === 'library' || viewName === 'favorites') {
        document.getElementById(`menu-${viewName}`).classList.add('active');
        const clearFavBtnContainer = document.getElementById('clear-favorites-container');
        if (clearFavBtnContainer) {
            if (viewName === 'favorites') clearFavBtnContainer.classList.remove('d-none');
            else clearFavBtnContainer.classList.add('d-none');
        }
        if (globalApplyFiltersAndSearch) globalApplyFiltersAndSearch();
    } else if (viewName === 'stats') {
        document.getElementById('menu-stats').classList.add('active');
        if (globalRenderStats) globalRenderStats();
    } else if (viewName === 'add') {
        document.getElementById('menu-add-video').classList.add('active');
        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            const formTitle = document.getElementById('form-title');
            if (formTitle) formTitle.innerText = lang.formTitle;
            const btnSubmit = document.getElementById('btn-submit-video');
            if (btnSubmit) btnSubmit.innerText = lang.btnSubmitVideo;
            const form = document.getElementById('add-video-form');
            if (form) form.reset();
            if (state.resetFormTags) state.resetFormTags();
            if (globalRenderFormChips) globalRenderFormChips();
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            if (globalResetCover) globalResetCover();
        }
        updateSmartFilenameAssistant(state.currentLang, state.getFormTags());
    } else if (viewName === 'tagManager') {
        if (tagManagerBtn) tagManagerBtn.classList.add('active');
        if (globalRenderTagManager) globalRenderTagManager();
    }
}