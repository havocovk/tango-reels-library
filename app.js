import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let globalFavorites = []; // Favori video id'lerini veritabanından anlık senkronize tutar
let editInstructorId = null;
let editingVideoId = null; // Düzenlenen videonun ID'sini tutar (null ise yeni kayıttır)
let currentView = 'library'; 

// Form ve Modal etiket yönetim dizileri
let formTagsArray = [];
let modalTagsArray = [];
let activeEditTagsVideoId = null; // Pop-up'ta düzenlenen video ID'si

// 🔄 Supabase'den güncel favori listesini çekme
async function fetchFavorites() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites?select=video_id`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (response.ok) {
            const data = await response.json();
            globalFavorites = data.map(f => f.video_id);
        }
    } catch (err) {
        console.error("Favoriler yüklenirken hata oluştu:", err);
    }
}

// ⭐ Yıldız durumunu Supabase'de güncelleme (Toggle)
async function toggleFavorite(videoId) {
    const isFav = globalFavorites.includes(Number(videoId)) || globalFavorites.includes(String(videoId));
    
    try {
        if (isFav) {
            // Favorilerden sil
            await fetch(`${SUPABASE_URL}/rest/v1/favorites?video_id=eq.${videoId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
        } else {
            // Favorilere ekle
            await fetch(`${SUPABASE_URL}/rest/v1/favorites`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ video_id: videoId })
            });
        }
        // UI, Realtime kanalından veya yerel tahminle anında güncellenecek
    } catch (err) {
        console.error("Favori güncellenirken hata oluştu:", err);
    }
}

// 🗑️ Pratik Listesini Onaylı Toplu Temizleme
async function clearAllFavorites() {
    const lang = translations[currentLang];
    if (confirm(lang.confirmClearFavs)) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/favorites?video_id=not.is.null`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
        } catch (err) {
            console.error("Pratik listesi temizlenirken hata:", err);
        }
    }
}

// 📡 Supabase Realtime Bağlantısı
function setupRealtimeSubscription() {
    try {
        const ws = new WebSocket(`wss://${SUPABASE_URL.replace('https://', '')}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`);
        
        ws.onopen = () => {
            ws.send(JSON.stringify({
                topic: 'realtime:public:favorites',
                event: 'phx_join',
                payload: {},
                ref: '1'
            }));
            
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: '' }));
                }
            }, 30000);
        };

        ws.onmessage = async (e) => {
            const msg = JSON.parse(e.data);
            if (msg.topic === 'realtime:public:favorites' && (msg.event === 'INSERT' || msg.event === 'DELETE' || msg.event === '*')) {
                await fetchFavorites();
                applyFiltersAndSearch();
            }
        };

        ws.onclose = () => {
            setTimeout(setupRealtimeSubscription, 5000);
        };
        
        ws.onerror = (err) => {
            console.error("WebSocket Hatası:", err);
        };
    } catch (e) {
        console.error("Realtime aboneliği kurulamadı:", e);
    }
}

async function initApp() {
    // Menü, dil ve temel eventlerin gecikmesiz çalışması için ilk önce dinleyicileri bağlıyoruz
    setupLanguages();
    setupMenu();
    setupEventListeners();
    setupFormTagsInput();
    setupModalTagsInput();

    // Veritabanı bağlantısını arka planda asenkron test edip yüklemeleri başlatıyoruz
    testConnection().then(async (isConnected) => {
        if (!isConnected) {
            document.getElementById('loading-element').innerText = translations[currentLang].error;
            return;
        }
        
        // Verileri arka planda sırayla yükle
        await fetchFavorites();
        await fetchInstructors();
        await fetchVideos();
        
        // Realtime aboneliğini aktif et
        setupRealtimeSubscription();

        // Yükleniyor görsel durumunu kaldır ve kütüphaneyi ekrana bas
        document.getElementById('loading-element').classList.add('d-none');
        applyFiltersAndSearch();
    }).catch(err => {
        console.error("Uygulama yüklenirken hata oluştu:", err);
        document.getElementById('loading-element').innerText = translations[currentLang].error;
    });
}

async function testConnection() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=id&limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function fetchInstructors() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?order=name.asc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (response.ok) {
            const data = await response.json();
            updateInstructorSelect(data);
        }
    } catch (err) {
        console.error(err);
    }
}

