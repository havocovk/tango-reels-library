import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;

function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    if (!lang) return;
    
    document.title = lang.title || '';
    
    const sidebarTitle = document.getElementById('sidebar-title');
    if (sidebarTitle) sidebarTitle.innerText = lang.brandTitle || '';
    
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) langToggleBtn.innerText = lang.langBtn || '';
    
    const menuLibrary = document.getElementById('menu-library');
    if (menuLibrary) menuLibrary.innerText = lang.menuLibrary || '';
    
    const menuAddVideo = document.getElementById('menu-add-video');
    if (menuAddVideo) menuAddVideo.innerText = lang.menuAddVideo || '';
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder || '';
    
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.innerText = lang.filterBtn || '';
    
    const optAllRoles = document.getElementById('opt-all-roles');
    if (optAllRoles) optAllRoles.innerText = lang.allRoles || '';
    
    const optLeader = document.getElementById('opt-leader');
    if (optLeader) optLeader.innerText = lang.leader || '';
    
    const optFollower = document.getElementById('opt-follower');
    if (optFollower) optFollower.innerText = lang.follower || '';
    
    const optBoth = document.getElementById('opt-both');
    if (optBoth) optBoth.innerText = lang.both || '';
    
    const optAllLocations = document.getElementById('opt-all-locations');
    if (optAllLocations) optAllLocations.innerText = lang.allLocations || '';
    
    const optDrive = document.getElementById('opt-drive');
    if (optDrive) optDrive.innerText = lang.drive || '';
    
    const optSocial = document.getElementById('opt-social');
    if (optSocial) optSocial.innerText = lang.social || '';

    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = lang.formTitle || '';
    
    const lblInstructor = document.getElementById('lbl-instructor');
    if (lblInstructor) lblInstructor.innerText = lang.lblInstructor || '';
    
    const lblVideoUrl = document.getElementById('lbl-video-url');
    if (lblVideoUrl) lblVideoUrl.innerText = lang.lblVideoUrl || '';
    
    const lblRole = document.getElementById('lbl-role');
    if (lblRole) lblRole.innerText = lang.lblRole || '';
    
    const lblPartner = document.getElementById('lbl-partner');
    if (lblPartner) lblPartner.innerText = lang.lblPartner || '';
    
    const lblTags = document.getElementById('lbl-tags');
    if (lblTags) lblTags.innerText = lang.lblTags || '';
    
    const formTagsInput = document.getElementById('form-tags-input');
    if (formTagsInput) formTagsInput.placeholder = lang.tagsPlaceholder || '';
    
    const lblDownloaded = document.getElementById('lbl-downloaded');
    if (lblDownloaded) lblDownloaded.innerText = lang.lblDownloaded || '';
    
    const btnSubmitVideo = document.getElementById('btn-submit-video');
    if (btnSubmitVideo) btnSubmitVideo.innerText = lang.btnSubmitVideo || '';
    
    const lblNewInstructorName = document.getElementById('lbl-new-instructor-name');
    if (lblNewInstructorName) lblNewInstructorName.innerText = lang.lblNewInstructorName || '';
    
    const btnSaveInstructor = document.getElementById('btn-save-instructor');
    if (btnSaveInstructor) btnSaveInstructor.innerText = lang.btnAddIns || '';
    
    const lblCoverUpload = document.getElementById('lbl-cover-upload');
    if (lblCoverUpload) lblCoverUpload.innerText = lang.lblCoverUpload || '';
    
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText || '';
    }

    applyFiltersAndSearch();
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
        
        if (!response.ok) throw new Error("Eğitmenler yüklenemedi");
        
        const instructors = await response.json();
        const select = document.getElementById('form-instructor-select');
        if (!select) return;
        
        const langLabel = translations[currentLang].lblInstructor ? translations[currentLang].lblInstructor.split(':')[0] : 'Eğitmen';
        select.innerHTML = `<option value="">-- ${langLabel} --</option>`;
        instructors.forEach(ins => {
            select.innerHTML += `<option value="${ins.id}">${ins.name}</option>`;
        });
    } catch (err) {
        console.error("Eğitmen yükleme hatası:", err);
    }
}

