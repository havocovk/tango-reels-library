import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 

// Form ve Modal etiket yönetim dizileri
let formTagsArray = [];
let modalTagsArray = [];
let activeEditTagsVideoId = null; 

// DIZAYN GEREĞİ TÜM STANDART ALERT() VE CONFIRM() YAPILARINI POP-UP STİLİNE ÇEVİREN YARDIMCI FONKSİYON
function showPopupNotification(message, isConfirm = false, onConfirmCallback = null) {
    const modal = document.getElementById('notification-modal');
    const msgEl = document.getElementById('notification-message');
    const btnClose = document.getElementById('notification-btn-close');
    const btnConfirm = document.getElementById('notification-btn-confirm');
    const btnCancel = document.getElementById('notification-btn-cancel');

    msgEl.innerText = message;
    modal.classList.remove('d-none');

    if (isConfirm) {
        btnClose.classList.add('d-none');
        btnConfirm.classList.remove('d-none');
        btnCancel.classList.remove('d-none');

        // Önceki olay dinleyicileri temizle
        const cleanConfirm = btnConfirm.cloneNode(true);
        const cleanCancel = btnCancel.cloneNode(true);
        btnConfirm.parentNode.replaceChild(cleanConfirm, btnConfirm);
        btnCancel.parentNode.replaceChild(cleanCancel, btnCancel);

        document.getElementById('notification-btn-confirm').addEventListener('click', () => {
            modal.classList.add('d-none');
            if (onConfirmCallback) onConfirmCallback();
        });

        document.getElementById('notification-btn-cancel').addEventListener('click', () => {
            modal.classList.add('d-none');
        });
    } else {
        btnClose.classList.remove('d-none');
        btnConfirm.classList.add('d-none');
        btnCancel.classList.add('d-none');

        const cleanClose = btnClose.cloneNode(true);
        btnClose.parentNode.replaceChild(cleanClose, btnClose);

        document.getElementById('notification-btn-close').addEventListener('click', () => {
            modal.classList.add('d-none');
        });
    }
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

function clearAllFavorites() {
    const lang = translations[currentLang];
    showPopupNotification(lang.confirmClearFavs, true, () => {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        applyFiltersAndSearch();
    });
}

// Supabase API Talepleri
async function makeRequest(endpoint, options = {}) {
    const baseHeaders = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
    };
    options.headers = { ...baseHeaders, ...options.headers };
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }
    if (options.method === 'POST' || options.headers['Prefer']?.includes('return=representation')) {
        return await response.json();
    }
    return response;
}

// Ortak Etiket Havuzunu Alma
async function fetchAllDistinctTags() {
    try {
        const data = await makeRequest('videos?select=tags');
        const set = new Set();
        data.forEach(item => {
            if (item.tags && Array.isArray(item.tags)) {
                item.tags.forEach(t => set.add(t.trim()));
            }
        });
        return Array.from(set);
    } catch (e) {
        return [];
    }
}

