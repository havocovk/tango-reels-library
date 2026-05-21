// ui.js
import { AppState } from './state.js';
import { translations } from './config.js';
import { getFavorites, toggleFavorite } from './favorites.js';
import { renderFormChips } from './handlers.js';
import { openTagsEditModal } from './modals.js';
import { updateSmartFilenameAssistant } from './utils.js';
import * as api from './api.js';

export function switchView(viewName) {
    AppState.currentView = viewName;
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    const viewLibrary = document.getElementById('view-library-container');
    const viewAdd = document.getElementById('view-add-container');
    const clearFavContainer = document.getElementById('clear-favorites-container');

    if (viewName === 'library' || viewName === 'favorites') {
        if (viewLibrary) viewLibrary.classList.remove('d-none');
        if (viewAdd) viewAdd.classList.add('d-none');
        const btn = document.getElementById(viewName === 'library' ? 'menu-library' : 'menu-favorites');
        if (btn) btn.classList.add('active');
        if (clearFavContainer) clearFavContainer.classList.toggle('d-none', viewName !== 'favorites');
    } else if (viewName === 'add') {
        if (viewLibrary) viewLibrary.classList.add('d-none');
        if (viewAdd) viewAdd.classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');

        if (!AppState.editingVideoId) {
            document.getElementById('add-video-form').reset();
            AppState.formTagsArray = [];
            renderFormChips();
            document.getElementById('image-preview')?.classList.add('d-none');
            document.getElementById('drop-area-text')?.classList.remove('d-none');
            document.getElementById('drive-url-container')?.classList.add('d-none');
            updateSmartFilenameAssistant(AppState.currentLang, []);
        }
    }
    applyStaticTranslations();
    applyFiltersAndSearch();
}

export function applyStaticTranslations() {
    const lang = translations[AppState.currentLang];
    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.innerText = txt; };
    const setP = (id, txt) => { const el = document.getElementById(id); if (el) el.placeholder = txt; };
    
    setT('sidebar-title', lang.brandTitle);
    setT('menu-library', lang.menuLibrary);
    setT('menu-favorites', lang.menuFavorites);
    setT('menu-add-video', lang.menuAddVideo);
    setT('btn-clear-favorites', lang.btnClearFavorites);
    setT('form-title', AppState.editingVideoId ? lang.formTitleEdit : lang.formTitle);
    setT('btn-submit-video', AppState.editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo);
    setP('search-input', lang.searchPlaceholder);
    setT('filter-btn', lang.filterBtn);

    setT('opt-all-roles', lang.allRoles);
    setT('opt-leader', lang.leader);
    setT('opt-follower', lang.follower);
    setT('opt-both', lang.both);
    setT('opt-all-locations', lang.allLocations);
    setT('opt-drive', lang.drive);
    setT('opt-social', lang.social);
    setT('lbl-instructor', lang.lblInstructor);
    setT('lbl-new-instructor-name', lang.lblNewInstructorName);
    setT('lbl-video-url', lang.lblVideoUrl);
    setT('lbl-partner', lang.lblPartner);
    setT('lbl-tags', lang.lblTags);
    setP('form-tags-input', lang.tagsPlaceholder);
    setT('lbl-cover-upload', lang.lblCoverUpload);
    setT('lbl-downloaded', lang.lblDownloaded);
    setT('lbl-drive-url', lang.lblDriveUrl);
    setT('assistant-title', lang.assistantTitle);
    setT('assistant-text', lang.assistantText);
    setT('edit-tags-title', lang.editTagsTitle);
    setP('modal-tags-input', lang.addTagPlaceholder);
}

export function renderInstructorSelect(instructors) {
    const select = document.getElementById('form-instructor-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seçiniz / Select --</option>';
    instructors.forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.textContent = ins.name;
        select.appendChild(opt);
    });
}