async function handleInstructorSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('form-new-instructor-input');
    if (!input) return;
    
    const name = input.value.trim();
    const lang = translations[currentLang];
    
    if (!name) {
        alert(lang.insAlert || "Lütfen bir eğitmen ismi girin.");
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

        if (!response.ok) throw new Error("Eğitmen veritabanı işlemi başarısız");
        
        alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
        input.value = '';
        editInstructorId = null;
        
        const btnSaveInstructor = document.getElementById('btn-save-instructor');
        if (btnSaveInstructor) btnSaveInstructor.innerText = lang.btnAddIns;
        
        const container = document.getElementById('new-instructor-container');
        if (container) container.classList.add('d-none');
        
        await fetchInstructors();
    } catch (err) {
        console.error("Eğitmen kaydetme hatası:", err);
        alert("Eğitmen işlemi sırasında hata oluştu!");
    }
}

async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    if (!select) return;
    const id = select.value;
    const lang = translations[currentLang];
    
    if (!id) return;
    
    if (confirm(lang.deleteConfirm)) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (!response.ok) throw new Error("Eğitmen silme başarısız");
            
            alert(lang.insDeleteSuccess);
            
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.add('d-none');
            
            const input = document.getElementById('form-new-instructor-input');
            if (input) input.value = '';
            
            editInstructorId = null;
            
            const btnSaveInstructor = document.getElementById('btn-save-instructor');
            if (btnSaveInstructor) btnSaveInstructor.innerText = lang.btnAddIns;
            
            await fetchInstructors();
            await fetchVideos();
        } catch (err) {
            console.error("Eğitmen silme hatası:", err);
            alert("Eğitmen silinirken hata oluştu!");
        }
    }
}

async function fetchVideos() {
    const gallery = document.getElementById('video-gallery');
    if (!gallery) return;
    gallery.innerHTML = `<div class="loading-state">${translations[currentLang].loading}</div>`;
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        
        if (!response.ok) {
            gallery.innerHTML = `<div class="error-state">${translations[currentLang].error}</div>`;
            return;
        }
        
        globalVideos = await response.json();
        applyFiltersAndSearch();
    } catch (err) {
        console.error("Videoları getirme hatası:", err);
        gallery.innerHTML = `<div class="error-state">${translations[currentLang].error}</div>`;
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
        cover_url
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("🔴 Supabase Detaylı Hata Nesnesi:", errorData);
            throw new Error(errorData.message || errorData.details || "Video kaydedilemedi");
        }

        alert(lang.successSave);
        document.getElementById('add-video-form').reset();
        
        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) imgPreview.classList.add('d-none');
        
        const dropAreaText = document.getElementById('drop-area-text');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
        
        resetUploadedCoverUrl();
        
        const menuLibrary = document.getElementById('menu-library');
        if (menuLibrary) menuLibrary.click();
        await fetchVideos();
    } catch (err) {
        console.error("🔴 Yakalanan Hata:", err);
        alert(`Kayıt sırasında bir hata oluştu!\n\nHata Mesajı: ${err.message}`);
    }
}

async function deleteVideo(id) {
    if (confirm("Bu videoyu silmek istediğinize emin misiniz?")) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            
            if (!response.ok) throw new Error("Video silinemedi");
            
            await fetchVideos();
        } catch (err) {
            console.error("Video silme hatası:", err);
            alert("Video silinirken bir hata oluştu.");
        }
    }
}