// Eğitmenleri Çekme ve Seçim Kutusunu Doldurma
async function loadInstructors() {
    try {
        const data = await makeRequest('instructors?select=*&order=name.asc');
        const select = document.getElementById('video-instructor');
        select.innerHTML = `<option value="">-- ${currentLang === 'tr' ? 'Eğitmen Seçin' : 'Select Instructor'} --</option>`;
        
        data.forEach(ins => {
            const opt = document.createElement('option');
            opt.value = ins.id;
            opt.innerText = ins.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
    }
}

// Eğitmen Ekleme / Güncelleme
async function handleInstructorSubmit() {
    const input = document.getElementById('new-instructor-name');
    const name = input.value.trim();
    const lang = translations[currentLang];

    if (!name) {
        showPopupNotification(lang.insAlert);
        return;
    }

    try {
        if (editInstructorId) {
            await makeRequest(`instructors?id=eq.${editInstructorId}`, {
                method: 'PATCH',
                body: JSON.stringify({ name })
            });
            showPopupNotification(lang.insUpdateSuccess);
            editInstructorId = null;
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        } else {
            await makeRequest('instructors', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            showPopupNotification(lang.insSuccess);
        }
        input.value = '';
        await loadInstructors();
        await loadVideos();
    } catch (err) {
        console.error(err);
    }
}

// Eğitmen Silme
async function deleteInstructor() {
    const select = document.getElementById('video-instructor');
    const id = select.value;
    const lang = translations[currentLang];

    if (!id) return;

    showPopupNotification(lang.deleteConfirm, true, async () => {
        try {
            await makeRequest(`instructors?id=eq.${id}`, { method: 'DELETE' });
            showPopupNotification(lang.insDeleteSuccess);
            select.value = '';
            document.getElementById('new-instructor-name').value = '';
            editInstructorId = null;
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            await loadInstructors();
            await loadVideos();
        } catch (err) {
            console.error(err);
        }
    });
}

// Videoları Çekme
async function loadVideos() {
    const grid = document.getElementById('video-grid');
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#94a3b8;">${translations[currentLang].loading}</div>`;
    
    try {
        globalVideos = await makeRequest('videos?select=*,instructors(*)&order=created_at.desc');
        applyFiltersAndSearch();
    } catch (err) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#ef4444;">${translations[currentLang].error}</div>`;
    }
}

// Arama ve Filtreleme Motoru
function applyFiltersAndSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const role = document.getElementById('filter-role-select').value;
    const loc = document.getElementById('filter-location-select').value;
    const favorites = getFavorites();

    let filtered = globalVideos;

    if (currentView === 'favorites') {
        filtered = filtered.filter(v => favorites.includes(v.id));
    }
    if (role !== 'ALL') {
        filtered = filtered.filter(v => v.role === role);
    }
    if (loc !== 'ALL') {
        filtered = filtered.filter(v => v.location === loc);
    }
    if (query) {
        filtered = filtered.filter(v => {
            const t = (v.title || '').toLowerCase();
            const p = (v.partner || '').toLowerCase();
            const i = v.instructors ? (v.instructors.name || '').toLowerCase() : '';
            const tagsMatch = v.tags && v.tags.some(tag => tag.toLowerCase().includes(query));
            return t.includes(query) || p.includes(query) || i.includes(query) || tagsMatch;
        });
    }

    renderGrid(filtered);
}

// Grid Renderlama
function renderGrid(videos) {
    const grid = document.getElementById('video-grid');
    grid.innerHTML = '';
    const lang = translations[currentLang];
    const favorites = getFavorites();

    if (videos.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:60px; color:#64748b; font-size:1.05rem; line-height:1.7;">${currentView === 'favorites' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    videos.forEach(v => {
        const isFav = favorites.includes(v.id);
        const card = document.createElement('div');
        card.className = 'card-glass';

        const coverSrc = v.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=cover&q=60';

        let tagsHtml = '';
        if (v.tags && Array.isArray(v.tags)) {
            v.tags.forEach(t => {
                tagsHtml += `<span class="tag-chip" data-tag="${t.trim()}">#${t.trim()}</span>`;
            });
        }

        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${coverSrc}" alt="Cover">
                <span class="card-badge">${lang[v.location.toLowerCase()] || v.location}</span>
                <button class="card-fav-btn ${isFav ? 'active' : ''}" data-id="${v.id}">⭐</button>
            </div>
            <div class="card-body">
                <h3 class="card-title">${v.title}</h3>
                <div class="card-info-row">
                    <span>🕺 ${v.instructors ? v.instructors.name : '-'}</span>
                    ${v.partner ? `<span>💃 ${v.partner}</span>` : ''}
                </div>
                <div class="card-tags">${tagsHtml}</div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <button class="card-crud-btn edit-video-trigger" data-id="${v.id}">${lang.btnCardEdit}</button>
                    <button class="card-crud-btn edit-tags-trigger" data-id="${v.id}">🏷️ Etiketler</button>
                    <button class="card-crud-btn delete-video-trigger" data-id="${v.id}">${lang.btnCardDelete}</button>
                </div>
                <a href="#" class="card-action-btn watch-trigger" data-url="${v.url}">${lang.watch}</a>
            </div>
        `;
        grid.appendChild(card);
    });

    // Kart Olaylarını Bağlama
    grid.querySelectorAll('.card-fav-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(b.getAttribute('data-id'));
        });
    });

    grid.querySelectorAll('.watch-trigger').forEach(b => {
        b.addEventListener('click', (e) => {
            e.preventDefault();
            openVideoModal(b.getAttribute('data-url'));
        });
    });

    grid.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const clickedTag = chip.getAttribute('data-tag');
            const searchInput = document.getElementById('search-input');
            searchInput.value = clickedTag;
            applyFiltersAndSearch();
        });
    });

    grid.querySelectorAll('.edit-tags-trigger').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(b.getAttribute('data-id'));
        });
    });

    grid.querySelectorAll('.edit-video-trigger').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerVideoEdit(b.getAttribute('data-id'));
        });
    });

    grid.querySelectorAll('.delete-video-trigger').forEach(b => {
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerVideoDelete(b.getAttribute('data-id'));
        });
    });
}

// Gelişmiş Video Düzenleme Tetikçisi
function triggerVideoEdit(id) {
    const video = globalVideos.find(v => v.id == id);
    if (!video) return;

    editingVideoId = video.id; 
    switchView('add-video');

    document.getElementById('video-title').value = video.title;
    document.getElementById('video-url').value = video.url;
    document.getElementById('video-role').value = video.role;
    document.getElementById('video-location').value = video.location;
    document.getElementById('video-instructor').value = video.instructor_id || '';
    document.getElementById('video-partner').value = video.partner || '';

    formTagsArray = video.tags ? [...video.tags] : [];
    renderChips('form');

    if (video.cover_url) {
        const preview = document.getElementById('image-preview');
        preview.src = video.cover_url;
        preview.classList.remove('d-none');
        document.getElementById('drop-area-text').classList.add('d-none');
    } else {
        resetCoverZone();
    }

    const lang = translations[currentLang];
    document.getElementById('form-title').innerText = currentLang === 'tr' ? "✏️ Videoyu Düzenle" : "✏️ Edit Video";
    document.getElementById('btn-save').innerText = currentLang === 'tr' ? "💾 Değişiklikleri Kaydet" : "💾 Save Changes";
}

// Video Silme Mekanizması
function triggerVideoDelete(id) {
    const lang = translations[currentLang];
    showPopupNotification(lang.confirmDeleteVideo, true, async () => {
        try {
            await makeRequest(`videos?id=eq.${id}`, { method: 'DELETE' });
            showPopupNotification(lang.successDeleteVideo);
            await loadVideos();
        } catch (e) {
            console.error(e);
        }
    });
}

// Revize Edilmiş Etiket Pop-up Açılışı (Gereksiz üst alan kaldırıldı)
async function openTagsEditModal(videoId) {
    activeEditTagsVideoId = videoId;
    const video = globalVideos.find(v => v.id == videoId);
    if (!video) return;

    modalTagsArray = video.tags ? [...video.tags] : [];
    
    // Sadece alt kısımdaki chips alanını renderlıyoruz
    renderChips('modal');

    document.getElementById('tags-edit-modal').classList.remove('d-none');
}

// Etiket Değişikliklerini Kaydetme Fonksiyonu
async function saveTagsMutation(type) {
    if (type === 'modal' && activeEditTagsVideoId) {
        try {
            await makeRequest(`videos?id=eq.${activeEditTagsVideoId}`, {
                method: 'PATCH',
                body: JSON.stringify({ tags: modalTagsArray })
            });
            await loadVideos();
        } catch (e) {
            console.error(e);
        }
    }
}

function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
}

// Video Kaydetme / Güncelleme Form Gönderimi
async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const title = document.getElementById('video-title').value.trim();
    const url = document.getElementById('video-url').value.trim();
    const role = document.getElementById('video-role').value;
    const location = document.getElementById('video-location').value;
    const instructor_id = document.getElementById('video-instructor').value;
    const partner = document.getElementById('video-partner').value.trim();
    const cover_url = getUploadedCoverUrl() || (editingVideoId ? globalVideos.find(v => v.id === editingVideoId)?.cover_url : null);

    const payload = {
        title,
        url,
        role,
        location,
        instructor_id: parseInt(instructor_id),
        partner: partner || null,
        tags: formTagsArray,
        cover_url
    };

    try {
        if (editingVideoId) {
            await makeRequest(`videos?id=eq.${editingVideoId}`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
            showPopupNotification(currentLang === 'tr' ? "🎉 Video başarıyla güncellendi!" : "🎉 Video successfully updated!");
        } else {
            await makeRequest('videos', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showPopupNotification(currentLang === 'tr' ? "🎉 Yeni video başarıyla kütüphaneye eklendi!" : "🎉 New video successfully added!");
        }

        // Formu temizle
        document.getElementById('add-video-form').reset();
        formTagsArray = [];
        renderChips('form');
        resetCoverZone();
        resetUploadedCoverUrl();
        
        editingVideoId = null; 
        document.getElementById('form-title').innerText = lang.formTitle;
        document.getElementById('btn-save').innerText = lang.btnSave;

        switchView('library');
        await loadVideos();
    } catch (err) {
        console.error(err);
    }
}

function resetCoverZone() {
    const preview = document.getElementById('image-preview');
    if (preview) preview.classList.add('d-none');
    const dropText = document.getElementById('drop-area-text');
    if (dropText) {
        dropText.classList.remove('d-none');
        dropText.innerText = translations[currentLang].dropText;
    }
}

// Chips/Etiket Render Motoru
function renderChips(context) {
    const area = document.getElementById(`${context}-chips-area`);
    if (!area) return;
    area.innerHTML = '';

    const arr = context === 'form' ? formTagsArray : modalTagsArray;

    arr.forEach((tag, idx) => {
        const chip = document.createElement('div');
        chip.className = 'chip-item';
        chip.innerHTML = `
            <span>${tag}</span>
            <button type="button" class="chip-close-btn" data-index="${idx}">&times;</button>
        `;
        area.appendChild(chip);
    });

    area.querySelectorAll('.chip-close-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const index = parseInt(btn.getAttribute('data-index'));
            if (context === 'form') {
                formTagsArray.splice(index, 1);
                renderChips('form');
            } else {
                modalTagsArray.splice(index, 1);
                renderChips('modal');
                await saveTagsMutation('modal');
            }
        });
    });
}

// Akıllı Etiket Ekleme ve Autocomplete Entegrasyonu
function setupAutocomplete(context) {
    const input = document.getElementById(`${context}-tags-input`);
    const list = document.getElementById(`${context}-autocomplete-list`);

    input.addEventListener('input', async () => {
        const val = input.value.trim().toLowerCase();
        if (!val) {
            list.classList.add('d-none');
            return;
        }
        const allTags = await fetchAllDistinctTags();
        const arr = context === 'form' ? formTagsArray : modalTagsArray;
        const filtered = allTags.filter(t => t.toLowerCase().includes(val) && !arr.includes(t));

        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }

        list.innerHTML = '';
        filtered.forEach(t => {
            const row = document.createElement('div');
            row.className = 'autocomplete-suggestion-item';
            row.innerText = t;
            row.addEventListener('click', async () => {
                if (context === 'form') {
                    formTagsArray.push(t);
                    renderChips('form');
                } else {
                    modalTagsArray.push(t);
                    renderChips('modal');
                    await saveTagsMutation('modal');
                }
                input.value = '';
                list.classList.add('d-none');
            });
            list.appendChild(row);
        });
        list.classList.remove('d-none');
    });

    input.addEventListener('keydown', async (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.replace(/,/g, '').trim();
            if (val) {
                const arr = context === 'form' ? formTagsArray : modalTagsArray;
                if (!arr.includes(val)) {
                    arr.push(val);
                    renderChips(context);
                    if (context === 'modal') await saveTagsMutation('modal');
                }
            }
            input.value = '';
            list.classList.add('d-none');
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest(`#${context}-tags-wrapper`)) {
            list.classList.add('d-none');
        }
    });
}