function updateInstructorSelect(instructors) {
    const select = document.getElementById('instructor-select');
    if (!select) return;
    select.innerHTML = '';
    instructors.forEach(ins => {
        const option = document.createElement('option');
        option.value = ins.id;
        option.text = ins.name;
        select.appendChild(option);
    });
}

async function fetchVideos() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (response.ok) {
            globalVideos = await response.json();
        }
    } catch (err) {
        console.error(err);
    }
}

function applyFiltersAndSearch() {
    const searchInput = document.getElementById('search-input').value.toLowerCase().trim();
    const roleSelect = document.getElementById('filter-role-select').value;
    const locationSelect = document.getElementById('filter-location-select').value;
    const videoGrid = document.getElementById('video-grid');
    const emptyElement = document.getElementById('empty-element');
    
    if (!videoGrid) return;
    videoGrid.innerHTML = '';
    let filtered = [...globalVideos];

    if (currentView === 'favorites') {
        filtered = filtered.filter(v => globalFavorites.includes(Number(v.id)) || globalFavorites.includes(String(v.id)));
    }

    if (roleSelect !== 'ALL') {
        filtered = filtered.filter(v => v.role === roleSelect);
    }

    if (locationSelect !== 'ALL') {
        filtered = filtered.filter(v => v.location === locationSelect);
    }

    if (searchInput) {
        filtered = filtered.filter(v => {
            const partner = (v.partner_name || '').toLowerCase();
            const instructor = (v.instructor_name || '').toLowerCase();
            const tags = Array.isArray(v.tags) ? v.tags.map(t => t.toLowerCase()) : [];
            
            return partner.includes(searchInput) || 
                   instructor.includes(searchInput) || 
                   tags.some(t => t.includes(searchInput));
        });
    }

    const lang = translations[currentLang];
    if (filtered.length === 0) {
        emptyElement.innerHTML = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        emptyElement.classList.remove('d-none');
        return;
    }
    
    emptyElement.classList.add('d-none');
    filtered.forEach(video => {
        const card = createVideoCard(video);
        videoGrid.appendChild(card);
    });
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';

    const isFav = globalFavorites.includes(Number(video.id)) || globalFavorites.includes(String(video.id));
    const defaultCover = 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60';
    const coverUrl = video.cover_url || defaultCover;
    const lang = translations[currentLang];

    let tagsHTML = '';
    if (Array.isArray(video.tags)) {
        video.tags.forEach(tag => {
            tagsHTML += `<span class="tag-chip">#${tag}</span>`;
        });
    }

    card.innerHTML = `
        <div class="card-cover-container">
            <img src="${coverUrl}" alt="Cover" class="card-cover">
            <button class="card-fav-btn ${isFav ? 'active' : ''}" data-id="${video.id}">★</button>
        </div>
        <div class="card-body">
            <div class="card-instructor">${video.instructor_name || ''}</div>
            <div class="card-partner">${video.partner_name || 'Generic Partner'}</div>
            <div class="card-meta">
                <span>${lang.role}: ${lang[video.role.toLowerCase()] || video.role}</span>
                <span>${lang.location}: ${lang[video.location.toLowerCase()] || video.location}</span>
            </div>
            <div class="card-tags">${tagsHTML}</div>
            <div class="card-action">
                <a href="#" class="watch-link" data-url="${video.url}">${lang.watch}</a>
                <div style="display:flex; gap:6px;">
                    <button class="card-crud-btn edit" data-id="${video.id}">${lang.btnCardEdit}</button>
                    <button class="card-crud-btn delete" data-id="${video.id}">${lang.btnCardDelete}</button>
                </div>
            </div>
        </div>
    `;

    card.querySelector('.card-fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(video.id);
        e.target.classList.toggle('active');
    });

    card.querySelector('.card-cover-container').addEventListener('click', () => {
        openVideoModal(video.url);
    });

    card.querySelector('.watch-link').addEventListener('click', (e) => {
        e.preventDefault();
        openVideoModal(video.url);
    });

    card.querySelector('.card-crud-btn.edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openTagsEditModal(video);
    });

    card.querySelector('.card-crud-btn.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteVideo(video.id);
    });

    return card;
}

function openVideoModal(url) {
    let embedUrl = url;
    if (url.includes('drive.google.com')) {
        embedUrl = url.replace('/view?usp=sharing', '/preview').replace('/view', '/preview');
    }
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}

