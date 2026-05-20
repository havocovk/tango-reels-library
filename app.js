import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let editingVideoId = null; // Düzenlenen videonun ID'sini tutar (null ise yeni kayıttır)
let currentView = 'library'; 

// Form ve Modal etiket yönetim dizileri
let formTagsArray = [];
let modalTagsArray = [];
let activeEditTagsVideoId = null; // Pop-up'ta düzenlenen video ID'si

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

// 🗑️ Pratik Listesini Onaylı Toplu Temizleme
function clearAllFavorites() {
    const lang = translations[currentLang];
    if (confirm(lang.confirmClearFavs)) {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        applyFiltersAndSearch();
    }
}

function convertDriveUrlToEmbed(url) {
    if (!url) return '';
    const regExp = /\/file\/d\/([^/]+)/;
    const matches = url.match(regExp);
    if (matches && matches[1]) {
        return `https://drive.google.com/file/d/${matches[1]}/preview`;
    }
    return url;
}

// Veritabanındaki tüm videolardan benzersiz etiket listesi (Öneri Havuzu) üretir
function getAllUniqueTagsPool() {
    let pool = new Set();
    globalVideos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean) pool.add(clean);
            });
        }
    });
    return Array.from(pool);
}

// CHIPS (KUTUCUK) GÖRSELLEŞTİRME SİSTEMİ
function renderChips(containerId, chipsArray, onRemoveCallback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    chipsArray.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `#${tag} <span class="chip-close-x" data-idx="${index}">&times;</span>`;
        chip.querySelector('.chip-close-x').addEventListener('click', () => {
            onRemoveCallback(index);
        });
        container.appendChild(chip);
    });
}

// AUTOCOMPLETE (OTOMATİK ÖNERİ) AYARLAMA FONKSİYONU
function setupAutocomplete(inputId, listId, chipsArray, renderChipsFn, onAddCallback) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    let currentFocus = -1;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';
        currentFocus = -1;
        if (!val) {
            list.classList.add('d-none');
            return;
        }

        const pool = getAllUniqueTagsPool();
        // Zaten eklenmiş olanları önerme
        const filtered = pool.filter(tag => tag.toLowerCase().includes(val) && !chipsArray.includes(tag));

        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }

        list.classList.remove('d-none');
        filtered.forEach((tag) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-suggestion-item';
            // Eşleşen kısmı kalın yapalım
            const idx = tag.toLowerCase().indexOf(val);
            item.innerHTML = tag.substring(0, idx) + "<strong>" + tag.substring(idx, idx + val.length) + "</strong>" + tag.substring(idx + val.length);
            
            item.addEventListener('click', () => {
                onAddCallback(tag);
                input.value = '';
                list.classList.add('d-none');
            });
            list.appendChild(item);
        });
    });

    // Klavye Tuş Kontrolleri (Virgül, Enter, Backspace)
    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-suggestion-item');
        if (e.key === 'ArrowDown') {
            currentFocus++;
            addActive(items);
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            addActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            } else {
                // Öneri odaklanmadıysa ama düz yazı yazıp enterladıysa virgül gibi davran
                const val = input.value.replace(/,/g, '').trim();
                if (val && !chipsArray.includes(val)) {
                    onAddCallback(val);
                    input.value = '';
                    list.classList.add('d-none');
                }
            }
        } else if (e.key === 'Backspace' && input.value === '') {
            // Yazı alanı boşken silmeye basılırsa son etiketi sil
            if (chipsArray.length > 0) {
                chipsArray.pop();
                renderChipsFn();
            }
        }
    });

    // Virgül Algılama tetikleyicisi
    input.addEventListener('keyup', (e) => {
        if (e.key === ',' || e.code === 'Comma') {
            const val = input.value.replace(/,/g, '').trim();
            if (val && !chipsArray.includes(val)) {
                onAddCallback(val);
            }
            input.value = '';
            list.classList.add('d-none');
        }
    });

    function addActive(items) {
        if (!items || items.length === 0) return;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('autocomplete-active');
    }

    function removeActive(items) {
        items.forEach(item => item.classList.remove('autocomplete-active'));
    }

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.classList.add('d-none');
        }
    });
}

