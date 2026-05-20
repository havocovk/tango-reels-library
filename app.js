import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 

// Form ve Modal etiket yönetim dizileri
let formTagsArray = [];
let activeEditTagsVideoId = null; 
let uniqueExistingTags = new Set();

// --- MODERN VE UYUMLU POP-UP PENCERELERİ (ALERT / CONFIRM YERİNE) ---
function showCustomAlert(message, icon = "🎉") {
    const alertModal = document.getElementById('custom-alert-modal');
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('alert-message').innerText = message;
    
    document.getElementById('alert-btn-confirm').style.display = 'none';
    const closeBtn = document.getElementById('alert-btn-close');
    closeBtn.innerText = translations[currentLang].modalOk;
    closeBtn.style.background = "linear-gradient(135deg, #38bdf8, #0284c7)";

    alertModal.classList.remove('d-none');
    
    return new Promise((resolve) => {
        const handler = () => {
            alertModal.classList.add('d-none');
            closeBtn.removeEventListener('click', handler);
            resolve();
        };
        closeBtn.addEventListener('click', handler);
    });
}

function showCustomConfirm(message, icon = "⚠️") {
    const alertModal = document.getElementById('custom-alert-modal');
    document.getElementById('alert-icon').innerText = icon;
    document.getElementById('alert-message').innerText = message;
    
    const confirmBtn = document.getElementById('alert-btn-confirm');
    const cancelBtn = document.getElementById('alert-btn-close');
    
    confirmBtn.innerText = translations[currentLang].modalOk;
    confirmBtn.style.display = 'block';
    cancelBtn.innerText = translations[currentLang].modalCancel;
    cancelBtn.style.background = "rgba(255,255,255,0.08)";

    alertModal.classList.remove('d-none');
    
    return new Promise((resolve) => {
        const handleConfirm = () => {
            alertModal.classList.add('d-none');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };
        const handleCancel = () => {
            alertModal.classList.add('d-none');
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
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

async function clearAllFavorites() {
    const lang = translations[currentLang];
    const confirm = await showCustomConfirm(lang.confirmClearFavs);
    if (confirm) {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        applyFiltersAndSearch();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

async function initApp() {
    updateUIStrings();
    await loadInstructorsToSelect();
    await fetchVideos();
}

function setupEventListeners() {
    document.getElementById('menu-library').addEventListener('click', () => switchView('library'));
    document.getElementById('menu-favorites').addEventListener('click', () => switchView('favorites'));
    document.getElementById('menu-add-video').addEventListener('click', () => switchView('add-video'));
    
    document.getElementById('lang-toggle-btn').addEventListener('click', toggleLanguage);
    
    document.getElementById('btn-show-instructor-panel').addEventListener('click', () => {
        const panel = document.getElementById('new-instructor-container');
        panel.classList.toggle('d-none');
    });

    document.getElementById('btn-delete-instructor').addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor').addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form').addEventListener('submit', handleFormSubmit);
    
    document.getElementById('search-input').addEventListener('input', applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-btn').addEventListener('click', applyFiltersAndSearch);

    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    document.getElementById('tags-modal-close-btn').addEventListener('click', closeTagsEditModal);
    document.getElementById('btn-close-tags-modal').addEventListener('click', closeTagsEditModal);
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }

    const formTagsInput = document.getElementById('form-tags-input');
    formTagsInput.addEventListener('input', (e) => handleTagInput(e, 'form'));
    formTagsInput.addEventListener('keydown', (e) => handleTagKeyDown(e, 'form'));

    const modalTagsInput = document.getElementById('modal-tags-input');
    modalTagsInput.addEventListener('input', (e) => handleTagInput(e, 'modal'));
    modalTagsInput.addEventListener('keydown', (e) => handleTagKeyDown(e, 'modal'));
}

function toggleLanguage() {
    currentLang = currentLang === 'tr' ? 'en' : 'tr';
    document.getElementById('lang-toggle-btn').innerText = currentLang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
    updateUIStrings();
    applyFiltersAndSearch();
    loadInstructorsToSelect();
}

function updateUIStrings() {
    const lang = translations[currentLang];
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    document.getElementById('form-title').innerText = lang.formTitle;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-location').innerText = lang.lblLocation;
    document.getElementById('lbl-url').innerText = lang.lblUrl;
    document.getElementById('lbl-tags').innerText = lang.lblTags;
    document.getElementById('btn-submit-form').innerText = lang.btnSubmitForm;
    
    document.getElementById('btn-show-instructor-panel').innerText = lang.btnManageInstructors;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('btn-save-instructor').innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    document.getElementById('form-tags-input').placeholder = lang.addTagPlaceholder;
    document.getElementById('modal-tags-input').placeholder = lang.addTagPlaceholder;
    document.getElementById('drop-area-text').innerText = lang.dropText;
    document.getElementById('edit-tags-title').innerText = lang.editTagsTitle;

    const roleSelect = document.getElementById('filter-role-select');
    roleSelect.options[0].text = `🎬 ${lang.allRoles}`;
    roleSelect.options[1].text = lang.leader;
    roleSelect.options[2].text = lang.follower;
    roleSelect.options[3].text = lang.both;

    const locSelect = document.getElementById('filter-location-select');
    locSelect.options[0].text = `📍 ${lang.allLocations}`;
    locSelect.options[1].text = lang.drive;
    locSelect.options[2].text = lang.social;
}

function switchView(view) {
    currentView = view;
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');
    
    document.getElementById('top-filter-bar').classList.remove('d-none');
    document.getElementById('content-display-area').classList.remove('d-none');
    document.getElementById('add-video-form-container').classList.add('d-none');

    if (view === 'library') {
        document.getElementById('menu-library').classList.add('active');
        applyFiltersAndSearch();
    } else if (view === 'favorites') {
        document.getElementById('menu-favorites').classList.add('active');
        applyFiltersAndSearch();
    } else if (view === 'add-video') {
        document.getElementById('menu-add-video').classList.add('active');
        document.getElementById('top-filter-bar').classList.add('d-none');
        document.getElementById('content-display-area').classList.add('d-none');
        document.getElementById('add-video-form-container').classList.remove('d-none');
        resetVideoForm();
    }
}

// --- ETİKET YÖNETİM CHIPS YAPISI ---
function handleTagInput(e, type) {
    const input = e.target;
    const value = input.value;
    
    if (value.endsWith(',')) {
        const cleanTag = value.slice(0, -1).trim();
        if (cleanTag) {
            addChip(cleanTag, type);
        }
        input.value = '';
        hideSuggestions(type);
    } else {
        showSuggestions(value.trim(), type);
    }
}

function handleTagKeyDown(e, type) {
    const input = e.target;
    if (e.key === 'Enter') {
        e.preventDefault();
        const cleanTag = input.value.trim();
        if (cleanTag) {
            addChip(cleanTag, type);
        }
        input.value = '';
        hideSuggestions(type);
    } else if (e.key === 'Backspace' && input.value === '') {
        if (type === 'form') {
            formTagsArray.pop();
            renderChips('form');
        } else if (type === 'modal' && activeEditTagsVideoId) {
            const targetVideo = globalVideos.find(v => v.id === activeEditTagsVideoId);
            if (targetVideo && targetVideo.tags && targetVideo.tags.length > 0) {
                targetVideo.tags.pop();
                renderChips('modal');
                updateTagsInSupabase(activeEditTagsVideoId, targetVideo.tags);
            }
        }
    }
}

function addChip(tag, type) {
    if (type === 'form') {
        if (!formTagsArray.includes(tag)) {
            formTagsArray.push(tag);
            renderChips('form');
        }
    } else if (type === 'modal' && activeEditTagsVideoId) {
        const targetVideo = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (targetVideo) {
            if (!targetVideo.tags) targetVideo.tags = [];
            if (!targetVideo.tags.includes(tag)) {
                targetVideo.tags.push(tag);
                renderChips('modal');
                updateTagsInSupabase(activeEditTagsVideoId, targetVideo.tags);
            }
        }
    }
}

function removeChip(tag, type) {
    if (type === 'form') {
        formTagsArray = formTagsArray.filter(t => t !== tag);
        renderChips('form');
    } else if (type === 'modal' && activeEditTagsVideoId) {
        const targetVideo = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (targetVideo) {
            targetVideo.tags = targetVideo.tags.filter(t => t !== tag);
            renderChips('modal');
            updateTagsInSupabase(activeEditTagsVideoId, targetVideo.tags);
        }
    }
}

function renderChips(type) {
    if (type === 'form') {
        const area = document.getElementById('form-chips-area');
        area.innerHTML = '';
        formTagsArray.forEach(tag => {
            area.appendChild(createChipElement(tag, 'form'));
        });
    } else if (type === 'modal' && activeEditTagsVideoId) {
        const area = document.getElementById('modal-chips-area');
        area.innerHTML = '';
        const targetVideo = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (targetVideo && targetVideo.tags) {
            targetVideo.tags.forEach(tag => {
                area.appendChild(createChipElement(tag, 'modal'));
            });
        }
    }
}

function createChipElement(tag, type) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerText = tag;
    
    const removeBtn = document.createElement('span');
    removeBtn.className = 'remove-tag-btn';
    removeBtn.innerHTML = ' &times;';
    removeBtn.onclick = () => removeChip(tag, type);
    
    chip.appendChild(removeBtn);
    return chip;
}

function showSuggestions(query, type) {
    const listContainer = document.getElementById(`${type}-autocomplete-list`);
    listContainer.innerHTML = '';
    
    if (!query) {
        listContainer.classList.add('d-none');
        return;
    }

    const filtered = Array.from(uniqueExistingTags).filter(t => 
        t.toLowerCase().includes(query.toLowerCase())
    );

    if (filtered.length === 0) {
        listContainer.classList.add('d-none');
        return;
    }

    filtered.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerText = tag;
        item.onclick = () => {
            addChip(tag, type);
            document.getElementById(`${type}-tags-input`).value = '';
            listContainer.classList.add('d-none');
        };
        listContainer.appendChild(item);
    });

    listContainer.classList.remove('d-none');
}

function hideSuggestions(type) {
    setTimeout(() => {
        const list = document.getElementById(`${type}-autocomplete-list`);
        if (list) list.classList.add('d-none');
    }, 200);
}

// --- VERİTABANI VE SELECT YÜKLEMELERİ ---
async function loadInstructorsToSelect() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const instructors = await response.json();
        
        const selectElement = document.getElementById('video-instructor');
        selectElement.innerHTML = '';
        
        instructors.forEach(ins => {
            const opt = document.createElement('option');
            opt.value = ins.id;
            opt.innerText = ins.name;
            selectElement.appendChild(opt);
        });
        
        selectElement.onchange = () => {
            const deleteBtn = document.getElementById('btn-delete-instructor');
            if(selectElement.value) {
                deleteBtn.style.display = 'block';
                document.getElementById('new-instructor-name').value = selectElement.options[selectElement.selectedIndex].text;
                editInstructorId = selectElement.value;
                document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
            }
        };
        if(instructors.length > 0) selectElement.onchange();
    } catch (err) {
        console.error("Eğitmen yükleme hatası:", err);
    }
}