// Oynatıcı Modal Yönetimi
function openVideoModal(url) {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    const fallback = document.getElementById('modal-fallback-link');

    iframe.classList.add('d-none');
    fallback.classList.add('d-none');
    iframe.src = '';

    if (url.includes('drive.google.com')) {
        let embedUrl = url;
        if (url.includes('/view')) {
            embedUrl = url.replace('/view', '/preview');
        } else if (url.includes('/file/d/')) {
            const parts = url.split('/file/d/');
            const id = parts[1].split('/')[0];
            embedUrl = `https://drive.google.com/file/d/${id}/preview`;
        }
        iframe.src = embedUrl;
        iframe.classList.remove('d-none');
    } else {
        fallback.href = url;
        fallback.classList.remove('d-none');
    }
    modal.classList.remove('d-none');
}

function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    iframe.src = '';
    modal.classList.add('d-none');
}

// Görünüm Değiştirici (Tab)
function switchView(viewId) {
    currentView = viewId;
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('d-none'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));

    const btnClearFav = document.getElementById('btn-clear-favorites');

    if (viewId === 'library') {
        document.getElementById('library-view').classList.remove('d-none');
        document.getElementById('menu-library').classList.add('active');
        if (btnClearFav) btnClearFav.classList.add('d-none');
        loadVideos();
    } else if (viewId === 'favorites') {
        document.getElementById('library-view').classList.remove('d-none');
        document.getElementById('menu-favorites').classList.add('active');
        if (btnClearFav) btnClearFav.classList.remove('d-none');
        applyFiltersAndSearch();
    } else if (viewId === 'add-video') {
        document.getElementById('add-video-view').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
    }
}

