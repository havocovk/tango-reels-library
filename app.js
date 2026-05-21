import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;

function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    document.getElementById('form-title').innerText = lang.formTitle;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-video-url').innerText = lang.lblVideoUrl;
    
    const coverUploadLbl = document.getElementById('lbl-cover-upload');
    if (coverUploadLbl) coverUploadLbl.innerText = lang.lblCoverUpload;
    
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !getUploadedCoverUrl()) {
        dropAreaText.innerText = lang.dropText;
    }

    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-downloaded').innerText = lang.lblDownloaded;
    document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;
    document.getElementById('lbl-new-instructor-name').innerText = lang.lblNewInstructorName;

    const saveBtn = document.getElementById('btn-save-instructor');
    if (editInstructorId) {
        saveBtn.innerText = lang.btnUpdateIns;
    } else {
        saveBtn.innerText = lang.btnAddIns;
    }

    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
        if (loadingMsg.innerText.includes("bağlantısı") || loadingMsg.innerText.includes("Connecting")) {
            loadingMsg.innerText = lang.loading;
        } else if (loadingMsg.innerHTML.includes("boş") || loadingMsg.innerHTML.includes("empty")) {
            loadingMsg.innerHTML = lang.empty;
        } else if (loadingMsg.innerText.includes("başarısız") || loadingMsg.innerText.includes("failed")) {
            loadingMsg.innerText = lang.error;
        }
    }

    if (globalVideos.length > 0) {
        renderVideoCards(globalVideos);
    }
}

function renderVideoCards(videos) {
    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${lang.empty}</div>`;
        return;
    }

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        
        let roleDisplay = video.role_type || 'Both';
        if (currentLang === 'tr') {
            if (roleDisplay === 'Leader') roleDisplay = 'Lider';
            if (roleDisplay === 'Follower') roleDisplay = 'Takipçi';
            if (roleDisplay === 'Both') roleDisplay = 'İkisi de';
        }

        const storageDisplay = video.is_downloaded ? '💾 Google Drive' : '🌐 Social Media';
        const partnerDisplay = video.partner_name ? `<span style="color: #94a3b8; font-size: 0.9rem;">👥 Partner: ${video.partner_name}</span>` : '';
        
        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;

        const mediaHTML = `
            <a href="${video.url}" target="_blank" class="video-cover-link">
                <div class="video-cover-container" style="background-image: url('${coverImg}');">
                    <div class="play-overlay">
                        <span class="play-icon">▶</span>
                    </div>
                </div>
            </a>
        `;

        card.innerHTML = `
            ${mediaHTML}
            <div class="card-info-content" style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px; width: 100%;">
                <strong style="font-size: 1.1rem; color: #38bdf8;">👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}</strong>
                <span style="color: #94a3b8; font-size: 0.9rem;">${lang.role}: ${roleDisplay}</span>
                ${partnerDisplay}
                <span style="color: #94a3b8; font-size: 0.9rem;">${lang.location}: ${storageDisplay}</span>
                <a href="${video.url}" target="_blank" style="color: #ec4899; font-size: 0.85rem; margin-top: 5px; text-decoration: none; font-weight: 600;">
                    🌐 Platformda İzle ↗
                </a>
            </div>
        `;
        videoGrid.appendChild(card);
    });
}

async function fetchVideos() {
    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error();

        globalVideos = await response.json();
        renderVideoCards(globalVideos);

    } catch (error) {
        console.error("Hata:", error);
        if (videoGrid) {
            videoGrid.innerHTML = `<div class="info-msg" id="loading-msg" style="color: #ef4444;">${lang.error}</div>`;
        }
    }
}

async function fetchInstructorsForForm() {
    const select = document.getElementById('form-instructor-select');
    if (!select) return;
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const instructors = await response.json();
        
        select.innerHTML = '';
        
        if (instructors.length === 0) {
            select.innerHTML = `<option value="">➕ Önce Eğitmen Ekleyin</option>`;
        } else {
            instructors.forEach(ins => {
                select.innerHTML += `<option value="${ins.id}">${ins.name}</option>`;
            });
        }
    } catch (e) {
        console.error("Eğitmenler çekilemedi:", e);
    }
}

async function handleInstructorSubmit() {
    const nameInput = document.getElementById('form-new-instructor-input');
    const name = nameInput.value.trim();
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
                body: JSON.stringify({ name: name })
            });
        } else {
            response = await fetch(`${SUPABASE_URL}/rest/v1/instructors`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: name })
            });
        }

        if (response.ok) {
            alert(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
            nameInput.value = '';
            editInstructorId = null; 
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            document.getElementById('new-instructor-container').classList.add('d-none');
            await fetchInstructorsForForm();
        } else {
            alert("İşlem başarısız oldu. İsim çakışması olabilir.");
        }
    } catch (err) {
        console.error(err);
        alert("Bağlantı hatası.");
    }
}

async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    const instructorId = select.value;
    const lang = translations[currentLang];

    if (!instructorId) return;

    if (confirm(lang.deleteConfirm)) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${instructorId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (response.ok) {
                alert(lang.insDeleteSuccess);
                await fetchInstructorsForForm();
                fetchVideos();
            } else {
                alert("Silme işlemi başarısız.");
            }
        } catch (err) {
            console.error(err);
            alert("Bağlantı hatası.");
        }
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const instructorId = document.getElementById('form-instructor-select').value;
    const videoUrl = document.getElementById('form-video-url').value;
    const roleType = document.getElementById('form-role-select').value;
    const partnerName = document.getElementById('form-partner-name').value;
    const isDownloaded = document.getElementById('form-is-downloaded').checked;

    if(!instructorId) {
        alert("Lütfen önce bir eğitmen seçin veya ekleyin.");
        return;
    }

    const payload = {
        instructor_id: parseInt(instructorId),
        url: videoUrl,
        role_type: roleType,
        partner_name: partnerName || null,
        is_downloaded: isDownloaded,
        cover_url: getUploadedCoverUrl() // storage modülünden güncel linki alıyoruz
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
            alert(lang.successSave);
            
            document.getElementById('add-video-form').reset();
            resetUploadedCoverUrl(); // Modüldeki hafızayı sıfırla
            
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            
            document.getElementById('menu-library').click();
        } else {
            const errData = await response.json();
            console.error("Supabase Veritabanı Hatası:", errData);
            alert("Hata: Video veritabanına eklenemedi.");
        }
    } catch (err) {
        console.error(err);
        alert("Bağlantı hatası yaşandı.");
    }
}

function handleSearch() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = globalVideos.filter(video => {
        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const role = video.role_type || '';
        const partner = video.partner_name ? video.partner_name.toLowerCase() : '';
        return insName.includes(query) || role.toLowerCase().includes(query) || partner.includes(query);
    });
    renderVideoCards(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
    updateInterfaceLanguage();
    fetchVideos();
    fetchInstructorsForForm();

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });

    document.getElementById('menu-library').addEventListener('click', (e) => {
        document.getElementById('menu-add-video').classList.remove('active');
        e.target.classList.add('active');
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById('view-library-container').classList.remove('d-none');
        fetchVideos();
    });

    document.getElementById('menu-add-video').addEventListener('click', (e) => {
        document.getElementById('menu-library').classList.remove('active');
        e.target.classList.add('active');
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        fetchInstructorsForForm();
    });

    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        editInstructorId = null; 
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
        const container = document.getElementById('new-instructor-container');
        container.classList.toggle('d-none');
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
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', handleSearch);
    
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', handleSearch);

    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        // handlePasteEvent fonksiyonuna dil bilgisini de gönderiyoruz
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});