async function handleInstructorSubmit() {
    const nameInput = document.getElementById('new-instructor-name');
    const name = nameInput.value.trim();
    const lang = translations[currentLang];
    
    if (!name) {
        await showCustomAlert(lang.insAlert, "⚠️");
        return;
    }

    try {
        let response;
        if (editInstructorId) {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${editInstructorId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ name })
            });
            if (response.ok) await showCustomAlert(lang.insUpdateSuccess, "🎉");
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({ name })
            });
            if (response.ok) await showCustomAlert(lang.insSuccess, "🎉");
        }

        nameInput.value = '';
        editInstructorId = null;
        document.getElementById('new-instructor-container').classList.add('d-none');
        await loadInstructorsToSelect();
        await fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function deleteInstructor() {
    const selectElement = document.getElementById('video-instructor');
    const id = selectElement.value;
    const lang = translations[currentLang];
    
    if(!id) return;
    
    const confirm = await showCustomConfirm(lang.deleteConfirm, "⚠️");
    if (!confirm) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        if (response.ok) {
            await showCustomAlert(lang.insDeleteSuccess, "💥");
            document.getElementById('new-instructor-name').value = '';
            editInstructorId = null;
            document.getElementById('btn-delete-instructor').style.display = 'none';
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            await loadInstructorsToSelect();
            await fetchVideos();
        }
    } catch (err) {
        console.error(err);
    }
}