// Asistan dosya ismi oluşturucu kuralı
function updateSmartFilenameAssistant() {
    const lang = translations[currentLang];
    const select = document.getElementById('form-instructor-select');
    const outputDiv = document.getElementById('assistant-filename-output');

    if (!select.value || select.selectedIndex === -1) {
        outputDiv.innerText = lang.assistantAlert;
        return;
    }

    let instructorName = select.options[select.selectedIndex].text;
    let cleanName = instructorName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

    let cleanTags = formTagsArray
        .map(t => t.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''))
        .filter(t => t !== '')
        .join('_');

    let finalFilename = cleanName;
    if (cleanTags) {
        finalFilename += '_' + cleanTags;
    }
    finalFilename += '.mp4';

    outputDiv.innerText = finalFilename;
}

function updateInterfaceLanguage() {
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

    updateSmartFilenameAssistant();
    applyFiltersAndSearch();
}

async function fetchInstructors() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const instructors = await response.json();
        
        const select = document.getElementById('form-instructor-select');
        select.innerHTML = '';
        instructors.forEach(ins => {
            const opt = document.createElement('option');
            opt.value = ins.id;
            opt.innerText = ins.name;
            select.appendChild(opt);
        });
        updateSmartFilenameAssistant();
    } catch (err) {
        console.error("Eğitmenler yüklenemedi:", err);
    }
}

async function fetchVideos() {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        globalVideos = await response.json();
        applyFiltersAndSearch();
    } catch (err) {
        document.getElementById('video-grid').innerHTML = `
            <div class="info-msg" style="color: #ef4444;">
                ${translations[currentLang].error}
            </div>`;
        console.error(err);
    }
}

function openVideoModal(url) {
    const embedUrl = convertDriveUrlToEmbed(url);
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}

// ✏️ POP-UP ETİKET DÜZENLEME MODAL AKIŞI
function openTagsEditModal(video) {
    activeEditTagsVideoId = video.id;
    modalTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    
    document.getElementById('tags-edit-modal').classList.remove('d-none');
    renderModalTagsList();
    renderModalChips();
}

function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
}

// Pop-up içindeki dikey etiket yönetim listesini basar
function renderModalTagsList() {
    const container = document.getElementById('modal-tags-list-container');
    container.innerHTML = '';

    if (modalTagsArray.length === 0) {
        container.innerHTML = `<div style="color:#64748b; font-size:0.9rem; text-align:center;">Henüz etiket bulunmuyor.</div>`;
        return;
    }

    modalTagsArray.forEach((tag, idx) => {
        const row = document.createElement('div');
        row.className = 'modal-tag-row';
        row.innerHTML = `
            <input type="text" value="${tag}" data-idx="${idx}" class="modal-tag-edit-input">
            <button class="modal-tag-row-delete-btn" data-idx="${idx}">&times;</button>
        `;

        // Anlık kelime değişimlerini array'e işle
        row.querySelector('.modal-tag-edit-input').addEventListener('input', (e) => {
            modalTagsArray[idx] = e.target.value.trim();
        });

        // Etiketi satırdan sil
        row.querySelector('.modal-tag-row-delete-btn').addEventListener('click', () => {
            modalTagsArray.splice(idx, 1);
            saveTagsToSupabaseDirectly();
        });

        // Satırdaki input odağı kaybedince veritabanına kaydet
        row.querySelector('.modal-tag-edit-input').addEventListener('blur', () => {
            saveTagsToSupabaseDirectly();
        });

        container.appendChild(row);
    });
}

function renderModalChips() {
    renderChips('modal-chips-area', modalTagsArray, (index) => {
        modalTagsArray.splice(index, 1);
        saveTagsToSupabaseDirectly();
    });
}

// Pop-up'tan yapılan etiket güncellemelerini anında veritabanına yazar
async function saveTagsToSupabaseDirectly() {
    if (!activeEditTagsVideoId) return;
    const cleanTags = modalTagsArray.filter(t => t !== '').join(', ');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${activeEditTagsVideoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags: cleanTags || null })
        });

        if (response.ok) {
            // Yerel listeyi güncelle ve arayüze yansıt
            const vid = globalVideos.find(v => v.id === activeEditTagsVideoId);
            if (vid) vid.tags = cleanTags || null;
            renderModalTagsList();
            renderModalChips();
            applyFiltersAndSearch();
        }
    } catch (err) {
        console.error("Etiket anlık güncellenemedi:", err);
    }
}

