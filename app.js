import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let globalInstructors = [];
let editInstructorId = null;
let editingVideoId = null; 
let currentView = 'library'; 

let formTagsArray = [];
let modalTagsArray = [];
let activeEditTagsVideoId = null; 

// 🔄 SUPABASE REALTIME CANLI YAYIN BAĞLANTISI (SEÇENEK R2)
function initRealtimeSync() {
    if (!window.supabase) {
        console.error("Supabase Realtime SDK yüklenemedi.");
        return;
    }

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Videos tablosundaki her türlü değişikliği (INSERT, UPDATE, DELETE) canlı dinle
    supabaseClient
        .channel('table-db-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'videos' },
            (payload) => {
                handleRealtimePayload(payload);
            }
        )
        .subscribe();
}

// Canlı veri paketini işleme ve arayüze sayfa yenilenmeden yansıtma
function handleRealtimePayload(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        if (!globalVideos.some(v => v.id === newRecord.id)) {
            globalVideos.push(newRecord);
        }
    } else if (eventType === 'UPDATE') {
        const index = globalVideos.findIndex(v => v.id === newRecord.id);
        if (index !== -1) {
            globalVideos[index] = newRecord;
        }
    } else if (eventType === 'DELETE') {
        globalVideos = globalVideos.filter(v => v.id !== oldRecord.id);
    }

    // Ekranı sayfa yenilenmeden canlı güncelle
    applyFiltersAndSearch();
}

// ⭐ ORTAK PRATİK LİSTESİ YILDIZ DURUMUNU DEĞİŞTİRME (SEÇENEK F1 & T2)
async function toggleFavorite(videoId) {
    const video = globalVideos.find(v => v.id === videoId);
    if (!video) return;

    const updatedFavoriteStatus = !video.is_favorite;

    // Arayüzde anlık tepki için yerel veriyi önceden güncelle (Optimistic UI)
    video.is_favorite = updatedFavoriteStatus;
    applyFiltersAndSearch();

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_favorite: updatedFavoriteStatus })
        });

        if (!response.ok) {
            throw new Error("Favori durumu güncellenemedi.");
        }
    } catch (err) {
        console.error("Favori senkronizasyon hatası:", err);
        // Hata durumunda eski haline geri al
        video.is_favorite = !updatedFavoriteStatus;
        applyFiltersAndSearch();
    }
}