async function fetchVideos() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(*)&order=created_at.desc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        globalVideos = await response.json();
        
        uniqueExistingTags.clear();
        globalVideos.forEach(v => {
            if (v.tags && Array.isArray(v.tags)) {
                v.tags.forEach(t => uniqueExistingTags.add(t));
            }
        });

        document.getElementById('loading-message').classList.add('d-none');
        document.getElementById('cards-grid').classList.remove('d-none');
        applyFiltersAndSearch();
    } catch (err) {
        document.getElementById('loading-message').innerText = translations[currentLang].error;
        console.error(err);
    }
}

function applyFiltersAndSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const roleFilter = document.getElementById('filter-role-select').value;
    const locFilter = document.getElementById('filter-location-select').value;
    const favs = getFavorites();

    let filtered = globalVideos;

    if (currentView === 'favorites') {
        filtered = filtered.filter(v => favs.includes(v.id));
    }

    if (roleFilter !== 'all') {
        filtered = filtered.filter(v => v.role === roleFilter);
    }
    if (locFilter !== 'all') {
        filtered = filtered.filter(v => v.location === locFilter);
    }

    if (query) {
        filtered = filtered.filter(v => {
            const insName = v.instructors?.name?.toLowerCase() || '';
            const partner = v.partner?.toLowerCase() || '';
            const tagsMatch = v.tags && v.tags.some(t => t.toLowerCase().includes(query));
            return insName.includes(query) || partner.includes(query) || tagsMatch;
        });
    }

    renderCards(filtered);
}