async function deleteVideo(videoId) {
    const lang = translations[currentLang];
    if (!confirm(lang.confirmDeleteVideo)) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            alert(lang.successDeleteVideo);
            await fetchVideos();
            applyFiltersAndSearch();
        }
    } catch (err) {
        console.error(err);
    }
}

function openTagsEditModal(video) {
    activeEditTagsVideoId = video.id;
    modalTagsArray = Array.isArray(video.tags) ? [...video.tags] : [];
    renderModalChips();
    
    const listContainer = document.getElementById('modal-tags-list-container');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    modalTagsArray.forEach((tag, index) => {
        const row = document.createElement('div');
        row.className = 'modal-tag-row';
        row.innerHTML = `
            <input type="text" class="modal-tag-edit-input" value="${tag}" data-index="${index}">
            <button class="modal-tag-row-delete-btn" data-index="${index}">&times;</button>
        `;
        
        row.querySelector('.modal-tag-edit-input').addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            const newVal = e.target.value.trim();
            if (newVal) {
                modalTagsArray[idx] = newVal;
            } else {
                modalTagsArray.splice(idx, 1);
            }
            renderModalChips();
            openTagsEditModal(video);
        });

        row.querySelector('.modal-tag-row-delete-btn').addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            modalTagsArray.splice(idx, 1);
            renderModalChips();
            openTagsEditModal(video);
        });

        listContainer.appendChild(row);
    });

    document.getElementById('tags-edit-modal').classList.remove('d-none');
}

function closeTagsEditModal() {
    if (activeEditTagsVideoId) {
        saveUpdatedTags(activeEditTagsVideoId, modalTagsArray);
    }
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
}

async function saveUpdatedTags(videoId, updatedTags) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags: updatedTags })
        });

        if (response.ok) {
            await fetchVideos();
            applyFiltersAndSearch();
        }
    } catch (err) {
        console.error(err);
    }
}

function getAllExistingTags() {
    const tagsSet = new Set();
    globalVideos.forEach(v => {
        if (Array.isArray(v.tags)) {
            v.tags.forEach(t => tagsSet.add(t));
        }
    });
    return Array.from(tagsSet);
}

function setupFormTagsInput() {
    const input = document.getElementById('video-tags-input');
    const container = document.getElementById('form-tags-wrapper');
    const suggestionsList = document.getElementById('form-autocomplete-list');

    if (!input || !container) return;

    container.addEventListener('click', () => input.focus());

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        suggestionsList.innerHTML = '';
        if (!val) {
            suggestionsList.classList.add('d-none');
            return;
        }
        const allTags = getAllExistingTags();
        const matches = allTags.filter(t => t.toLowerCase().includes(val) && !formTagsArray.includes(t));
        
        if (matches.length > 0) {
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion-item';
                div.innerText = match;
                div.addEventListener('click', () => {
                    addFormTag(match);
                    input.value = '';
                    suggestionsList.classList.add('d-none');
                });
                suggestionsList.appendChild(div);
            });
            suggestionsList.classList.remove('d-none');
        } else {
            suggestionsList.classList.add('d-none');
        }
    });

    input.addEventListener('keyup', (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            let val = input.value.replace(',', '').trim();
            if (val) {
                addFormTag(val);
            }
            input.value = '';
            suggestionsList.classList.add('d-none');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target) && suggestionsList) suggestionsList.classList.add('d-none');
    });
}

function addFormTag(tag) {
    if (!formTagsArray.includes(tag)) {
        formTagsArray.push(tag);
        renderFormChips();
    }
}

function removeFormTag(tag) {
    formTagsArray = formTagsArray.filter(t => t !== tag);
    renderFormChips();
}

function renderFormChips() {
    const area = document.getElementById('form-chips-area');
    if (!area) return;
    area.innerHTML = '';
    formTagsArray.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'form-tag-chip';
        chip.innerHTML = `${tag} <span class="form-tag-chip-remove">&times;</span>`;
        chip.querySelector('.form-tag-chip-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFormTag(tag);
        });
        area.appendChild(chip);
    });
}