function applyFiltersAndSearch() {
    const searchInput = document.getElementById('search-input');
    const filterRoleSelect = document.getElementById('filter-role-select');
    const filterLocationSelect = document.getElementById('filter-location-select');
    const gallery = document.getElementById('video-gallery');
    
    if (!gallery) return;
    
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const roleFilter = filterRoleSelect ? filterRoleSelect.value : 'all';
    const locationFilter = filterLocationSelect ? filterLocationSelect.value : 'all';
    
    let filtered = globalVideos.filter(video => {
        const instructorName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const tags = video.tags ? video.tags.toLowerCase() : '';
        
        const matchesSearch = instructorName.includes(query) || partnerName.includes(query) || tags.includes(query);
        
        let matchesRole = true;
        if (roleFilter !== 'all') {
            matchesRole = video.role_type === roleFilter;
        }
        
        let matchesLocation = true;
        if (locationFilter === 'drive') {
            matchesLocation = video.is_downloaded === true;
        } else if (locationFilter === 'social') {
            matchesLocation = video.is_downloaded === false;
        }
        
        return matchesSearch && matchesRole && matchesLocation;
    });

    if (filtered.length === 0) {
        gallery.innerHTML = `<div class="empty-state">${translations[currentLang].empty}</div>`;
        return;
    }

    gallery.innerHTML = '';
    filtered.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card-glass';
        
        const instructorName = video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen';
        const displayTags = video.tags ? video.tags.split(',').map(t => t.trim()) : [];
        
        let badgeRoleClass = 'badge-both';
        if (video.role_type === 'Leader') badgeRoleClass = 'badge-leader';
        if (video.role_type === 'Follower') badgeRoleClass = 'badge-follower';
        
        let tagBadgesHtml = '';
        displayTags.forEach(t => {
            if (t) tagBadgesHtml += `<span class="badge badge-tag">#${t}</span>`;
        });

        const coverSrc = video.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80';

        card.innerHTML = `
            <div class="card-image-container">
                <img src="${coverSrc}" alt="Video Cover" class="card-cover">
                <button class="delete-video-btn" data-id="${video.id}">✕</button>
                <span class="badge ${badgeRoleClass} card-role-badge">${translations[currentLang][video.role_type.toLowerCase()] || video.role_type}</span>
            </div>
            <div class="card-content">
                <h3 class="card-instructor">${instructorName}</h3>
                ${video.partner_name ? `<p class="card-partner"><strong>Partner:</strong> ${video.partner_name}</p>` : ''}
                <div class="card-badges">
                    <span class="badge ${video.is_downloaded ? 'badge-drive' : 'badge-social'}">
                        ${video.is_downloaded ? '💾 Drive' : '🌐 Social'}
                    </span>
                    ${tagBadgesHtml}
                </div>
                <a href="${video.url}" target="_blank" class="card-link-btn">${translations[currentLang].watch}</a>
            </div>
        `;
        
        const delBtn = card.querySelector('.delete-video-btn');
        if (delBtn) {
            delBtn.addEventListener('click', () => deleteVideo(video.id));
        }
        gallery.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();
    updateInterfaceLanguage();

    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'tr' ? 'en' : 'tr';
            updateInterfaceLanguage();
        });
    }

    const menuLibrary = document.getElementById('menu-library');
    const menuAddVideo = document.getElementById('menu-add-video');
    const panelLibrary = document.getElementById('panel-library');
    const panelAddVideo = document.getElementById('panel-add-video');

    if (menuLibrary && menuAddVideo && panelLibrary && panelAddVideo) {
        menuLibrary.addEventListener('click', () => {
            menuLibrary.classList.add('active');
            menuAddVideo.classList.remove('active');
            panelLibrary.classList.remove('d-none');
            panelAddVideo.classList.add('d-none');
        });

        menuAddVideo.addEventListener('click', () => {
            menuAddVideo.classList.add('active');
            menuLibrary.classList.remove('active');
            panelAddVideo.classList.remove('d-none');
            panelLibrary.classList.add('d-none');
        });
    }

    const btnAddInstructorToggle = document.getElementById('btn-add-instructor-toggle');
    if (btnAddInstructorToggle) {
        btnAddInstructorToggle.addEventListener('click', () => {
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.toggle('d-none');
            const input = document.getElementById('form-new-instructor-input');
            if (input) input.value = '';
            editInstructorId = null;
            const btnSaveInstructor = document.getElementById('btn-save-instructor');
            if (btnSaveInstructor) btnSaveInstructor.innerText = translations[currentLang].btnAddIns;
        });
    }

    const btnEditInstructor = document.getElementById('btn-edit-instructor');
    if (btnEditInstructor) {
        btnEditInstructor.addEventListener('click', () => {
            const select = document.getElementById('form-instructor-select');
            if (!select || !select.value) return;
            
            editInstructorId = select.value;
            const selectedName = select.options[select.selectedIndex].text;
            
            const input = document.getElementById('form-new-instructor-input');
            if (input) input.value = selectedName;
            
            const btnSaveInstructor = document.getElementById('btn-save-instructor');
            if (btnSaveInstructor) btnSaveInstructor.innerText = translations[currentLang].btnUpdateIns;
            
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.remove('d-none');
        });
    }

    const btnDeleteInstructor = document.getElementById('btn-delete-instructor');
    if (btnDeleteInstructor) btnDeleteInstructor.addEventListener('click', deleteInstructor);
    
    const btnSaveInstructor = document.getElementById('btn-save-instructor');
    if (btnSaveInstructor) btnSaveInstructor.addEventListener('click', handleInstructorSubmit);
    
    const addVideoForm = document.getElementById('add-video-form');
    if (addVideoForm) addVideoForm.addEventListener('submit', handleFormSubmit);
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSearch);
    
    const filterRoleSelect = document.getElementById('filter-role-select');
    if (filterRoleSelect) filterRoleSelect.addEventListener('change', applyFiltersAndSearch);
    
    const filterLocationSelect = document.getElementById('filter-location-select');
    if (filterLocationSelect) filterLocationSelect.addEventListener('change', applyFiltersAndSearch);
    
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', applyFiltersAndSearch);

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});