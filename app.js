import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 

let formTagsArray = [];
let modalTagsArray = [];
let activeEditTagsVideoId = null; 

// BEĞENDİĞİNİZ POP-UP STİLİNDE YENİ MODERN ALERT / CONFIRM MEKANİZMASI
function showCustomModal(message, type = 'info', isConfirm = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-alert-modal');
        const msgEl = document.getElementById('custom-alert-message');
        const iconEl = document.getElementById('custom-alert-icon');
        const confirmBtn = document.getElementById('custom-alert-confirm-btn');
        const cancelBtn = document.getElementById('custom-alert-cancel-btn');

        msgEl.textContent = message;
        
        if (type === 'success') iconEl.textContent = '🎉';
        else if (type === 'error') iconEl.textContent = '❌';
        else if (type === 'delete' || type === 'warning') iconEl.textContent = '⚠️';
        else iconEl.textContent = '🔔';

        const lang = translations[currentLang];
        confirmBtn.textContent = lang.btnConfirm || 'Tamam';
        cancelBtn.textContent = lang.btnCancel || 'İptal';

        if (isConfirm) {
            cancelBtn.classList.remove('d-none');
        } else {
            cancelBtn.classList.add('d-none');
        }

        modal.classList.remove('d-none');

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.classList.add('d-none');
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

function getFavorites() {
    const favs = localStorage.getItem('atkk_favorites');
    return favs ? JSON.parse(favs) : [];
}

function toggleFavorite(videoId) {
    let favs = getFavorites();
    if (favs.includes(videoId)) {
        favs = favs.filter(id => id !== videoId);
    } else {
        favs.push(videoId);
    }
    localStorage.setItem('atkk_favorites', JSON.stringify(favs));
    applyFiltersAndSearch(); 
}

// Toplu temizlemedeki eski confirm yapısı yeni pop-up'a geçirildi
async function clearAllFavorites() {
    const lang = translations[currentLang];
    const confirmed = await showCustomModal(lang.confirmClearFavs, 'warning', true);
    if (confirmed) {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        applyFiltersAndSearch();
    }
}

async function fetchVideos() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(id,name)&order=created_at.desc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!response.ok) throw new Error("Veriler çekilemedi");
        globalVideos = await response.json();
        applyFiltersAndSearch();
    } catch (err) {
        console.error(err);
        document.getElementById('video-grid').innerHTML = `<div class="error-text">${translations[currentLang].error}</div>`;
    }
}

async function fetchInstructors() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const instructors = await response.json();
        
        const mainSelect = document.getElementById('instructor-select');
        const modalSelect = document.getElementById('modal-instructor-select');
        
        const mainVal = mainSelect.value;
        const modalVal = modalSelect.value;

        mainSelect.innerHTML = `<option value="">Seçiniz...</option>`;
        modalSelect.innerHTML = `<option value="">Seçiniz...</option>`;

        instructors.forEach(ins => {
            mainSelect.insertAdjacentHTML('beforeend', `<option value="${ins.id}">${ins.name}</option>`);
            modalSelect.insertAdjacentHTML('beforeend', `<option value="${ins.id}">${ins.name}</option>`);
        });

        mainSelect.value = mainVal;
        modalSelect.value = modalVal;
    } catch (err) {
        console.error(err);
    }
}

function getAllUniqueTags() {
    let allTags = [];
    globalVideos.forEach(v => {
        if (v.tags && Array.isArray(v.tags)) {
            allTags = allTags.concat(v.tags);
        }
    });
    return [...new Set(allTags.map(t => t.trim()))].filter(t => t.length > 0);
}

function setupAutocomplete(inputId, listId, getTagsArray, renderChipsFn) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    input.addEventListener('input', () => {
        const value = input.value.trim().toLowerCase();
        list.innerHTML = '';
        if (!value) {
            list.classList.add('d-none');
            return;
        }

        const uniqueTags = getAllUniqueTags();
        const currentTags = getTagsArray();
        const filtered = uniqueTags.filter(t => t.toLowerCase().includes(value) && !currentTags.includes(t));

        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }

        filtered.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion-item';
            div.textContent = tag;
            div.addEventListener('click', () => {
                currentTags.push(tag);
                renderChipsFn();
                input.value = '';
                list.classList.add('d-none');
                input.focus();
            });
            list.appendChild(div);
        });
        list.classList.remove('d-none');
    });

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.classList.add('d-none');
        }
    });
}

