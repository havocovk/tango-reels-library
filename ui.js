// ui.js
import { translations } from './config.js';
import { getFavorites } from './favorites.js';
import { updateSmartFilenameAssistant } from './utils.js';

export function updateInterfaceLanguage(currentLang, editingVideoId, editInstructorId, formTagsArray, applyFiltersFn) {
    const lang = translations[currentLang];
    
    document.title = lang.title;
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    document.getElementById('opt-all-roles').innerText = lang.allRoles;
    document.getElementById('opt-leader').innerText = lang.leader;
    document.getElementById('opt-follower').innerText = lang.follower;
    document.getElementById('opt-both').innerText = lang.both;
    document.getElementById('opt-all-locations').innerText = lang.allLocations;
    document.getElementById('opt-drive').innerText = lang.drive;
    document.getElementById('opt-social').innerText = lang.social;

    document.getElementById('form-title').innerText = editingVideoId ? lang.formTitleEdit : lang.formTitle;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-video-url').innerText = lang.lblVideoUrl;
    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-tags').innerText = lang.lblTags;
    document.getElementById('form-tags-input').placeholder = lang.tagsPlaceholder;
    document.getElementById('lbl-downloaded').innerText = lang.lblDownloaded;
    document.getElementById('lbl-drive-url').innerText = lang.lblDriveUrl;
    document.getElementById('btn-submit-video').innerText = editingVideoId ? lang.btnUpdateVideo : lang.btnSubmitVideo;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    document.getElementById('btn-clear-favorites').innerText = lang.btnClearFavorites;
    document.getElementById('edit-tags-title').innerText = lang.editTagsTitle;
    document.getElementById('modal-tags-input').placeholder = lang.addTagPlaceholder;
    
    document.getElementById('assistant-title').innerText = lang.assistantTitle;
    document.getElementById('assistant-text').innerText = lang.assistantText;

    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }

    const saveInsBtn = document.getElementById('btn-save-instructor');
    if (saveInsBtn) {
        saveInsBtn.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    }

    updateSmartFilenameAssistant(currentLang, formTagsArray);
    if (applyFiltersFn) applyFiltersFn();
}

export function renderVideoCards({ videos, currentLang, currentView, onToggleFav, onOpenTagsModal, onStartEdit, onDeleteVideo, onOpenVideoModal }) {
    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        const msg = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${msg}</div>`;
        return;
    }

    const favs = getFavorites();

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        
        let roleDisplay = video.role_type || 'Both';
        let roleBadgeClass = '';
        if (roleDisplay === 'Leader') {
            roleDisplay = currentLang === 'tr' ? 'Lider' : 'Leader';
            roleBadgeClass = 'badge-leader';
        } else if (roleDisplay === 'Follower') {
            roleDisplay = currentLang === 'tr' ? 'Takipçi' : 'Follower';
            roleBadgeClass = 'badge-follower';
        } else {
            roleDisplay = currentLang === 'tr' ? 'İkisi de' : 'Both';
            roleBadgeClass = 'badge-both';
        }

        const storageText = video.is_downloaded ? '💾 Drive' : '🌐 Sosyal Medya';
        const storageClass = video.is_downloaded ? 'badge-drive' : 'badge-social';
        
        const partnerDisplay = video.partner_name 
            ? `<span class="card-partner">👥 ${video.partner_name}</span>` 
            : '';
        
        let tagsHtml = '';
        if (video.tags && video.tags.trim() !== '') {
            const tagsArray = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
            tagsArray.forEach(tag => {
                tagsHtml += `<span class="badge" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); font-size: 0.7rem; padding: 2px 6px;">#${tag}</span>`;
            });
            tagsHtml += `<button class="inline-edit-tags-btn" title="${lang.editTagsTitle}">✏️</button>`;
        } else {
            tagsHtml = `<button class="inline-edit-tags-btn" title="${lang.editTagsTitle}">➕ ${lang.editTagsTitle}</button>`;
        }
        
        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;
        const isFav = favs.includes(video.id);

        const hasDrive = video.is_downloaded && video.drive_url;
        const actionClickAttr = hasDrive ? `data-drive="${video.drive_url}" class="play-trigger-btn"` : `href="${video.url}" target="_blank"`;
        const actionLinkClickAttr = hasDrive ? `data-drive="${video.drive_url}" class="card-action-link drive-trigger"` : `href="${video.url}" target="_blank" class="card-action-link"`;

        card.innerHTML = `
            <div class="video-cover-link">
                <div class="video-cover-container" style="background-image: url('${coverImg}');">
                    <button class="fav-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">★</button>
                    <a ${actionClickAttr}>
                        <div class="play-overlay">
                            <span class="play-icon">▶</span>
                        </div>
                    </a>
                </div>
            </div>
            <div class="card-info-content">
                <strong class="card-instructor">👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}</strong>
                ${partnerDisplay}
                
                <div class="card-badges">
                    <span class="badge ${roleBadgeClass}">${roleDisplay}</span>
                    <span class="badge ${storageClass}">${storageText}</span>
                </div>

                <div class="card-badges card-tags-wrapper-row" style="margin-top: 2px; gap: 4px; align-items:center;">${tagsHtml}</div>

                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:4px;">
                    <a ${actionLinkClickAttr}>
                        ${hasDrive ? (currentLang === 'tr' ? '🎬 Kütüphanede İzle →' : '🎬 Watch in Library →') : lang.watch}
                    </a>
                    
                    <div style="display:flex; gap:8px;">
                        <button class="card-crud-btn card-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onToggleFav(video.id);
        });

        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onOpenTagsModal(video);
        });

        card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onStartEdit(video);
        });

        card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            onDeleteVideo(video.id);
        });

        if (hasDrive) {
            const triggers = card.querySelectorAll('[data-drive]');
            triggers.forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    onOpenVideoModal(video.drive_url);
                });
            });
        }

        videoGrid.appendChild(card);
    });
}

export function switchView({ viewName, currentLang, editingVideoId, renderFormChipsFn, updateFilenameFn, resetCoverFn, applyFiltersFn }) {
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

    const clearFavBtnContainer = document.getElementById('clear-favorites-container');

    if (viewName === 'library' || viewName === 'favorites') {
        document.getElementById('view-library-container').classList.remove('d-none');
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById(`menu-${viewName}`).classList.add('active');
        
        if (viewName === 'favorites') {
            clearFavBtnContainer.classList.remove('d-none');
        } else {
            clearFavBtnContainer.classList.add('d-none');
        }
        
        if (applyFiltersFn) applyFiltersFn();
    } else if (viewName === 'add') {
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
        
        if (!editingVideoId) {
            const lang = translations[currentLang];
            document.getElementById('form-title').innerText = lang.formTitle;
            document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            document.getElementById('add-video-form').reset();
            
            if (renderFormChipsFn) renderFormChipsFn();
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            if (resetCoverFn) resetCoverFn();
        }
        if (updateFilenameFn) updateFilenameFn();
    }
}