// Dil Çeviri Sistemi
function updateLanguageUI() {
    const lang = translations[currentLang];
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('lang-toggle-btn').innerText = currentLang === 'tr' ? "🇬🇧 EN" : "🇹🇷 TR";
    
    document.getElementById('menu-library').innerHTML = `📚 ${lang.menuLibrary.split(' ')[1] || lang.menuLibrary}`;
    document.getElementById('menu-favorites').innerHTML = `⭐ ${lang.menuFavorites.split(' ')[1] || lang.menuFavorites}`;
    document.getElementById('menu-add-video').innerHTML = `➕ ${lang.menuAddVideo.split(' ')[2] || lang.menuAddVideo}`;

    document.getElementById('main-title').innerText = lang.title;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    const btnClearFav = document.getElementById('btn-clear-favorites');
    if (btnClearFav) btnClearFav.innerText = lang.btnClearFavorites;

    // Seçim Kutuları Dil Çevirileri
    const roleSel = document.getElementById('filter-role-select');
    roleSel.options[0].text = lang.allRoles;
    roleSel.options[1].text = lang.leader;
    roleSel.options[2].text = lang.follower;
    roleSel.options[3].text = lang.both;

    const locSel = document.getElementById('filter-location-select');
    locSel.options[0].text = lang.allLocations;
    locSel.options[1].text = lang.drive;
    locSel.options[2].text = lang.social;

    // Form Elemanları Dil Çevirileri
    if (!editingVideoId) {
        document.getElementById('form-title').innerText = lang.formTitle;
        document.getElementById('btn-save').innerText = lang.btnSave;
    }
    document.getElementById('lbl-title').innerText = lang.lblTitle;
    document.getElementById('lbl-url').innerText = lang.lblUrl;
    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-location').innerText = lang.lblLocation;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    document.getElementById('lbl-tags').innerText = lang.lblTags;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
    document.getElementById('btn-delete-instructor').innerText = lang.insDeleteSuccess.split(' ')[0] === '💥' ? 'Sil' : 'Delete';
    document.getElementById('edit-tags-title').innerText = lang.editTagsTitle;
    document.getElementById('form-tags-input').placeholder = lang.addTagPlaceholder;
    document.getElementById('modal-tags-input').placeholder = lang.addTagPlaceholder;

    const dropText = document.getElementById('drop-area-text');
    if (dropText && !dropText.classList.contains('d-none')) {
        dropText.innerText = lang.dropText;
    }

    loadInstructors().then(() => {
        applyFiltersAndSearch();
    });
}

// Olay Dinleyicileri Kurulumu
document.addEventListener('DOMContentLoaded', () => {
    loadInstructors();
    loadVideos();
    setupAutocomplete('form');
    setupAutocomplete('modal');

    document.getElementById('menu-library').addEventListener('click', () => switchView('library'));
    document.getElementById('menu-favorites').addEventListener('click', () => switchView('favorites'));
    document.getElementById('menu-add-video').addEventListener('click', () => {
        editingVideoId = null;
        document.getElementById('add-video-form').reset();
        formTagsArray = [];
        renderChips('form');
        resetCoverZone();
        resetUploadedCoverUrl();
        const lang = translations[currentLang];
        document.getElementById('form-title').innerText = lang.formTitle;
        document.getElementById('btn-save').innerText = lang.btnSave;
        switchView('add-video');
    });

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateLanguageUI();
    });

    document.getElementById('btn-clear-favorites').addEventListener('click', clearAllFavorites);

    document.getElementById('btn-toggle-instructor-panel').addEventListener('click', () => {
        const box = document.getElementById('new-instructor-container');
        box.classList.toggle('d-none');
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
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});