function renderFormChips() {
    const area = document.getElementById('form-chips-area');
    area.innerHTML = '';
    formTagsArray.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `${tag} <span class="tag-chip-remove" data-idx="${idx}">&times;</span>`;
        area.appendChild(chip);
    });
}

function renderModalChips() {
    const area = document.getElementById('modal-chips-area');
    area.innerHTML = '';
    modalTagsArray.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.innerHTML = `${tag} <span class="tag-chip-remove" data-idx="${idx}">&times;</span>`;
        area.appendChild(chip);
    });
}

function setupTagInputListeners(inputId, getTagsArray, renderChipsFn) {
    const input = document.getElementById(inputId);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            let val = input.value.replace(/,/g, '').trim();
            if (val && !getTagsArray().includes(val)) {
                getTagsArray().push(val);
                renderChipsFn();
            }
            input.value = '';
            const list = document.getElementById(inputId.includes('form') ? 'form-autocomplete-list' : 'modal-autocomplete-list');
            if (list) list.classList.add('d-none');
        }
    });
}

function renderVideos(videosToRender) {
    const grid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    grid.innerHTML = '';

    if (videosToRender.length === 0) {
        if (currentView === 'favorites') {
            grid.innerHTML = `<div class="empty-text">${lang.emptyFav}</div>`;
        } else {
            grid.innerHTML = `<div class="empty-text">${lang.empty}</div>`;
        }
        return;
    }

    const favs = getFavorites();

    if (currentView === 'favorites') {
        const clearBtnContainer = document.createElement('div');
        clearBtnContainer.style.cssText = "grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-bottom: 10px;";
        clearBtnContainer.innerHTML = `<button id="btn-clear-favorites" class="card-crud-btn" style="color: #ef4444; border-color: rgba(239,68,68,0.2); padding: 10px 20px;">${lang.btnClearFavorites}</button>`;
        grid.appendChild(clearBtnContainer);
        document.getElementById('btn-clear-favorites').addEventListener('click', clearAllFavorites);
    }

    videosToRender.forEach(video => {
        const isFav = favs.includes(video.id);
        const insName = video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen';
        const partnerText = video.partner ? ` ft. ${video.partner}` : '';
        const coverImg = video.cover_url ? video.cover_url : 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80';

        let tagsHTML = '';
        if (video.tags && Array.isArray(video.tags)) {
            video.tags.forEach(t => {
                tagsHTML += `<span class="card-tag">#${t}</span>`;
            });
        }

        const card = document.createElement('div');
        card.className = 'video-card-glass';
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${coverImg}" class="card-image" alt="Tango">
                <button class="favorite-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">⭐</button>
                <div class="card-badges">
                    <span class="badge-role">${video.role}</span>
                    <span class="badge-location">${video.location === 'Google Drive' ? '💾 Drive' : '🌐 Social'}</span>
                </div>
            </div>
            <div class="card-info">
                <h4 class="card-title">${insName}${partnerText}</h4>
                <div class="card-tags-wrapper">
                    ${tagsHTML}
                </div>
                <div class="card-actions" style="margin-top: 15px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <a href="#" class="watch-link-btn play-video-trigger" data-url="${video.url}" style="flex: 1; text-align: center;">${lang.watch}</a>
                    <button class="card-crud-btn btn-edit-tags-trigger" data-id="${video.id}" title="${lang.editTagsTitle}">✏️ Etiket</button>
                    <button class="card-crud-btn btn-edit-video" data-id="${video.id}">✏️</button>
                    <button class="card-crud-btn btn-delete-video" data-id="${video.id}" style="color: #ef4444;">🗑️</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    document.querySelectorAll('.favorite-star-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(btn.getAttribute('data-id'));
        });
    });

    document.querySelectorAll('.play-video-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openVideoModal(btn.getAttribute('data-url'));
        });
    });

    document.querySelectorAll('.btn-edit-tags-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            openTagsEditModal(btn.getAttribute('data-id'));
        });
    });

    document.querySelectorAll('.btn-edit-video').forEach(btn => {
        btn.addEventListener('click', () => {
            loadVideoToForm(btn.getAttribute('data-id'));
        });
    });

    document.querySelectorAll('.btn-delete-video').forEach(btn => {
        btn.addEventListener('click', () => {
            deleteVideo(btn.getAttribute('data-id'));
        });
    });
}