function setupModalTagsInput() {
    const input = document.getElementById('modal-tags-input');
    const container = document.getElementById('modal-tags-wrapper');
    const suggestionsList = document.getElementById('modal-autocomplete-list');

    if (!input || !container) return;

    container.addEventListener('click', () => input.focus());

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        suggestionsList.innerHTML = '';
        if (!val) {
            suggestionsList.classList.add('d-none');
            return;
        }
        const allTags = getAllExistingTags();
        const matches = allTags.filter(t => t.toLowerCase().includes(val) && !modalTagsArray.includes(t));
        
        if (matches.length > 0) {
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion-item';
                div.innerText = match;
                div.addEventListener('click', () => {
                    addModalTag(match);
                    input.value = '';
                    suggestionsList.classList.add('d-none');
                });
                suggestionsList.appendChild(div);
            });
            suggestionsList.classList.remove('d-none');
        } else {
            suggestionsList.classList.add('d-none');
        }
    });

    input.addEventListener('keyup', (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            let val = input.value.replace(',', '').trim();
            if (val) {
                addModalTag(val);
            }
            input.value = '';
            suggestionsList.classList.add('d-none');
        }
    });

    document.addEventListener('click', (e) => {
        if (container && !container.contains(e.target) && suggestionsList) suggestionsList.classList.add('d-none');
    });
}

function addModalTag(tag) {
    if (!modalTagsArray.includes(tag)) {
        modalTagsArray.push(tag);
        renderModalChips();
        if (activeEditTagsVideoId) {
            const targetVideo = globalVideos.find(v => v.id === activeEditTagsVideoId);
            if (targetVideo) openTagsEditModal(targetVideo);
        }
    }
}

function renderModalChips() {
    const area = document.getElementById('modal-chips-area');
    if (!area) return;
    area.innerHTML = '';
    modalTagsArray.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'form-tag-chip';
        chip.innerText = tag;
        area.appendChild(chip);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const url = document.getElementById('video-url').value;
    const partner_name = document.getElementById('partner-name').value;
    const role = document.getElementById('role-select').value;
    const location = document.getElementById('location-select').value;
    const instructor_id = document.getElementById('instructor-select').value;
    
    const selectEl = document.getElementById('instructor-select');
    const instructor_name = selectEl.options[selectEl.selectedIndex] ? selectEl.options[selectEl.selectedIndex].text : '';

    const cover_url = getUploadedCoverUrl();

    const payload = {
        url,
        partner_name,
        role,
        location,
        instructor_id,
        instructor_name,
        tags: formTagsArray
    };
    
    if (cover_url) {
        payload.cover_url = cover_url;
    }

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
            document.getElementById('add-video-form').reset();
            formTagsArray = [];
            renderFormChips();
            resetUploadedCoverUrl();
            
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) dropAreaText.classList.remove('d-none');

            switchView('library');
            await fetchVideos();
            applyFiltersAndSearch();
        }
    } catch (err) {
        console.error(err);
    }
}