// ✏️ VİDEO DÜZENLEME (FORMU OTOMATİK DOLDURMA)
function startVideoEditFlow(video) {
    editingVideoId = video.id;
    switchView('add'); // Form paneline geçiş yap

    const lang = translations[currentLang];
    document.getElementById('form-title').innerText = lang.formTitleEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;

    // Alanları veritabanı bilgileriyle doldur
    document.getElementById('form-instructor-select').value = video.instructor_id;
    document.getElementById('form-video-url').value = video.url;
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    
    // Etiket array'ini besle ve chipsleri bas
    formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    renderFormChips();

    document.getElementById('form-is-downloaded').checked = video.is_downloaded;
    const driveUrlContainer = document.getElementById('drive-url-container');
    if (video.is_downloaded) {
        driveUrlContainer.classList.remove('d-none');
        document.getElementById('form-drive-url').value = video.drive_url || '';
        document.getElementById('form-drive-url').required = true;
    } else {
        driveUrlContainer.classList.add('d-none');
        document.getElementById('form-drive-url').value = '';
        document.getElementById('form-drive-url').required = false;
    }

    // Kapak resmi önizlemesini yükle
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        imgPreview.src = video.cover_url;
        imgPreview.classList.remove('d-none');
        if (dropAreaText) dropAreaText.classList.add('d-none');
    } else {
        imgPreview.classList.add('d-none');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
    }
    updateSmartFilenameAssistant();
}

// 🗑️ VİDEOYU KÜTÜPHANEDEN TAMAMEN SİLME
async function deleteVideoFlow(videoId) {
    const lang = translations[currentLang];
    if (!confirm(lang.confirmDeleteVideo)) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        if (!response.ok) throw new Error("Video silinemedi");

        alert(lang.successDeleteVideo);
        // Favorilerden de sil
        let favs = getFavorites();
        if (favs.includes(videoId)) {
            favs = favs.filter(id => id !== videoId);
            localStorage.setItem('atkk_favorites', JSON.stringify(favs));
        }

        await fetchVideos();
    } catch (err) {
        console.error(err);
        alert("Silme işlemi sırasında hata oluştu!");
    }
}

function renderFormChips() {
    renderChips('chips-area', formTagsArray, (index) => {
        formTagsArray.splice(index, 1);
        renderFormChips();
        updateSmartFilenameAssistant();
    });
}

function renderVideoCards(videos) {
    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
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
            // Etiketlerin yanına modern kalem butonu entegrasyonu
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
            toggleFavorite(video.id);
        });

        // Kalem butonuna basınca pop-up etiket modalını aç
        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(video);
        });

        // Düzenle butonu aksiyonu
        card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            startVideoEditFlow(video);
        });

        // Silme butonu aksiyonu
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteVideoFlow(video.id);
        });

        if (hasDrive) {
            const triggers = card.querySelectorAll('[data-drive]');
            triggers.forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    openVideoModal(video.drive_url);
                });
            });
        }

        videoGrid.appendChild(card);
    });
}

function applyFiltersAndSearch() {
    const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
    const roleVal = document.getElementById('filter-role-select').value;
    const locationVal = document.getElementById('filter-location-select').value;
    const favs = getFavorites();

    const filtered = globalVideos.filter(video => {
        if (currentView === 'favorites' && !favs.includes(video.id)) {
            return false;
        }

        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const videoTags = video.tags ? video.tags.toLowerCase() : '';
        
        const matchesSearch = insName.includes(searchVal) || partnerName.includes(searchVal) || videoTags.includes(searchVal);
        const matchesRole = (roleVal === 'all') || (video.role_type === roleVal);
        
        let matchesLocation = true;
        if (locationVal === 'drive') {
            matchesLocation = (video.is_downloaded === true);
        } else if (locationVal === 'social') {
            matchesLocation = (video.is_downloaded === false || !video.is_downloaded);
        }

        return matchesSearch && matchesRole && matchesLocation;
    });

    renderVideoCards(filtered);
}