function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locVal = document.getElementById('filter-location-select').value;
    const favs = getFavorites();

    let filtered = globalVideos;

    if (currentView === 'favorites') {
        filtered = filtered.filter(v => favs.includes(v.id));
    }
    if (roleVal !== 'all') {
        filtered = filtered.filter(v => v.role === roleVal);
    }
    if (locVal !== 'all') {
        filtered = filtered.filter(v => v.location === locVal);
    }
    if (searchVal) {
        filtered = filtered.filter(v => {
            const insName = v.instructors ? v.instructors.name.toLowerCase() : '';
            const partner = v.partner ? v.partner.toLowerCase() : '';
            const tagsMatch = v.tags ? v.tags.some(t => t.toLowerCase().includes(searchVal)) : false;
            return insName.includes(searchVal) || partner.includes(searchVal) || tagsMatch;
        });
    }

    renderVideos(filtered);
}

// SADELEŞMİŞ ETİKET POP-UP AÇILIŞ MANTIĞI
function openTagsEditModal(videoId) {
    activeEditTagsVideoId = videoId;
    const video = globalVideos.find(v => v.id === videoId);
    if (!video) return;

    modalTagsArray = video.tags ? [...video.tags] : [];
    renderModalChips();

    document.getElementById('tags-edit-modal').classList.remove('d-none');
}

function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
}

async function saveModalTags() {
    if (!activeEditTagsVideoId) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${activeEditTagsVideoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags: modalTagsArray })
        });

        if (!response.ok) throw new Error("Etiketler güncellenemedi");
        
        closeTagsEditModal();
        await showCustomModal(translations[currentLang].vidUpdateSuccess, 'success');
        fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const instructor_id = document.getElementById('instructor-select').value;
    const partner = document.getElementById('partner-input').value.trim();
    const url = document.getElementById('video-url-input').value.trim();
    const role = document.getElementById('role-select').value;
    const location = document.getElementById('location-select').value;
    const cover_url = getUploadedCoverUrl();

    const payload = {
        instructor_id: parseInt(instructor_id),
        partner: partner || null,
        url,
        role,
        location,
        tags: formTagsArray
    };

    if (cover_url) payload.cover_url = cover_url;

    try {
        let response;
        if (editingVideoId) {
            response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${editingVideoId}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) throw new Error("İşlem başarısız");

        await showCustomModal(editingVideoId ? lang.vidUpdateSuccess : lang.vidSuccess, 'success');
        
        document.getElementById('add-video-form').reset();
        formTagsArray = [];
        renderFormChips();
        resetUploadedCoverUrl();
        if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
        document.getElementById('drop-area-text').classList.remove('d-none');
        
        editingVideoId = null;
        document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
        document.getElementById('form-title').innerText = lang.formTitle;

        switchView('library');
        fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

function loadVideoToForm(videoId) {
    const video = globalVideos.find(v => v.id === videoId);
    if (!video) return;

    editingVideoId = videoId;
    switchView('add-video');

    const lang = translations[currentLang];
    document.getElementById('form-title').innerText = lang.btnCardEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;

    document.getElementById('instructor-select').value = video.instructor_id;
    document.getElementById('partner-input').value = video.partner || '';
    document.getElementById('video-url-input').value = video.url;
    document.getElementById('role-select').value = video.role;
    document.getElementById('location-select').value = video.location;

    formTagsArray = video.tags ? [...video.tags] : [];
    renderFormChips();

    const imgPreview = document.getElementById('image-preview');
    const dropText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        imgPreview.src = video.cover_url;
        imgPreview.classList.remove('d-none');
        dropText.classList.add('d-none');
    } else {
        imgPreview.classList.add('d-none');
        dropText.classList.remove('d-none');
    }
}

async function deleteVideo(videoId) {
    const lang = translations[currentLang];
    const confirmed = await showCustomModal(lang.confirmDeleteVideo, 'delete', true);
    if (!confirmed) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!response.ok) throw new Error("Silme işlemi başarısız");
        
        await showCustomModal(lang.successDeleteVideo, 'success');
        fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

function openInstructorModal() {
    editInstructorId = null;
    document.getElementById('new-instructor-name-input').value = '';
    document.getElementById('modal-instructor-select').value = '';
    document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
    document.getElementById('new-instructor-container').classList.add('d-none');
    document.getElementById('instructor-modal').classList.remove('d-none');
}

function closeInstructorModal() {
    document.getElementById('instructor-modal').classList.add('d-none');
}

