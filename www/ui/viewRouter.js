// ui/viewRouter.js - Görünüm geçişi (view switch)
// ✅ GÜNCELLEME (Adım 2.3): practiceSession view case eklendi
// ✅ GÜNCELLEME: instructorsList view case eklendi
// ✅ GÜNCELLEME: favorites view'ında btn-start-practice gizlenir
import { translations } from '../i18n.js';
import { updateSmartFilenameAssistant } from './language.js';

export function switchView(viewName, state, functions) {
    state.currentView = viewName;

    // Tüm menü butonlarından active class'ı kaldır
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-stats').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');
    const tagManagerBtn = document.getElementById('menu-tag-manager');
    if (tagManagerBtn) tagManagerBtn.classList.remove('active');
    const instructorsMenuBtn = document.getElementById('menu-instructors');
    if (instructorsMenuBtn) instructorsMenuBtn.classList.remove('active');
    const dashboardMenuBtn = document.getElementById('menu-dashboard');
    if (dashboardMenuBtn) dashboardMenuBtn.classList.remove('active');
    const showsMenuBtn = document.getElementById('menu-shows');
    if (showsMenuBtn) showsMenuBtn.classList.remove('active');
    const practiceListMenuBtn = document.getElementById('menu-practice-list');
    if (practiceListMenuBtn) practiceListMenuBtn.classList.remove('active');

    const clearFavBtnContainer    = document.getElementById('clear-favorites-container');
    const libraryView             = document.getElementById('view-library-container');
    const statsView               = document.getElementById('view-stats-container');
    const addView                 = document.getElementById('view-add-container');
    const tagView                 = document.getElementById('view-tag-manager-container');
    const practiceSessionView     = document.getElementById('view-practice-session-container');
    const instructorProfileView   = document.getElementById('view-instructor-profile-container');
    const dashboardView           = document.getElementById('view-dashboard-container');
    const showsView               = document.getElementById('view-shows-container');
    const practiceListView        = document.getElementById('view-practice-list-container');

    // ── Tüm view'ları gizle (ortak başlangıç) ──
    const allViews = [libraryView, statsView, addView, tagView, practiceSessionView, instructorProfileView, dashboardView, showsView, practiceListView];
    allViews.forEach(v => { if (v) v.classList.add('d-none'); });

    if (viewName === 'practiceList') {
        if (practiceListView) practiceListView.classList.remove('d-none');
        if (practiceListMenuBtn) practiceListMenuBtn.classList.add('active');
        if (clearFavBtnContainer) clearFavBtnContainer.classList.add('d-none');

    } else if (viewName === 'shows') {
        if (showsView) showsView.classList.remove('d-none');
        if (showsMenuBtn) showsMenuBtn.classList.add('active');
        if (functions.renderShows) functions.renderShows();

    } else if (viewName === 'dashboard') {
        if (dashboardView) dashboardView.classList.remove('d-none');
        if (dashboardMenuBtn) dashboardMenuBtn.classList.add('active');
        if (functions.renderDashboard) functions.renderDashboard();

    } else if (viewName === 'library' || viewName === 'favorites') {
        if (libraryView) libraryView.classList.remove('d-none');
        document.getElementById(`menu-${viewName}`)?.classList.add('active');

        // ✅ Favoriler view'ında Pratik Başlat butonunu gizle, Library'de göster
        const startPracticeBtn = document.getElementById('btn-start-practice');
        if (startPracticeBtn) {
            if (viewName === 'favorites') {
                startPracticeBtn.style.display = 'none';
            } else {
                startPracticeBtn.style.display = '';
            }
        }

        if (viewName === 'favorites') {
            if (clearFavBtnContainer) clearFavBtnContainer.classList.remove('d-none');
        } else {
            if (clearFavBtnContainer) clearFavBtnContainer.classList.add('d-none');
        }

        functions.applyFiltersAndSearch();

    } else if (viewName === 'stats') {
        if (statsView) statsView.classList.remove('d-none');
        document.getElementById('menu-stats')?.classList.add('active');
        if (functions.updateStats) functions.updateStats();

    } else if (viewName === 'add') {
        if (addView) addView.classList.remove('d-none');
        document.getElementById('menu-add-video')?.classList.add('active');

        if (!state.editingVideoId) {
            const lang = translations[state.currentLang];
            const formTitle = document.getElementById('form-title');
            if (formTitle) formTitle.innerText = lang.formTitle;
            const btnSubmit = document.getElementById('btn-submit-video');
            if (btnSubmit) btnSubmit.innerText = lang.btnSubmitVideo;
            const addForm = document.getElementById('add-video-form');
            if (addForm) addForm.reset();
            state.resetFormTags();
            functions.renderFormChips();
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            functions.resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant(state.currentLang, state.getFormTags());

    } else if (viewName === 'tagManager' && tagView) {
        tagView.classList.remove('d-none');
        if (tagManagerBtn) tagManagerBtn.classList.add('active');
        if (functions.renderTagManager) functions.renderTagManager();

    } else if (viewName === 'practiceSession') {
        if (practiceSessionView) practiceSessionView.classList.remove('d-none');
        if (clearFavBtnContainer) clearFavBtnContainer.classList.add('d-none');

    } else if (viewName === 'instructorsList') {
        // ✅ YENİ: Eğitmenler listesi — instructor-profile-container'ı kullanır
        if (instructorProfileView) instructorProfileView.classList.remove('d-none');
        if (clearFavBtnContainer) clearFavBtnContainer.classList.add('d-none');
        if (instructorsMenuBtn) instructorsMenuBtn.classList.add('active');
        if (functions.renderInstructorsList) functions.renderInstructorsList();

    } else if (viewName === 'instructorProfile') {
        if (instructorProfileView) instructorProfileView.classList.remove('d-none');
        if (clearFavBtnContainer) clearFavBtnContainer.classList.add('d-none');
        if (functions.renderProfile) functions.renderProfile();
    }
}