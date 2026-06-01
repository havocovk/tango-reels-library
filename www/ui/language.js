// ui/language.js - Güvenli element kontrolleriyle
// ✅ DÜZELTİLDİ (Adım 2.4): btn-start-practice metni dil değişiminde güncelleniyor
import { translations } from '../i18n.js';

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
    if (cleanTags) finalFilename += '_' + cleanTags;
    finalFilename += '.mp4';

    if (outputDiv) outputDiv.innerText = finalFilename;
}

export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch, populateFilterDropdowns) {
    const lang = translations[currentLang];

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    };

    // ── Sidebar ──
    setText('sidebar-title', lang.brandTitle);
    setText('lang-toggle-btn', lang.langBtn);
    setText('menu-library', lang.menuLibrary);
    setText('menu-favorites', lang.menuFavorites);
    setText('menu-stats', '📊 ' + (currentLang === 'tr' ? 'İstatistikler' : 'Statistics'));
    setText('menu-add-video', lang.menuAddVideo);

    const tagManagerBtn = document.getElementById('menu-tag-manager');
    if (tagManagerBtn) tagManagerBtn.innerText = '🏷️ ' + (currentLang === 'tr' ? 'Etiket Yönetimi' : 'Tag Management');

    // ── Arama & Pratik Başlat butonu ──
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;

    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.innerText = lang.searchBtn;

    // ✅ YENİ: "Pratik Başlat" butonu dil değişiminde güncelleniyor
    const startPracticeBtn = document.getElementById('btn-start-practice');
    if (startPracticeBtn) {
        startPracticeBtn.textContent = currentLang === 'tr' ? '🎯 Pratik Başlat' : '🎯 Start Practice';
    }

    // ── Filtre dropdown seçenekleri ──
    const allRolesOpt = document.getElementById('opt-all-roles');
    if (allRolesOpt) allRolesOpt.innerText = lang.allRoles;
    const optLeader = document.getElementById('opt-leader');
    if (optLeader) optLeader.innerText = lang.leader;
    const optFollower = document.getElementById('opt-follower');
    if (optFollower) optFollower.innerText = lang.follower;
    const optBoth = document.getElementById('opt-both');
    if (optBoth) optBoth.innerText = lang.both;

    const platformSelect = document.getElementById('filter-platform-select');
    if (platformSelect) {
        const allPlatformsOption = platformSelect.querySelector('option[value="all"]');
        if (allPlatformsOption) allPlatformsOption.innerText = lang.allPlatforms;
        const driveOpt = platformSelect.querySelector('option[value="drive"]');
        if (driveOpt) driveOpt.innerText = lang.platformLabels.drive;
        const youtubeOpt = platformSelect.querySelector('option[value="youtube"]');
        if (youtubeOpt) youtubeOpt.innerText = lang.platformLabels.youtube;
        const instagramOpt = platformSelect.querySelector('option[value="instagram"]');
        if (instagramOpt) instagramOpt.innerText = lang.platformLabels.instagram;
        const facebookOpt = platformSelect.querySelector('option[value="facebook"]');
        if (facebookOpt) facebookOpt.innerText = lang.platformLabels.facebook;
    }

    // ── Video ekleme formu ──
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = editingVideoId ? lang.formTitleEdit : lang.formTitle;

    const lblInstructor = document.getElementById('lbl-instructor');
    if (lblInstructor) lblInstructor.innerText = lang.lblInstructor;
    const lblVideoUrl = document.getElementById('lbl-video-url');
    if (lblVideoUrl) lblVideoUrl.innerText = lang.lblVideoUrl;
    const lblRole = document.getElementById('lbl-role');
    if (lblRole) lblRole.innerText = lang.lblRole;
    const lblPartner = document.getElementById('lbl-partner');
    if (lblPartner) lblPartner.innerText = lang.lblPartner;
    const lblTags = document.getElementById('lbl-tags');
    if (lblTags) lblTags.innerText = lang.lblTags;

    const tagsInput = document.getElementById('form-tags-input');
    if (tagsInput) tagsInput.placeholder = lang.tagsPlaceholder;

    const lblDownloaded = document.getElementById('lbl-downloaded');
    if (lblDownloaded) lblDownloaded.innerText = lang.lblDownloaded;
    const lblDriveUrl = document.getElementById('lbl-drive-url');
    if (lblDriveUrl) lblDriveUrl.innerText = lang.lblDriveUrl;

    const btnSubmit = document.getElementById('btn-submit-video');
    if (btnSubmit) btnSubmit.innerText = editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo;

    const lblNewInstructorName = document.getElementById('lbl-new-instructor-name');
    if (lblNewInstructorName) lblNewInstructorName.innerText = lang.lblNewInstructorName;
    const lblCoverUpload = document.getElementById('lbl-cover-upload');
    if (lblCoverUpload) lblCoverUpload.innerText = lang.lblCoverUpload;

    const btnClearFavs = document.getElementById('btn-clear-favorites');
    if (btnClearFavs) btnClearFavs.innerText = lang.btnClearFavorites;

    const btnResetCover = document.getElementById('btn-reset-cover');
    if (btnResetCover) btnResetCover.innerText = lang.resetCoverBtn || (currentLang === 'tr' ? '🗑️ Resmi Sıfırla' : '🗑️ Reset Image');

    const editTagsTitle = document.getElementById('edit-tags-title');
    if (editTagsTitle) editTagsTitle.innerText = lang.editTagsTitle;
    const modalTagsInput = document.getElementById('modal-tags-input');
    if (modalTagsInput) modalTagsInput.placeholder = lang.addTagPlaceholder;

    const assistantTitle = document.getElementById('assistant-title');
    if (assistantTitle) assistantTitle.innerText = lang.assistantTitle;
    const assistantText = document.getElementById('assistant-text');
    if (assistantText) assistantText.innerText = lang.assistantText;

    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }

    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) {
        saveInsBtn.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    }

    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) loadMoreBtn.innerText = lang.loadMore;

    const roleSelect = document.getElementById('form-role-select');
    if (roleSelect) {
        const bothOption     = roleSelect.querySelector('option[value="Both"]');
        const leaderOption   = roleSelect.querySelector('option[value="Leader"]');
        const followerOption = roleSelect.querySelector('option[value="Follower"]');
        if (bothOption)     bothOption.innerText     = lang.both;
        if (leaderOption)   leaderOption.innerText   = lang.leader;
        if (followerOption) followerOption.innerText = lang.follower;
    }

    const partnerInput = document.getElementById('form-partner-name');
    if (partnerInput) {
        partnerInput.placeholder = currentLang === 'tr' ? 'Örn: Maria' : 'Ex: Maria';
    }

    // ── Etiket yönetimi ──
    const tagManagerTitle = document.getElementById('tag-manager-title');
    if (tagManagerTitle) {
        tagManagerTitle.innerText = '🏷️ ' + (currentLang === 'tr' ? 'Etiket Yönetimi' : 'Tag Management');
    }

    const tableHeaders = document.querySelectorAll('#tag-manager-table th');
    if (tableHeaders.length >= 4) {
        tableHeaders[1].innerText = currentLang === 'tr' ? 'Etiket'          : 'Tag';
        tableHeaders[2].innerText = currentLang === 'tr' ? 'Kullanım Sayısı' : 'Usage Count';
        tableHeaders[3].innerText = currentLang === 'tr' ? 'İşlemler'        : 'Actions';
    }

    const mergeBtn = document.getElementById('tag-manager-merge-btn');
    if (mergeBtn) mergeBtn.innerText = currentLang === 'tr' ? '🔗 Birleştir' : '🔗 Merge';
    const deleteBtn = document.getElementById('tag-manager-delete-btn');
    if (deleteBtn) deleteBtn.innerText = currentLang === 'tr' ? '🗑️ Seçilenleri Sil' : '🗑️ Delete Selected';
    const cleanupBtn = document.getElementById('tag-manager-cleanup-btn');
    if (cleanupBtn) cleanupBtn.innerText = currentLang === 'tr' ? '🧹 Kullanılmayanları Temizle' : '🧹 Clean Unused';
    const mergeConfirmBtn = document.getElementById('tag-merge-confirm-btn');
    if (mergeConfirmBtn) mergeConfirmBtn.innerText = currentLang === 'tr' ? '✅ Birleştir' : '✅ Merge';
    const mergeCancelBtn = document.getElementById('tag-merge-cancel-btn');
    if (mergeCancelBtn) mergeCancelBtn.innerText = currentLang === 'tr' ? '❌ İptal' : '❌ Cancel';

    const mergePanelLabel = document.querySelector('#tag-merge-panel label');
    if (mergePanelLabel) {
        mergePanelLabel.innerText = currentLang === 'tr' ? 'Yeni Etiket Adı:' : 'New Tag Name:';
    }
    const mergeInput = document.getElementById('tag-merge-new-name');
    if (mergeInput) {
        mergeInput.placeholder = currentLang === 'tr' ? 'Yeni etiket adı...' : 'New tag name...';
    }
}
