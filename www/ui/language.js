// ui/language.js - Güvenli element kontrolleriyle
// ✅ GÜNCELLEME (Lucide Icons): innerText → innerHTML, ikon entegrasyonu
// ✅ GÜNCELLEME: menu-instructors butonu eklendi
import { translations } from '../i18n.js';
import { icon } from '../icons.js';

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

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersAndSearch, populateFilterDropdowns) {
    const lang = translations[currentLang];

    // ── Sidebar ──────────────────────────────────────────────
    setText('sidebar-title', lang.brandTitle);
    setText('lang-toggle-btn', lang.langBtn);

    // Adim 5.5: Rastgele buton metni
    const randomBtn2 = document.getElementById('btn-random-video');
    if (randomBtn2) {
        randomBtn2.innerHTML = `${icon('shuffle', { size: 15, color: '#f59e0b' })} ${currentLang === 'tr' ? 'Rastgele' : 'Random'}`;
    }

    const showsMenuBtn2 = document.getElementById('menu-shows');
    if (showsMenuBtn2) showsMenuBtn2.innerHTML = `${icon('video', { size: 18 })} ${currentLang === 'tr' ? 'Tango Şovları' : 'Tango Shows'}`;

    const dashboardMenuBtn2 = document.getElementById('menu-dashboard');
    if (dashboardMenuBtn2) dashboardMenuBtn2.innerHTML = `${icon('bar-chart-2', { size: 18 })} ${currentLang === 'tr' ? 'Genel Bakış' : 'Overview'}`;
    setHTML('menu-library',     `${icon('book-open',   { size: 18 })} ${lang.menuLibrary}`);
    setHTML('menu-favorites',   `${icon('star',        { size: 18 })} ${lang.menuFavorites}`);
    setHTML('menu-stats',       `${icon('bar-chart-2', { size: 18 })} ${lang.menuStats}`);
    setHTML('menu-add-video',   `${icon('plus-circle', { size: 18 })} ${lang.menuAddVideo}`);

    const tagManagerBtn = document.getElementById('menu-tag-manager');
    if (tagManagerBtn) tagManagerBtn.innerHTML = `${icon('tag', { size: 18 })} ${currentLang === 'tr' ? 'Etiket Yönetimi' : 'Tag Management'}`;

    // ✅ YENİ: Eğitmenler menü butonu
    const instructorsBtn = document.getElementById('menu-instructors');
    if (instructorsBtn) instructorsBtn.innerHTML = `${icon('users', { size: 18 })} ${currentLang === 'tr' ? 'Eğitmenler' : 'Instructors'}`;

    // ── Arama & Pratik Başlat ─────────────────────────────────
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;

    const searchBtn = document.getElementById('search-btn');
    if (searchBtn) searchBtn.innerHTML = `${icon('search', { size: 15 })} ${lang.searchBtn}`;

    const startPracticeBtn = document.getElementById('btn-start-practice');
    if (startPracticeBtn) {
        startPracticeBtn.innerHTML = `${icon('target', { size: 15 })} ${currentLang === 'tr' ? 'Pratik Başlat' : 'Start Practice'}`;
    }

    // ── Filtre dropdown seçenekleri ───────────────────────────
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

    // ── Video ekleme formu ────────────────────────────────────
    const formTitle = document.getElementById('form-title');
    if (formTitle) {
        formTitle.innerHTML = editingVideoId
            ? `${icon('pencil', { size: 20, color: '#c026d3' })} ${lang.formTitleEdit}`
            : `${icon('plus-circle', { size: 20, color: '#00f0ff' })} ${lang.formTitle}`;
    }

    setText('lbl-instructor',       lang.lblInstructor);
    setText('lbl-video-url',        lang.lblVideoUrl);
    setText('lbl-role',             lang.lblRole);
    setText('lbl-partner',          lang.lblPartner);
    setText('lbl-tags',             lang.lblTags);

    const tagsInput = document.getElementById('form-tags-input');
    if (tagsInput) tagsInput.placeholder = lang.tagsPlaceholder;

    setText('lbl-downloaded',  lang.lblDownloaded);
    setText('lbl-drive-url',   lang.lblDriveUrl);

    const btnSubmit = document.getElementById('btn-submit-video');
    if (btnSubmit) {
        btnSubmit.innerHTML = editingVideoId
            ? `${icon('save', { size: 16, color: '#4ade80' })} ${lang.btnUpdateVideo}`
            : `${icon('save', { size: 16, color: '#4ade80' })} ${lang.btnSubmitVideo}`;
    }

    setText('lbl-new-instructor-name', lang.lblNewInstructorName);
    setText('lbl-cover-upload',        lang.lblCoverUpload);

    const btnClearFavs = document.getElementById('btn-clear-favorites');
    if (btnClearFavs) btnClearFavs.innerHTML = `${icon('trash-2', { size: 15, color: '#ef4444' })} ${lang.btnClearFavorites}`;

    const editTagsTitle = document.getElementById('edit-tags-title');
    if (editTagsTitle) editTagsTitle.innerHTML = `${icon('pencil', { size: 16, color: '#c026d3' })} ${lang.editTagsTitle}`;

    const modalTagsInput = document.getElementById('modal-tags-input');
    if (modalTagsInput) modalTagsInput.placeholder = lang.addTagPlaceholder;

    const assistantTitle = document.getElementById('assistant-title');
    if (assistantTitle) assistantTitle.innerHTML = `${icon('lightbulb', { size: 16, color: '#f59e0b' })} ${lang.assistantTitle}`;

    setText('assistant-text', lang.assistantText);

    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerHTML = `${icon('camera', { size: 18, color: '#64748b' })} ${lang.dropText}`;
    }

    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) {
        saveInsBtn.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    }

    const loadMoreBtn = document.getElementById('btn-load-more');
    if (loadMoreBtn) loadMoreBtn.innerHTML = `${icon('plus', { size: 14 })} ${lang.loadMore}`;

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

    // ── Etiket yönetimi ───────────────────────────────────────
    const tagManagerTitle = document.getElementById('tag-manager-title');
    if (tagManagerTitle) {
        tagManagerTitle.innerHTML = `${icon('tag', { size: 20, color: '#ff007f' })} ${currentLang === 'tr' ? 'Etiket Yönetimi' : 'Tag Management'}`;
    }

    const tableHeaders = document.querySelectorAll('#tag-manager-table th');
    if (tableHeaders.length >= 4) {
        tableHeaders[1].innerText = currentLang === 'tr' ? 'Etiket'          : 'Tag';
        tableHeaders[2].innerText = currentLang === 'tr' ? 'Kullanım Sayısı' : 'Usage Count';
        tableHeaders[3].innerText = currentLang === 'tr' ? 'İşlemler'        : 'Actions';
    }

    const mergeBtn = document.getElementById('tag-manager-merge-btn');
    if (mergeBtn) mergeBtn.innerHTML = `${icon('git-merge', { size: 14 })} ${currentLang === 'tr' ? 'Birleştir' : 'Merge'}`;

    const deleteBtn = document.getElementById('tag-manager-delete-btn');
    if (deleteBtn) deleteBtn.innerHTML = `${icon('trash-2', { size: 14, color: '#ef4444' })} ${currentLang === 'tr' ? 'Seçilenleri Sil' : 'Delete Selected'}`;

    const cleanupBtn = document.getElementById('tag-manager-cleanup-btn');
    if (cleanupBtn) cleanupBtn.innerHTML = `${icon('wind', { size: 14, color: '#f59e0b' })} ${currentLang === 'tr' ? 'Kullanılmayanları Temizle' : 'Clean Unused'}`;

    const mergeConfirmBtn = document.getElementById('tag-merge-confirm-btn');
    if (mergeConfirmBtn) mergeConfirmBtn.innerHTML = `${icon('check', { size: 14, color: '#4ade80' })} ${currentLang === 'tr' ? 'Birleştir' : 'Merge'}`;

    const mergeCancelBtn = document.getElementById('tag-merge-cancel-btn');
    if (mergeCancelBtn) mergeCancelBtn.innerHTML = `${icon('x', { size: 14, color: '#ef4444' })} ${currentLang === 'tr' ? 'İptal' : 'Cancel'}`;

    const mergePanelLabel = document.querySelector('#tag-merge-panel label');
    if (mergePanelLabel) {
        mergePanelLabel.innerText = currentLang === 'tr' ? 'Yeni Etiket Adı:' : 'New Tag Name:';
    }
    const mergeInput = document.getElementById('tag-merge-new-name');
    if (mergeInput) {
        mergeInput.placeholder = currentLang === 'tr' ? 'Yeni etiket adı...' : 'New tag name...';
    }
}