async function handleInstructorSubmit() {
    const nameInput = document.getElementById('new-instructor-name-input');
    const name = nameInput.value.trim();
    const lang = translations[currentLang];

    if (!name) {
        await showCustomModal(lang.insAlert, 'error');
        return;
    }

    try {
        let response;
        if (editInstructorId) {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${editInstructorId}`, {
                method: 'PATCH',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
        }

        if (!response.ok) throw new Error("Eğitmen işlemi başarısız");

        await showCustomModal(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess, 'success');
        nameInput.value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        
        await fetchInstructors();
    } catch (err) {
        console.error(err);
    }
}

async function deleteInstructor() {
    const select = document.getElementById('modal-instructor-select');
    const id = select.value;
    const lang = translations[currentLang];

    if (!id) return;

    const confirmed = await showCustomModal(lang.deleteConfirm, 'delete', true);
    if (!confirmed) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!response.ok) throw new Error("Eğitmen silinemedi");

        await showCustomModal(lang.insDeleteSuccess, 'success');
        select.value = '';
        document.getElementById('new-instructor-name-input').value = '';
        editInstructorId = null;
        document.getElementById('new-instructor-container').classList.add('d-none');

        await fetchInstructors();
        await fetchVideos(); 
    } catch (err) {
        console.error(err);
    }
}

function openVideoModal(url) {
    let embedUrl = url;
    if (url.includes('drive.google.com')) {
        embedUrl = url.replace(/\/view\?usp=sharing|\/view/g, '/preview');
    }
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}

function switchView(view) {
    currentView = view;
    document.getElementById('library-view').classList.add('d-none');
    document.getElementById('add-video-view').classList.add('d-none');
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

    if (view === 'library') {
        document.getElementById('library-view').classList.remove('d-none');
        document.getElementById('menu-library').classList.add('active');
        applyFiltersAndSearch();
    } else if (view === 'favorites') {
        document.getElementById('library-view').classList.remove('d-none');
        document.getElementById('menu-favorites').classList.add('active');
        applyFiltersAndSearch();
    } else if (view === 'add-video') {
        document.getElementById('add-video-view').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
    }
}

function updateLanguageUI() {
    const lang = translations[currentLang];
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    document.getElementById('lang-toggle-btn').innerText = currentLang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
    applyFiltersAndSearch();
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();

    document.getElementById('menu-library').addEventListener('click', () => switchView('library'));
    document.getElementById('menu-favorites').addEventListener('click', () => switchView('favorites'));
    document.getElementById('menu-add-video').addEventListener('click', () => {
        editingVideoId = null;
        document.getElementById('add-video-form').reset();
        formTagsArray = [];
        renderFormChips();
        resetUploadedCoverUrl();
        if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
        document.getElementById('drop-area-text').classList.remove('d-none');
        switchView('add-video');
    });

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateLanguageUI();
    });

    document.getElementById('btn-open-instructor-manager').addEventListener('click', openInstructorModal);
    document.getElementById('instructor-modal-close-btn').addEventListener('click', closeInstructorModal);
    document.getElementById('btn-cancel-instructor').addEventListener('click', closeInstructorModal);
    
    document.getElementById('btn-edit-instructor-name').addEventListener('click', () => {
        const select = document.getElementById('modal-instructor-select');
        if (!select.value) return;
        editInstructorId = select.value;
        document.getElementById('new-instructor-name-input').value = select.options[select.selectedIndex].text;
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    });

    document.getElementById('btn-delete-instructor').addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor').addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form').addEventListener('submit', handleFormSubmit);
    
    document.getElementById('search-input').addEventListener('input', applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-btn').addEventListener('click', applyFiltersAndSearch);

    document.getElementById('btn-save-modal-tags').addEventListener('click', saveModalTags);
    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    document.getElementById('tags-modal-close-btn').addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }

    document.getElementById('form-chips-area').addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-chip-remove')) {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            formTagsArray.splice(idx, 1);
            renderFormChips();
        }
    });

    document.getElementById('modal-chips-area').addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-chip-remove')) {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            modalTagsArray.splice(idx, 1);
            renderModalChips();
        }
    });

    setupTagInputListeners('form-tags-input', () => formTagsArray, renderFormChips);
    setupTagInputListeners('modal-tags-input', () => modalTagsArray, renderModalChips);
    setupAutocomplete('form-tags-input', 'form-autocomplete-list', () => formTagsArray, renderFormChips);
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', () => modalTagsArray, renderModalChips);
});