// 🗑️ ORTAK PRATİK LİSTESİNİ TOPLU TEMİZLEME (SEÇENEK F1 & T2)
async function clearAllFavorites() {
    const lang = translations[currentLang];
    if (!confirm(lang.confirmClearFavs)) return;

    // Yereldeki tüm yıldızları hemen kaldır (Optimistic UI)
    globalVideos.forEach(v => v.is_favorite = false);
    applyFiltersAndSearch();

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?is_favorite=eq.true`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_favorite: false })
        });

        if (!response.ok) {
            throw new Error("Toplu temizleme başarısız oldu.");
        }
    } catch (err) {
        console.error("Toplu temizleme hatası:", err);
        fetchVideos(); // Hata durumunda veritabanından orijinal halini geri çek
    }
}

// ⬇️ VERİTABANINDAN VİDEOLARI ÇEKME
async function fetchVideos() {
    const indicator = document.getElementById('loading-indicator');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (!response.ok) throw new Error();
        globalVideos = await response.json();
        if (indicator) indicator.classList.add('d-none');
        applyFiltersAndSearch();
    } catch (err) {
        if (indicator) indicator.innerText = translations[currentLang].error;
    }
}

// ⬇️ VERİTABANINDAN EĞİTMENLERİ ÇEKME
async function fetchInstructors() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        if (response.ok) {
            globalInstructors = await response.json();
            renderInstructorSelect();
        }
    } catch (err) {
        console.error("Eğitmen yükleme hatası:", err);
    }
}

// EĞİTMEN SEÇİM LİSTESİNİ DOLDURMA
function renderInstructorSelect() {
    const select = document.getElementById('instructor-select');
    if (!select) return;
    
    select.innerHTML = `<option value="">-- ${currentLang === 'tr' ? 'Eğitmen Seçin' : 'Select Instructor'} --</option>`;
    globalInstructors.forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins.id;
        opt.innerText = ins.name;
        select.appendChild(opt);
    });
}

// 🎴 VİDEO KARTLARINI EKRANA BASMA
function renderVideos(videosList) {
    const grid = document.getElementById('videos-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const lang = translations[currentLang];

    if (videosList.length === 0) {
        grid.innerHTML = `<div class="status-message">${currentView === 'favorites' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    videosList.forEach(video => {
        const card = document.createElement('div');
        card.className = 'card-glass';

        const coverSrc = video.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80';
        
        // Yıldız simgesinin ortak veritabanı durumuna (video.is_favorite) göre ayarlanması
        const starClass = video.is_favorite ? 'fav-btn active' : 'fav-btn';
        const starChar = video.is_favorite ? '★' : '☆';

        const instObj = globalInstructors.find(i => i.id === video.instructor_id);
        const instructorName = instObj ? instObj.name : (video.instructor || 'Unknown');

        let tagsHTML = '';
        if (video.tags) {
            const tagsArr = Array.isArray(video.tags) ? video.tags : video.tags.split(',').map(t => t.trim());
            tagsArr.forEach(t => {
                if(t) tagsHTML += `<span class="tag-chip">${t}</span>`;
            });
        }

        card.innerHTML = `
            <div class="card-cover-container">
                <img src="${coverSrc}" class="card-cover" alt="Tango">
                <button class="${starClass}" data-id="${video.id}">${starChar}</button>
            </div>
            <div class="card-body">
                <div class="card-instructor">${instructorName}</div>
                ${video.partner ? `<div class="card-partner">👥 ${video.partner}</div>` : ''}
                <div class="card-meta">
                    <span>${video.role || 'Both'}</span>
                    <span>•</span>
                    <span>${video.location === 'Google Drive' ? lang.drive : lang.social}</span>
                </div>
                <div class="card-tags">${tagsHTML}</div>
                
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button class="watch-btn" data-url="${video.url}" style="flex:1;">${lang.watch}</button>
                    <button class="card-crud-btn edit-btn" data-id="${video.id}" title="${lang.btnCardEdit}">✏️</button>
                    <button class="card-crud-btn delete-btn" data-id="${video.id}" title="${lang.btnCardDelete}">🗑️</button>
                </div>
            </div>
        `;

        // Kart İçi Olay Dinleyicileri
        card.querySelector('.fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        card.querySelector('.watch-btn').addEventListener('click', () => {
            openVideoModal(video.url);
        });

        card.querySelector('.edit-btn').addEventListener('click', () => {
            openTagsEditModal(video.id);
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
            deleteVideo(video.id);
        });

        grid.appendChild(card);
    });
}

// 🔍 FİLTRELEME VE ARAMA MOTORU
function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locVal = document.getElementById('filter-location-select').value;
    const bulkActionArea = document.getElementById('bulk-action-area');

    let filtered = [...globalVideos];

    // Menü Görünüm Filtresi
    if (currentView === 'favorites') {
        filtered = filtered.filter(v => v.is_favorite === true);
        if (bulkActionArea) bulkActionArea.classList.remove('d-none');
    } else {
        if (bulkActionArea) bulkActionArea.classList.add('d-none');
    }

    // Rol Filtresi
    if (roleVal !== 'all') {
        filtered = filtered.filter(v => v.role === roleVal);
    }

    // Ortam Filtresi
    if (locVal !== 'all') {
        filtered = filtered.filter(v => v.location === locVal);
    }

    // Arama Kelimesi Filtresi (Eğitmen, Partner, Etiket)
    if (searchVal) {
        filtered = filtered.filter(v => {
            const instObj = globalInstructors.find(i => i.id === v.instructor_id);
            const instName = instObj ? instObj.name.toLowerCase() : '';
            const partner = (v.partner || '').toLowerCase();
            
            let tagsStr = '';
            if (v.tags) {
                tagsStr = (Array.isArray(v.tags) ? v.tags.join(' ') : v.tags).toLowerCase();
            }

            return instName.includes(searchVal) || partner.includes(searchVal) || tagsStr.includes(searchVal);
        });
    }

    renderVideos(filtered);
}