export function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locVal = document.getElementById('filter-location-select').value;
    const favs = getFavorites();
    const lang = translations[AppState.currentLang];

    let filtered = AppState.globalVideos.filter(video => {
        if (AppState.currentView === 'favorites' && !favs.includes(video.id)) return false;
        if (roleVal !== 'all' && video.role_type !== roleVal) return false;
        if (locVal === 'drive' && !video.is_downloaded) return false;
        if (locVal === 'social' && video.is_downloaded) return false;
        if (searchVal) {
            const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
            const partName = video.partner_name ? video.partner_name.toLowerCase() : '';
            const tagsStr = video.tags ? video.tags.toLowerCase() : '';
            return insName.includes(searchVal) || partName.includes(searchVal) || tagsStr.includes(searchVal);
        }
        return true;
    });

    const grid = document.getElementById('video-grid');
    if (!grid) return;
    document.getElementById('loading-msg')?.classList.add('d-none');

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="info-msg">${AppState.currentView === 'favorites' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    grid.innerHTML = '';
    filtered.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        const bg = video.cover_url ? `background-image: url('${video.cover_url}');` : 'background: rgba(255,255,255,0.03);';
        
        let roleBadge = `<span class="badge badge-both">${lang.both}</span>`;
        if (video.role_type === 'Leader') roleBadge = `<span class="badge badge-leader">${lang.leader}</span>`;
        if (video.role_type === 'Follower') roleBadge = `<span class="badge badge-follower">${lang.follower}</span>`;
        const locBadge = video.is_downloaded ? `<span class="badge badge-drive">${lang.drive}</span>` : `<span class="badge badge-social">${lang.social}</span>`;

        let tagsHtml = '';
        if (video.tags) {
            tagsHtml = video.tags.split(',').map(t => t.trim()).filter(t => t !== '')
                .map(t => `<span class="tag-chip-item" style="font-size:0.7rem; padding:2px 6px;">${t}</span>`).join(' ');
        }

        card.innerHTML = `
            <div class="video-cover-container" style="${bg}">
                <div class="play-overlay" data-drive-url="${video.drive_url || ''}" data-video-url="${video.url || ''}">
                    <div class="play-icon">▶</div>
                </div>
                <button class="fav-star-btn ${favs.includes(video.id) ? 'active' : ''}" data-id="${video.id}">⭐</button>
            </div>
            <div class="card-info-content">
                <div class="card-instructor"><strong>${video.instructors?.name || 'Unknown'}</strong></div>
                <div class="card-partner">${video.partner_name ? 'ft. ' + video.partner_name : ''}</div>
                <div class="card-badges">${roleBadge} ${locBadge}</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;">${tagsHtml}</div>
                <div style="margin-top:auto; padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
                    <button class="inline-edit-tags-btn" data-id="${video.id}">🏷️ Etiketleri Düzenle</button>
                    <div style="display:flex; gap:6px;">
                        <button class="card-crud-btn card-edit-btn" data-id="${video.id}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" data-id="${video.id}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.fav-star-btn').addEventListener('click', () => {
            toggleFavorite(video.id);
            applyFiltersAndSearch();
        });

        card.querySelector('.inline-edit-tags-btn').addEventListener('click', () => {
            openTagsEditModal(video);
        });

        card.querySelector('.card-edit-btn').addEventListener('click', () => {
            AppState.editingVideoId = video.id;
            switchView('add');
            document.getElementById('form-instructor-select').value = video.instructor_id;
            document.getElementById('form-video-url').value = video.url;
            document.getElementById('form-role-select').value = video.role_type || 'Both';
            document.getElementById('form-partner-name').value = video.partner_name || '';
            AppState.formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
            renderFormChips();
            document.getElementById('form-is-downloaded').checked = video.is_downloaded;
            const container = document.getElementById('drive-url-container');
            if (video.is_downloaded) {
                container.classList.remove('d-none');
                document.getElementById('form-drive-url').value = video.drive_url || '';
                document.getElementById('form-drive-url').required = true;
            } else {
                container.classList.add('d-none');
                document.getElementById('form-drive-url').value = '';
                document.getElementById('form-drive-url').required = false;
            }
            const preview = document.getElementById('image-preview');
            if (video.cover_url && preview) {
                preview.src = video.cover_url;
                preview.classList.remove('d-none');
                document.getElementById('drop-area-text')?.classList.add('d-none');
            }
            updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray);
            applyStaticTranslations();
        });

        card.querySelector('.card-delete-btn').addEventListener('click', async () => {
            if (!confirm(lang.confirmDeleteVideo)) return;
            await api.deleteVideo(video.id);
            alert(lang.successDeleteVideo);
            if (AppState.onRefreshUI) await AppState.onRefreshUI();
        });

        grid.appendChild(card);
    });
}