async function handleInstructorSubmit() {
    const input = document.getElementById('form-new-instructor-input');
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
                    'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json', 'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ name })
            });
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json', 'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ name })
            });
        }

        if (!response.ok) throw new Error("Eğitmen kaydedilemedi");

        alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
        input.value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        
        await fetchInstructors();
        await fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    if (!select.value) return;

    const lang = translations[currentLang];
    if (!confirm(lang.deleteConfirm)) return;

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${select.value}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });

        if (!response.ok) throw new Error("Silme işlemi başarısız");

        alert(lang.insDeleteSuccess);
        await fetchInstructors();
        await fetchVideos();
    } catch (err) {
        console.error(err);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const instructor_id = document.getElementById('form-instructor-select').value;
    const url = document.getElementById('form-video-url').value.trim();
    const role_type = document.getElementById('form-role-select').value;
    const partner_name = document.getElementById('form-partner-name').value.trim();
    
    // Chips kutucuklarındaki verileri virgülle birleştirip kaydetme formatına getir
    const tags = formTagsArray.join(', ');
    
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    
    // Eğer güncelleme modundaysak ve yeni kapak resmi yapıştırılmadıysa eskisini koru
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && editingVideoId) {
        const currentVid = globalVideos.find(v => v.id === editingVideoId);
        if (currentVid) cover_url = currentVid.cover_url;
    }

    if (!instructor_id) {
        alert("Lütfen önce bir eğitmen seçin veya ekleyin!");
        return;
    }

    const payload = {
        instructor_id: parseInt(instructor_id),
        url,
        role_type,
        partner_name: partner_name || null,
        tags: tags || null,
        is_downloaded,
        drive_url: is_downloaded && drive_url ? drive_url : null,
        cover_url
    };

    try {
        let response;
        if (editingVideoId) {
            // GÜNCELLEME MODU (PATCH)
            response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${editingVideoId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } else {
            // YENİ KAYIT MODU (POST)
            response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        }

        if (!response.ok) throw new Error("Veri tabanına yazılamadı");

        alert(editingVideoId ? lang.successUpdate : lang.successSave);
        
        // Modları sıfırla ve formu temizle
        editingVideoId = null;
        formTagsArray = [];
        renderFormChips();
        document.getElementById('add-video-form').reset();
        
        if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
        if (document.getElementById('drop-area-text')) {
            document.getElementById('drop-area-text').innerText = lang.dropText;
            document.getElementById('drop-area-text').classList.remove('d-none');
        }
        
        document.getElementById('drive-url-container').classList.add('d-none');
        resetUploadedCoverUrl();
        
        document.getElementById('menu-library').click();
        await fetchVideos();
    } catch (err) {
        console.error(err);
        alert("İşlem sırasında bir hata oluştu!");
    }
}

function switchView(viewName) {
    currentView = viewName;
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

    // Pratik listesini temizleme butonunu sadece o sekmedeyken göster
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
        
        applyFiltersAndSearch();
    } else if (viewName === 'add') {
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
        
        // Eğer menüden direkt tıklanarak gelindiyse ve düzenleme modunda kalındıysa sıfırla
        if (!editingVideoId) {
            const lang = translations[currentLang];
            document.getElementById('form-title').innerText = lang.formTitle;
            document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
            document.getElementById('add-video-form').reset();
            formTagsArray = [];
            renderFormChips();
            if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
            if (document.getElementById('drop-area-text')) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            resetUploadedCoverUrl();
        }
        updateSmartFilenameAssistant();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });

    document.getElementById('menu-library').addEventListener('click', () => {
        editingVideoId = null; // Düzenleme durumunu kır
        switchView('library');
    });
    document.getElementById('menu-favorites').addEventListener('click', () => {
        editingVideoId = null;
        switchView('favorites');
    });
    document.getElementById('menu-add-video').addEventListener('click', () => switchView('add'));

    document.getElementById('btn-clear-favorites').addEventListener('click', clearAllFavorites);

    document.getElementById('form-is-downloaded').addEventListener('change', (e) => {
        const driveUrlContainer = document.getElementById('drive-url-container');
        if (e.target.checked) {
            driveUrlContainer.classList.remove('d-none');
            document.getElementById('form-drive-url').required = true;
        } else {
            driveUrlContainer.classList.add('d-none');
            document.getElementById('form-drive-url').required = false;
            document.getElementById('form-drive-url').value = '';
        }
    });

    // Otomatik Öneri ve Akıllı Etiket Sistemleri Kurulumu (Form Alanı İçin)
    setupAutocomplete('form-tags-input', 'autocomplete-list', formTagsArray, renderFormChips, (newTag) => {
        formTagsArray.push(newTag);
        renderFormChips();
        updateSmartFilenameAssistant();
    });

    // Otomatik Öneri ve Akıllı Etiket Sistemleri Kurulumu (Pop-up Modal Alanı İçin)
    setupAutocomplete('modal-tags-input', 'modal-autocomplete-list', modalTagsArray, renderModalChips, (newTag) => {
        modalTagsArray.push(newTag);
        saveTagsToSupabaseDirectly();
    });

    document.getElementById('form-instructor-select').addEventListener('change', updateSmartFilenameAssistant);

    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        editInstructorId = null;
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
        document.getElementById('new-instructor-container').classList.toggle('d-none');
    });

    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return;
        editInstructorId = select.value;
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
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