async function handleInstructorSubmit() {
    const name = document.getElementById('new-instructor-name').value.trim();
    const lang = translations[currentLang];
    if (!name) {
        alert(lang.insAlert);
        return;
    }

    const method = editInstructorId ? 'PATCH' : 'POST';
    const urlSuffix = editInstructorId ? `?id=eq.${editInstructorId}` : '';

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors${urlSuffix}`, {
            method: method,
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });

        if (response.ok) {
            alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
            document.getElementById('new-instructor-name').value = '';
            document.getElementById('new-instructor-container').classList.add('d-none');
            editInstructorId = null;
            await fetchInstructors();
        }
    } catch (err) {
        console.error(err);
    }
}

async function deleteInstructor() {
    if (!editInstructorId) return;
    const lang = translations[currentLang];
    if (!confirm(lang.deleteConfirm)) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${editInstructorId}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            alert(lang.insDeleteSuccess);
            document.getElementById('new-instructor-name').value = '';
            document.getElementById('new-instructor-container').classList.add('d-none');
            editInstructorId = null;
            await fetchInstructors();
            await fetchVideos();
            applyFiltersAndSearch();
        }
    } catch (err) {
        console.error(err);
    }
}

function switchView(viewName) {
    currentView = viewName;
    
    const btnLib = document.getElementById('menu-library');
    const btnFav = document.getElementById('menu-favorites');
    const btnAdd = document.getElementById('menu-add-video');
    
    const searchFilter = document.getElementById('search-filter-section');
    const actionBar = document.getElementById('action-bar');
    const formSection = document.getElementById('form-section');
    const videoGrid = document.getElementById('video-grid');

    if (btnLib) btnLib.classList.remove('active');
    if (btnFav) btnFav.classList.remove('active');
    if (btnAdd) btnAdd.classList.remove('active');

    if (viewName === 'library') {
        if (btnLib) btnLib.classList.add('active');
        if (searchFilter) searchFilter.classList.remove('d-none');
        if (actionBar) actionBar.classList.add('d-none');
        if (formSection) formSection.classList.add('d-none');
        if (videoGrid) videoGrid.classList.remove('d-none');
    } else if (viewName === 'favorites') {
        if (btnFav) btnFav.classList.add('active');
        if (searchFilter) searchFilter.classList.remove('d-none');
        if (actionBar) actionBar.classList.remove('d-none');
        if (formSection) formSection.classList.add('d-none');
        if (videoGrid) videoGrid.classList.remove('d-none');
    } else if (viewName === 'addVideo') {
        if (btnAdd) btnAdd.classList.add('active');
        if (searchFilter) searchFilter.classList.add('d-none');
        if (actionBar) actionBar.classList.add('d-none');
        if (formSection) formSection.classList.remove('d-none');
        if (videoGrid) videoGrid.classList.add('d-none');
        const emptyEl = document.getElementById('empty-element');
        if (emptyEl) emptyEl.classList.add('d-none');
    }
    applyFiltersAndSearch();
}

function setupMenu() {
    const btnLib = document.getElementById('menu-library');
    const btnFav = document.getElementById('menu-favorites');
    const btnAdd = document.getElementById('menu-add-video');
    const btnClear = document.getElementById('clear-favorites-btn');

    if (btnLib) btnLib.addEventListener('click', () => switchView('library'));
    if (btnFav) btnFav.addEventListener('click', () => switchView('favorites'));
    if (btnAdd) btnAdd.addEventListener('click', () => switchView('addVideo'));
    if (btnClear) btnClear.addEventListener('click', clearAllFavorites);
}

function setupLanguages() {
    const btnLang = document.getElementById('lang-toggle-btn');
    if (btnLang) {
        btnLang.addEventListener('click', () => {
            currentLang = currentLang === 'tr' ? 'en' : 'tr';
            updateUI();
        });
    }
}

function updateUI() {
    const lang = translations[currentLang];
    
    const btnLang = document.getElementById('lang-toggle-btn');
    const sideTitle = document.getElementById('sidebar-title');
    const btnLib = document.getElementById('menu-library');
    const btnFav = document.getElementById('menu-favorites');
    const btnAdd = document.getElementById('menu-add-video');
    const mainTitle = document.getElementById('main-title');
    const searchInput = document.getElementById('search-input');
    const filterBtn = document.getElementById('filter-btn');
    const optRoles = document.getElementById('opt-all-roles');
    const optLeader = document.getElementById('opt-leader');
    const optFollower = document.getElementById('opt-follower');
    const optBoth = document.getElementById('opt-both');
    const optLocations = document.getElementById('opt-all-locations');
    const optDrive = document.getElementById('opt-drive');
    const optSocial = document.getElementById('opt-social');
    const btnClearFav = document.getElementById('clear-favorites-btn');
    const formTitle = document.getElementById('form-title');
    const lblVideoLink = document.getElementById('lbl-video-link');
    const lblPartner = document.getElementById('lbl-partner');
    const lblRole = document.getElementById('lbl-role');
    const lblLocation = document.getElementById('lbl-location');
    const lblInstructor = document.getElementById('lbl-instructor');
    const btnToggleIns = document.getElementById('btn-toggle-instructor-input');
    const lblNewInsName = document.getElementById('lbl-new-instructor-name');
    const lblCoverUpload = document.getElementById('lbl-cover-upload');
    const btnSaveIns = document.getElementById('btn-save-instructor');
    const editTagsTitle = document.getElementById('edit-tags-title');
    const modalTagsInput = document.getElementById('modal-tags-input');
    const videoTagsInput = document.getElementById('video-tags-input');
    const btnSaveTagsModal = document.getElementById('btn-save-tags-modal');

    if (btnLang) btnLang.innerText = lang.langBtn;
    if (sideTitle) sideTitle.innerText = lang.brandTitle;
    if (btnLib) btnLib.innerText = lang.menuLibrary;
    if (btnFav) btnFav.innerText = lang.menuFavorites;
    if (btnAdd) btnAdd.innerText = lang.menuAddVideo;
    if (mainTitle) mainTitle.innerText = lang.title;
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;
    if (filterBtn) filterBtn.innerText = lang.filterBtn;
    if (optRoles) optRoles.innerText = lang.allRoles;
    if (optLeader) optLeader.innerText = lang.leader;
    if (optFollower) optFollower.innerText = lang.follower;
    if (optBoth) optBoth.innerText = lang.both;
    if (optLocations) optLocations.innerText = lang.allLocations;
    if (optDrive) optDrive.innerText = lang.drive;
    if (optSocial) optSocial.innerText = lang.social;
    if (btnClearFav) btnClearFav.innerText = lang.btnClearFavorites;
    if (formTitle) formTitle.innerText = lang.formTitle;
    if (lblVideoLink) lblVideoLink.innerText = lang.lblVideoLink;
    if (lblPartner) lblPartner.innerText = lang.lblPartner;
    if (lblRole) lblRole.innerText = lang.lblRole;
    if (lblLocation) lblLocation.innerText = lang.lblLocation;
    if (lblInstructor) lblInstructor.innerText = lang.lblInstructor;
    if (btnToggleIns) btnToggleIns.innerText = lang.btnAddNewInstructor;
    if (lblNewInsName) lblNewInsName.innerText = lang.lblNewInstructorName;
    if (lblCoverUpload) lblCoverUpload.innerText = lang.lblCoverUpload;
    
    const dropTextEl = document.getElementById('drop-area-text');
    if (dropTextEl) {
        dropTextEl.innerText = lang.dropText;
    }

    if (btnSaveIns) btnSaveIns.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    if (editTagsTitle) editTagsTitle.innerText = lang.editTagsTitle;
    if (modalTagsInput) modalTagsInput.placeholder = lang.addTagPlaceholder;
    if (videoTagsInput) videoTagsInput.placeholder = lang.addTagPlaceholder;
    if (btnSaveTagsModal) btnSaveTagsModal.innerText = lang.closeBtn;

    applyFiltersAndSearch();
}

function setupEventListeners() {
    const insSelect = document.getElementById('instructor-select');
    const btnToggleIns = document.getElementById('btn-toggle-instructor-input');
    const btnDelIns = document.getElementById('btn-delete-instructor');
    const btnSaveIns = document.getElementById('btn-save-instructor');
    const formEl = document.getElementById('add-video-form');
    const searchInput = document.getElementById('search-input');
    const filterRole = document.getElementById('filter-role-select');
    const filterLoc = document.getElementById('filter-location-select');
    const filterBtn = document.getElementById('filter-btn');
    const modalClose = document.getElementById('modal-close-btn');
    const videoModal = document.getElementById('video-modal');
    const tagsModalClose = document.getElementById('tags-modal-close-btn');
    const btnSaveTagsModal = document.getElementById('btn-save-tags-modal');
    const tagsEditModal = document.getElementById('tags-edit-modal');

    if (insSelect) {
        insSelect.addEventListener('change', (e) => {
            editInstructorId = e.target.value;
            document.getElementById('new-instructor-name').value = e.target.options[e.target.selectedIndex].text;
            document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
            document.getElementById('new-instructor-container').classList.remove('d-none');
        });
    }

    if (btnToggleIns) {
        btnToggleIns.addEventListener('click', () => {
            editInstructorId = null;
            document.getElementById('new-instructor-name').value = '';
            document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
            document.getElementById('new-instructor-container').classList.remove('d-none');
        });
    }

    if (btnDelIns) btnDelIns.addEventListener('click', deleteInstructor);
    if (btnSaveIns) btnSaveIns.addEventListener('click', handleInstructorSubmit);
    if (formEl) formEl.addEventListener('submit', handleFormSubmit);
    
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSearch);
    if (filterRole) filterRole.addEventListener('change', applyFiltersAndSearch);
    if (filterLoc) filterLoc.addEventListener('change', applyFiltersAndSearch);
    if (filterBtn) filterBtn.addEventListener('click', applyFiltersAndSearch);

    if (modalClose) modalClose.addEventListener('click', closeVideoModal);
    if (videoModal) {
        videoModal.addEventListener('click', (e) => {
            if (e.target.id === 'video-modal') closeVideoModal();
        });
    }

    if (tagsModalClose) tagsModalClose.addEventListener('click', closeTagsEditModal);
    if (btnSaveTagsModal) btnSaveTagsModal.addEventListener('click', closeTagsEditModal);
    if (tagsEditModal) {
        tagsEditModal.addEventListener('click', (e) => {
            if (e.target.id === 'tags-edit-modal') closeTagsEditModal();
        });
    }

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
}

document.addEventListener('DOMContentLoaded', initApp);