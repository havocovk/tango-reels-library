import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;

function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    
    document.title = lang.title;
    document.getElementById('sidebar-title').innerText = lang.brandTitle;
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
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
    document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
    
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;
    document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
    
    document.getElementById('lbl-cover-upload').innerText = lang.lblCoverUpload;
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !dropAreaText.classList.contains('d-none')) {
        dropAreaText.innerText = lang.dropText;
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
        
        select.innerHTML = `<option value="">-- ${translations[currentLang].lblInstructor.split(':')[0]} --</option>`;
        instructors.forEach(ins => {
            select.innerHTML += `<option value="${ins.id}">${ins.name}</option>`;
        });
    } catch (err) {
        console.error(err);
    }
}

async function handleInstructorSubmit(e) {
    e.preventDefault();
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

        if (!response.ok) throw new Error("İşlem başarısız");
        
        alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
        input.value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
        document.getElementById('new-instructor-container').classList.add('d-none');
        
        await fetchInstructors();
    } catch (err) {
        console.error(err);
        alert("Eğitmen işlemi sırasında hata oluştu!");
    }
}

async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
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
            
            if (!response.ok) throw new Error("Silme başarısız");
            
            alert(lang.insDeleteSuccess);
            document.getElementById('new-instructor-container').classList.add('d-none');
            document.getElementById('form-new-instructor-input').value = '';
            editInstructorId = null;
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            
            await fetchInstructors();
            await fetchVideos();
        } catch (err) {
            console.error(err);
            alert("Eğitmen silinirken hata oluştu!");
        }
    }
}

async function fetchVideos() {
    const gallery = document.getElementById('video-gallery');
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
        console.error(err);
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
                'Prefer': 'return=minimal' // Supabase'in 201 yerine doğru yanıt dönmesini sağlar
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Video kaydedilemedi");
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
        
        document.getElementById('menu-library').click();
        await fetchVideos();
    } catch (err) {
        console.error(err);
        alert(lang.error || "Video kaydedilemedi");
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
            console.error(err);
            alert("Video silinirken bir hata oluştu.");
        }
    }
}

function applyFiltersAndSearch() {
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const roleFilter = document.getElementById('filter-role-select').value;
    const locationFilter = document.getElementById('filter-location-select').value;
    
    const gallery = document.getElementById('video-gallery');
    
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
                <span class="badge ${badgeRoleClass} card-role-badge">${translations[currentLang][video.role_type.toLowerCase()]}</span>
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
        
        card.querySelector('.delete-video-btn').addEventListener('click', () => deleteVideo(video.id));
        gallery.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInstructors();
    fetchVideos();
    updateInterfaceLanguage();

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });

    const menuLibrary = document.getElementById('menu-library');
    const menuAddVideo = document.getElementById('menu-add-video');
    const panelLibrary = document.getElementById('panel-library');
    const panelAddVideo = document.getElementById('panel-add-video');

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

    document.getElementById('btn-add-instructor-toggle').addEventListener('click', () => {
        const container = document.getElementById('new-instructor-container');
        container.classList.toggle('d-none');
        document.getElementById('form-new-instructor-input').value = '';
        editInstructorId = null;
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
    });

    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return;
        
        editInstructorId = select.value;
        const selectedName = select.options[select.selectedIndex].text;
        
        document.getElementById('form-new-instructor-input').value = selectedName;
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

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});