// 💾 YENİ VİDEO EKLEME / DÜZENLEME FORMU İŞLEME
async function handleFormSubmit(e) {
    e.preventDefault();

    const url = document.getElementById('video-url').value;
    const location = document.getElementById('filter-location').value;
    const instructor_id = document.getElementById('instructor-select').value;
    const partner = document.getElementById('partner-input').value;
    const role = document.getElementById('filter-role').value;
    const cover_url = getUploadedCoverUrl();

    if (!instructor_id) {
        alert(translations[currentLang].insAlert);
        return;
    }

    const payload = {
        url,
        location,
        instructor_id: parseInt(instructor_id),
        partner,
        role,
        tags: formTagsArray, 
        cover_url
    };

    try {
        let response;
        if (editingVideoId) {
            // Güncelleme Modu
            response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${editingVideoId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } else {
            // Yeni Kayıt Modu (Varsayılan olarak favori değil)
            payload.is_favorite = false;
            response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        if (response.ok) {
            document.getElementById('add-video-form').reset();
            formTagsArray = [];
            renderFormChips();
            resetUploadedCoverUrl();
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) dropAreaText.classList.remove('d-none');

            editingVideoId = null;
            document.getElementById('btn-submit-video').innerText = translations[currentLang].menuAddVideo;
            document.getElementById('form-heading').innerText = translations[currentLang].formTitle;

            switchView('library');
            fetchVideos();
        }
    } catch (err) {
        console.error("Video kaydetme hatası:", err);
    }
}

// 🗑️ VİDEO SİLME İŞLEMİ
async function deleteVideo(id) {
    const lang = translations[currentLang];
    if (!confirm(lang.confirmDeleteVideo)) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (response.ok) {
            alert(lang.successDeleteVideo);
            fetchVideos();
        }
    } catch (err) {
        console.error("Video silme hatası:", err);
    }
}

// 🏷️ CHIP SEKLİNDE ETİKET YÖNETİMİ (FORM İÇİN)
function renderFormChips() {
    const area = document.getElementById('form-chips-area');
    if (!area) return;
    area.innerHTML = '';
    formTagsArray.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '4px';
        chip.innerHTML = `${tag} <b style="cursor:pointer;color:#ff4444;">&times;</b>`;
        chip.querySelector('b').addEventListener('click', () => {
            formTagsArray.splice(idx, 1);
            renderFormChips();
        });
        area.appendChild(chip);
    });
}

// ✏️ ETİKET DÜZENLEME MODALINI AÇMA VE YÜKLEME
function openTagsEditModal(videoId) {
    activeEditTagsVideoId = videoId;
    const video = globalVideos.find(v => v.id === videoId);
    if (!video) return;

    if (video.tags) {
        modalTagsArray = Array.isArray(video.tags) ? [...video.tags] : video.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
        modalTagsArray = [];
    }

    document.getElementById('tags-edit-modal').classList.remove('d-none');
    renderModalChips();
}

function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
    modalTagsArray = [];
}

function renderModalChips() {
    const area = document.getElementById('modal-chips-area');
    if (!area) return;
    area.innerHTML = '';
    modalTagsArray.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.gap = '4px';
        chip.innerHTML = `${tag} <b style="cursor:pointer;color:#ff4444;">&times;</b>`;
        chip.querySelector('b').addEventListener('click', () => {
            modalTagsArray.splice(idx, 1);
            renderModalChips();
        });
        area.appendChild(chip);
    });
}

// MODAL ETİKETLERİNİ VERİTABANINA KAYDETME
async function handleModalTagsSave() {
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

        if (response.ok) {
            closeTagsEditModal();
            fetchVideos();
        }
    } catch (err) {
        console.error("Modal etiket güncelleme hatası:", err);
    }
}

// 🎬 VİDEO MODAL YÖNETİMİ
function openVideoModal(url) {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    if (!modal || !iframe) return;

    let embedUrl = url;
    if (url.includes('drive.google.com')) {
        embedUrl = url.replace('/view?usp=sharing', '/preview').replace('/view', '/preview');
    }

    iframe.src = embedUrl;
    modal.classList.remove('d-none');
}

function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    if (modal && iframe) {
        iframe.src = '';
        modal.classList.add('d-none');
    }
}

// 👤 EĞİTMEN EKLEME VE YÖNETİM İŞLEMLERİ
async function handleInstructorSubmit() {
    const input = document.getElementById('new-instructor-name');
    const name = input.value.trim();
    const lang = translations[currentLang];

    if (!name) {
        alert(lang.insAlert);
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
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name })
            });
        }

        if (response.ok) {
            alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
            input.value = '';
            editInstructorId = null;
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            document.getElementById('btn-delete-instructor').classList.add('d-none');
            fetchInstructors();
        }
    } catch (err) {
        console.error("Eğitmen işlem hatası:", err);
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
            editInstructorId = null;
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            document.getElementById('btn-delete-instructor').classList.add('d-none');
            fetchInstructors();
            fetchVideos();
        }
    } catch (err) {
        console.error("Eğitmen silme hatası:", err);
    }
}