function renderCards(videos) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';
    const lang = translations[currentLang];
    const favs = getFavorites();

    if (videos.length === 0) {
        grid.innerHTML = `<div class="status-message" style="grid-column: 1/-1;">${currentView === 'favorites' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    if (currentView === 'favorites') {
        const clearBtnContainer = document.createElement('div');
        clearBtnContainer.style.cssText = "grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-bottom: 10px;";
        clearBtnContainer.innerHTML = `<button id='btn-clear-all-favs' class='card-crud-btn btn-delete' style='padding: 10px 20px; max-width:350px;'>${lang.btnClearFavorites}</button>`;
        grid.appendChild(clearBtnContainer);
        document.getElementById('btn-clear-all-favs').onclick = clearAllFavorites;
    }

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card animate-fade-in';

        const isFav = favs.includes(video.id);
        const coverImg = video.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500';

        let tagsHTML = '';
        if (video.tags && video.tags.length > 0) {
            video.tags.forEach(t => {
                tagsHTML += `<span class="tag-chip clickable">${t}</span>`;
            });
        }

        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${coverImg}" class="card-image" alt="Tango Cover">
                <span class="card-badge">${video.location === 'Google Drive' ? '💾 Drive' : '🌐 Sosyal'}</span>
                <button class="card-fav-btn ${isFav ? 'active' : ''}" data-id="${video.id}">⭐</button>
            </div>
            <div class="card-content">
                <h3 class="card-title">${video.instructors?.name || 'Bilinmeyen Eğitmen'}</h3>
                <div class="card-subtitle">${video.partner ? 'ft. ' + video.partner : ''} | 🎬 ${video.role}</div>
                <div class="card-tags">${tagsHTML}</div>
                <button class="submit-btn btn-watch-trigger" style="padding: 8px; font-size: 0.85rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #fff;">${lang.watch}</button>
                
                <div class="card-actions-wrapper">
                    <button class="card-crud-btn btn-edit-tags" data-id="${video.id}">${lang.btnCardEdit}</button>
                    <button class="card-crud-btn btn-delete-video btn-delete" data-id="${video.id}">${lang.btnCardDelete}</button>
                </div>
            </div>
        `;

        card.querySelector('.card-image-wrapper').onclick = (e) => {
            if (!e.target.classList.contains('card-fav-btn')) {
                openVideoModal(video.url);
            }
        };
        card.querySelector('.btn-watch-trigger').onclick = () => openVideoModal(video.url);
        card.querySelector('.card-fav-btn').onclick = () => toggleFavorite(video.id);
        card.querySelector('.btn-edit-tags').onclick = () => openTagsEditModal(video.id);
        card.querySelector('.btn-delete-video').onclick = () => deleteVideo(video.id);
        
        card.querySelectorAll('.tag-chip.clickable').forEach(chip => {
            chip.onclick = () => {
                document.getElementById('search-input').value = chip.innerText;
                applyFiltersAndSearch();
            };
        });

        grid.appendChild(card);
    });
}

