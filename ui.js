// ui.js
import { translations } from './config.js';
import { getFavorites } from './favorites.js';
import { startVideoEditFlow, deleteVideoFlow } from './handlers.js';

// Görünüm Değiştirme (Kütüphane / Favoriler / Form)
export function switchView(viewName, state) {
    state.currentView = viewName;
    
    // Menü butonlarının aktiflik durumunu güncelle
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    
    const viewLibrary = document.getElementById('view-library-container');
    const viewAdd = document.getElementById('view-add-container');
    const clearFavContainer = document.getElementById('clear-favorites-container');

    if (viewName === 'library' || viewName === 'favorites') {
        if (viewLibrary) viewLibrary.classList.remove('d-none');
        if (viewAdd) viewAdd.classList.add('d-none');
        
        const activeBtn = document.getElementById(viewName === 'library' ? 'menu-library' : 'menu-favorites');
        if (activeBtn) activeBtn.classList.add('active');
        
        if (viewName === 'favorites') {
            if (clearFavContainer) clearFavContainer.classList.remove('d-none');
        } else {
            if (clearFavContainer) clearFavContainer.classList.add('d-none');
        }
    } else if (viewName === 'add') {
        if (viewLibrary) viewLibrary.classList.add('d-none');
        if (viewAdd) viewAdd.remove('d-none');
        if (viewAdd) viewAdd.classList.remove('d-none');
        
        const activeBtn = document.getElementById('menu-add-video');
        if (activeBtn) activeBtn.classList.add('active');

        // Formu temizle ve başlığı "Yeni Kayıt" durumuna getir
        const lang = translations[state.currentLang];
        document.getElementById('form-title').innerText = lang.formTitle;
        document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
        if (!state.editingVideoId) {
            document.getElementById('add-video-form').reset();
            state.formTagsArray = [];
            const chipsArea = document.getElementById('chips-area');
            if (chipsArea) chipsArea.innerHTML = '';
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) dropAreaText.classList.remove('d-none');
        }
    }

    // Dil etiketlerini yeniden uyarla
    applyStaticTranslations(state.currentLang);
    applyFiltersAndSearch(state);
}

// HTML'deki Sabit Alanların Çevirisi
export function applyStaticTranslations(currentLang) {
    const lang = translations[currentLang];
    
    const safeSetText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    const safeSetPlaceholder = (id, text) => { const el = document.getElementById(id); if (el) el.placeholder = text; };

    safeSetText('sidebar-title', lang.brandTitle);
    safeSetText('menu-library', lang.menuLibrary);
    safeSetText('menu-favorites', lang.menuFavorites);
    safeSetText('menu-add-video', lang.menuAddVideo);
    safeSetPlaceholder('search-input', lang.searchPlaceholder);
    safeSetText('filter-btn', lang.filterBtn);
    safeSetText('btn-clear-favorites', lang.btnClearFavorites);
    
    safeSetText('opt-all-roles', lang.allRoles);
    safeSetText('opt-leader', lang.leader);
    safeSetText('opt-follower', lang.follower);
    safeSetText('opt-both', lang.both);
    safeSetText('opt-all-locations', lang.allLocations);
    safeSetText('opt-drive', lang.drive);
    safeSetText('opt-social', lang.social);

    safeSetText('lbl-instructor', lang.lblInstructor);
    safeSetText('lbl-new-instructor-name', lang.lblNewInstructorName);
    safeSetPlaceholder('form-new-instructor-input', lang.tagsPlaceholder);
    safeSetText('lbl-video-url', lang.lblVideoUrl);
    safeSetText('lbl-partner', lang.lblPartner);
    safeSetText('lbl-tags', lang.lblTags);
    safeSetPlaceholder('form-tags-input', lang.tagsPlaceholder);
    safeSetText('lbl-cover-upload', lang.lblCoverUpload);
    safeSetText('lbl-downloaded', lang.lblDownloaded);
    safeSetText('lbl-drive-url', lang.lblDriveUrl);
    safeSetText('assistant-title', lang.assistantTitle);
    safeSetText('assistant-text', lang.assistantText);
    
    safeSetText('edit-tags-title', lang.editTagsTitle);
    safeSetPlaceholder('modal-tags-input', lang.addTagPlaceholder);
}

// Eğitmen Seçim Kutusunu Doldurma
export function renderInstructorSelect(instructorsList) {
    const select = document.getElementById('form-instructor-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seçiniz / Select --</option>';
    instructorsList.forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.textContent = ins.name;
        select.appendChild(opt);
    });
}