// 🗺️ MENÜ VE GÖRÜNÜM DEĞİŞTİRİCİ
function switchView(viewName) {
    currentView = viewName;
    
    document.getElementById('view-library').classList.add('d-none');
    document.getElementById('view-add-video').classList.add('d-none');
    
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

    if (viewName === 'library') {
        document.getElementById('view-library').classList.remove('d-none');
        document.getElementById('menu-library').classList.add('active');
    } else if (viewName === 'favorites') {
        document.getElementById('view-library').classList.remove('d-none');
        document.getElementById('menu-favorites').classList.add('active');
    } else if (viewName === 'add-video') {
        document.getElementById('view-add-video').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
    }

    applyFiltersAndSearch();
}

// 🌐 DİL VE METİN BAĞLAMALARI
function setupTranslations() {
    const lang = translations[currentLang];

    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('main-title').innerText = lang.title;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-favorites').innerText = lang.menuFavorites;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    document.getElementById('btn-clear-all-favs').innerText = lang.btnClearFavorites;
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;

    // Seçim kutuları dil eşitlemeleri
    document.getElementById('filter-role-select').options[0].text = `🎬 ${lang.allRoles}`;
    document.getElementById('filter-location-select').options[0].text = `📍 ${lang.allLocations}`;
    
    document.getElementById('form-heading').innerText = editingVideoId ? lang.btnCardEdit : lang.formTitle;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('btn-save-instructor').innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
    }

    applyFiltersAndSearch();
}

// 🚀 UYGULAMA BAŞLANGICI VE EVENT LISTENER BAĞLANTILARI
document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();
    initRealtimeSync(); // Canlı yayını başlat

    // Menü geçişleri
    document.getElementById('menu-library').addEventListener('click', () => switchView('library'));
    document.getElementById('menu-favorites').addEventListener('click', () => switchView('favorites'));
    document.getElementById('menu-add-video').addEventListener('click', () => switchView('add-video'));

    // Dil değiştirici
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        setupTranslations();
    });

    // Form etiket girişleri (Enter ve Virgül dinleme)
    const tagsInput = document.getElementById('tags-input');
    if (tagsInput) {
        tagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = tagsInput.value.replace(',', '').trim();
                if (val && !formTagsArray.includes(val)) {
                    formTagsArray.push(val);
                    renderFormChips();
                }
                tagsInput.value = '';
            }
        });
    }

    // Modal etiket girişleri
    const modalTagsInput = document.getElementById('modal-tags-input');
    if (modalTagsInput) {
        modalTagsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const val = modalTagsInput.value.replace(',', '').trim();
                if (val && !modalTagsArray.includes(val)) {
                    modalTagsArray.push(val);
                    renderModalChips();
                }
                modalTagsInput.value = '';
            }
        });
    }

    // Eğitmen paneli aç/kapat
    document.getElementById('btn-manage-instructors').addEventListener('click', () => {
        const panel = document.getElementById('new-instructor-container');
        panel.classList.toggle('d-none');
    });

    // Eğitmen seçildiğinde düzenleme moduna alma
    document.getElementById('instructor-select').addEventListener('change', (e) => {
        const val = e.target.value;
        const btnDelete = document.getElementById('btn-delete-instructor');
        const btnSave = document.getElementById('btn-save-instructor');
        const inputName = document.getElementById('new-instructor-name');

        if (val) {
            editInstructorId = parseInt(val);
            const insObj = globalInstructors.find(i => i.id === editInstructorId);
            if (insObj) {
                inputName.value = insObj.name;
                btnSave.innerText = translations[currentLang].btnUpdateIns;
                btnDelete.classList.remove('d-none');
            }
        } else {
            editInstructorId = null;
            inputName.value = '';
            btnSave.innerText = translations[currentLang].btnAddIns;
            btnDelete.classList.add('d-none');
        }
    });

    // Olay Dinleyicileri
    document.getElementById('btn-delete-instructor').addEventListener('click', deleteInstructor);
    document.getElementById('btn-save-instructor').addEventListener('click', handleInstructorSubmit);
    document.getElementById('add-video-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('btn-save-tags-modal').addEventListener('click', handleModalTagsSave);
    document.getElementById('btn-clear-all-favs').addEventListener('click', clearAllFavorites);
    
    document.getElementById('search-input').addEventListener('input', applyFiltersAndSearch);
    document.getElementById('filter-role-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-location-select').addEventListener('change', applyFiltersAndSearch);
    document.getElementById('filter-btn').addEventListener('click', applyFiltersAndSearch);

    // Modalları Kapatma Olayları
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