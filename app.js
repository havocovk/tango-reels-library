import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;
let currentView = 'library'; 

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

// Google Drive Linkini Sitede Doğrudan Oynatılabilecek "Embed" Formatına Çeviren Sihirli Fonksiyon
function convertDriveUrlToEmbed(url) {
    if (!url) return '';
    // drive.google.com/file/d/[ID]/view veya /edit formatındaki ID'yi yakalar
    const regExp = /\/file\/d\/([^/]+)/;
    const matches = url.match(regExp);
    if (matches && matches[1]) {
        return `https://drive.google.com/file/d/${matches[1]}/preview`;
    }
    return url;
}

// 💡 AKILLI DOSYA İSMİ ASİSTANI ÇALIŞMA MANTIĞI
function updateSmartFilenameAssistant() {
    const lang = translations[currentLang];
    const select = document.getElementById('form-instructor-select');
    const tagsInput = document.getElementById('form-tags-input').value.trim();
    const outputDiv = document.getElementById('assistant-filename-output');

    if (!select.value || select.selectedIndex === -1) {
        outputDiv.innerText = lang.assistantAlert;
        return;
    }

    // Seçilen eğitmen adını alıp Türkçe karakterleri/boşlukları temizle temizle
    let instructorName = select.options[select.selectedIndex].text;
    
    // Karakterleri ve boşlukları temizleme kuralı (Temiz ve standart dosya ismi için)
    let cleanName = instructorName
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');

    // Etiketleri al, temizle ve alt tire ile birleştir
    let cleanTags = '';
    if (tagsInput) {
        cleanTags = tagsInput.split(',')
            .map(t => t.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, ''))
            .filter(t => t !== '')
            .join('_');
    }

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

    document.getElementById('form-title').innerText = lang.formTitle;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-video-url').innerText = lang.lblVideoUrl;
    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-tags').innerText = lang.lblTags;
    document.getElementById('form-tags-input').placeholder = lang.tagsPlaceholder;
    document.getElementById('lbl-downloaded').innerText = lang.lblDownloaded;
    document.getElementById('lbl-drive-url').innerText = lang.lblDriveUrl;
    document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    
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
    document.getElementById('modal-iframe').src = ''; // Videoyu durdurmak için
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
        }
        
        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;
        const isFav = favs.includes(video.id);

        // Eğer Drive linki varsa site içi Modal Player aç, yoksa dış linke yönlendir
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

                ${tagsHtml ? `<div class="card-badges" style="margin-top: 2px; gap: 4px;">${tagsHtml}</div>` : ''}

                <a ${actionLinkClickAttr}>
                    ${hasDrive ? (currentLang === 'tr' ? '🎬 Kütüphanede İzle →' : '🎬 Watch in Library →') : lang.watch}
                </a>
            </div>
        `;

        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        // Site içi oynatıcı tetikleyicileri
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
    const tags = document.getElementById('form-tags-input').value.trim();
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    const cover_url = getUploadedCoverUrl();

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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json', 'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Video kaydedilemedi");

        alert(lang.successSave);
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
        alert("Kayıt sırasında bir hata oluştu!");
    }
}

function switchView(viewName) {
    currentView = viewName;
    document.getElementById('menu-library').classList.remove('active');
    document.getElementById('menu-favorites').classList.remove('active');
    document.getElementById('menu-add-video').classList.remove('active');

    if (viewName === 'library' || viewName === 'favorites') {
        document.getElementById('view-library-container').classList.remove('d-none');
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById(`menu-${viewName}`).classList.add('active');
        applyFiltersAndSearch();
    } else if (viewName === 'add') {
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        document.getElementById('menu-add-video').classList.add('active');
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

    document.getElementById('menu-library').addEventListener('click', () => switchView('library'));
    document.getElementById('menu-favorites').addEventListener('click', () => switchView('favorites'));
    document.getElementById('menu-add-video').addEventListener('click', () => switchView('add'));

    // Drive Checkbox'ına basıldığında alt input alanını göster/gizle
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

    // Asistan Değişiklik Tetikleyicileri
    document.getElementById('form-instructor-select').addEventListener('change', updateSmartFilenameAssistant);
    document.getElementById('form-tags-input').addEventListener('input', updateSmartFilenameAssistant);

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

    // Modal Kapatma Olayları
    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});