// Filtreleri ve Aramayı Uygulayıp Kartları Basma
export function applyFiltersAndSearch(state) {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locVal = document.getElementById('filter-location-select').value;
    const favs = getFavorites();
    const lang = translations[state.currentLang];

    let filtered = state.globalVideos.filter(video => {
        // 1. Favori Sekmesi Filtresi
        if (state.currentView === 'favorites' && !favs.includes(video.id)) return false;

        // 2. Rol Filtresi
        if (roleVal !== 'all' && video.role_type !== roleVal) return false;

        // 3. Ortam (Drive / Sosyal Medya) Filtresi
        if (locVal === 'drive' && !video.is_downloaded) return false;
        if (locVal === 'social' && video.is_downloaded) return false;

        // 4. Akıllı Arama Filtresi (Eğitmen adı, Partner adı veya Etiketler içinde arar)
        if (searchVal) {
            const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
            const partName = video.partner_name ? video.partner_name.toLowerCase() : '';
            const tagsStr = video.tags ? video.tags.toLowerCase() : '';
            return insName.includes(searchVal) || partName.includes(searchVal) || tagsStr.includes(searchVal);
        }

        return true;
    });

    renderVideoCards(filtered, favs, state);
}

// Listelenen Videoları Ekranda Kart Yapısına Dönüştürme
function renderVideoCards(videos, favs, state) {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    
    const lang = translations[state.currentLang];
    
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) loadingMsg.classList.add('d-none');

    if (videos.length === 0) {
        grid.innerHTML = `<div class="info-msg">${state.currentView === 'favorites' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    grid.innerHTML = '';
    videos.forEach(video => {
        const isFav = favs.includes(video.id);
        const insName = video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen';
        const partnerText = video.partner_name ? `ft. ${video.partner_name}` : '';
        
        const card = document.createElement('div');
        card.className = 'video-card';

        // Rol ve Ortam Rozetleri (Badges)
        let roleBadge = `<span class="badge badge-both">${lang.both}</span>`;
        if (video.role_type === 'Leader') roleBadge = `<span class="badge badge-leader">${lang.leader}</span>`;
        if (video.role_type === 'Follower') roleBadge = `<span class="badge badge-follower">${lang.follower}</span>`;

        const locBadge = video.is_downloaded 
            ? `<span class="badge badge-drive">${lang.drive}</span>` 
            : `<span class="badge badge-social">${lang.social}</span>`;

        // Etiketleri chips yapılarına dönüştürme
        let tagsHtml = '';
        if (video.tags) {
            tagsHtml = video.tags.split(',')
                .map(t => t.trim())
                .filter(t => t !== '')
                .map(t => `<span class="tag-chip-item" style="font-size:0.7rem; padding:2px 6px;">${t}</span>`)
                .join(' ');
        }

        // Kapak Resmi Ayarı
        const bgStyle = video.cover_url ? `background-image: url('${video.cover_url}');` : 'background: rgba(255,255,255,0.03);';

        card.innerHTML = `
            <div class="video-cover-container" style="${bgStyle}">
                <div class="play-overlay" data-drive-url="${video.drive_url || ''}" data-video-url="${video.url || ''}">
                    <div class="play-icon">▶</div>
                </div>
                <button class="fav-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">⭐</button>
            </div>
            <div class="card-info-content">
                <div class="card-instructor"><strong>${insName}</strong></div>
                <div class="card-partner">${partnerText}</div>
                <div class="card-badges">${roleBadge} ${locBadge}</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;">${tagsHtml}</div>
                
                <div style="margin-top:auto; padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
                    <button class="inline-edit-tags-btn" data-id="${video.id}">🏷️ Etiketleri Düzenle</button>
                    <div style="display:flex; gap:6px;">
                        <button class="card-crud-btn card-edit-btn" data-id="${video.id}" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" data-id="${video.id}" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        // İç butonların tıklama olaylarını bağlıyoruz
        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            import('./modals.js').then(m => m.openTagsEditModal(id, state));
        });

        card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            const targetVideo = state.globalVideos.find(v => v.id === id);
            if (targetVideo) startVideoEditFlow(targetVideo, state, (targetView) => switchView(targetView, state));
        });

        card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            deleteVideoFlow(id, state);
        });

        grid.appendChild(card);
    });
}