async function deleteVideo(id) {
    const lang = translations[currentLang];
    const confirm = await showCustomConfirm(lang.confirmDeleteVideo, "⚠️");
    if (!confirm) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (response.ok) {
            await showCustomAlert(lang.successDeleteVideo, "💥");
            await fetchVideos();
        }
    } catch (err) {
        console.error(err);
    }
}

function openTagsEditModal(videoId) {
    activeEditTagsVideoId = videoId;
    renderChips('modal');
    document.getElementById('tags-edit-modal').classList.remove('d-none');
}

function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
    applyFiltersAndSearch();
}

async function updateTagsInSupabase(videoId, tagsArray) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags: tagsArray })
        });
        tagsArray.forEach(t => uniqueExistingTags.add(t));
    } catch (err) {
        console.error("Etiket bulut senkronizasyon hatası:", err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const instructor_id = document.getElementById('video-instructor').value;
    const partner = document.getElementById('video-partner').value.trim();
    const role = document.getElementById('video-role').value;
    const location = document.getElementById('video-location').value;
    const url = document.getElementById('video-url').value.trim();
    const cover_url = getUploadedCoverUrl();

    const payload = {
        instructor_id,
        partner: partner || null,
        role,
        location,
        url,
        cover_url,
        tags: formTagsArray
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            await showCustomAlert(translations[currentLang].videoSuccess, "🎉");
            resetVideoForm();
            await fetchVideos();
            switchView('library');
        }
    } catch (err) {
        console.error(err);
    }
}

function resetVideoForm() {
    document.getElementById('add-video-form').reset();
    formTagsArray = [];
    renderChips('form');
    resetUploadedCoverUrl();
    const imgPreview = document.getElementById('image-preview');
    if (imgPreview) {
        imgPreview.src = '';
        imgPreview.classList.add('d-none');
    }
    const dropText = document.getElementById('drop-area-text');
    if (dropText) {
        dropText.innerText = translations[currentLang].dropText;
        dropText.classList.remove('d-none');
    }
}

function openVideoModal(url) {
    let embedUrl = url;
    if (url.includes('youtube.com/watch?v=')) {
        embedUrl = url.replace('watch?v=', 'embed/');
    } else if (url.includes('youtu.be/')) {
        embedUrl = url.replace('youtu.be/', 'youtube.com/embed/');
    }
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}