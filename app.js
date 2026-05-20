import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;

// ASENKRON MODERN POP-UP (MODAL) MOTORU (Eslem Tarayıcı Alert/Confirm Alternatifi)
function showCustomModal(message, isConfirm = false, title = null) {
    return new Promise((resolve) => {
        const lang = translations[currentLang];
        const overlay = document.getElementById('custom-modal-overlay');
        const mTitle = document.getElementById('modal-title');
        const mBody = document.getElementById('modal-body');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        const closeBtn = document.getElementById('modal-close-btn');

        mTitle.innerText = title || lang.notification;
        mBody.innerHTML = message;
        
        btnConfirm.innerText = lang.btnConfirm || "Tamam";
        btnCancel.innerText = lang.btnCancel || "İptal";

        if (isConfirm) {
            btnCancel.classList.remove('d-none');
        } else {
            btnCancel.classList.add('d-none');
        }

        overlay.classList.remove('d-none');

        function cleanUp(value) {
            overlay.classList.add('d-none');
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            resolve(value);
        }

        function onConfirm() { cleanUp(true); }
        function onCancel() { cleanUp(false); }

        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
    });
}

// ETİKET DÜZENLEME POP-UP'I (MÜKERRER ÜST LİSTE TAMAMEN KALDIRILDI)
function openTagModal(video, onUpdateCallback) {
    let currentTags = video.tags ? [...video.tags] : [];
    
    // Sadece alt kısımdaki dinamik etiket giriş yapısı render ediliyor
    const modalContent = `
        <div class="form-group" style="margin-top: 10px;">
            <div id="modal-tag-box" class="tag-container">
                <input type="text" id="modal-tag-input" class="tag-input-field" placeholder="Yeni etiket yazıp Enter veya Virgül yapın">
            </div>
        </div>
    `;

    showCustomModal(modalContent, true, "✏️ Etiketleri Düzenle").then(async (confirmed) => {
        if (confirmed) {
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${video.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tags: currentTags })
                });

                if (response.ok) {
                    await showCustomModal("🎉 Etiketler başarıyla güncellendi!");
                    if (onUpdateCallback) onUpdateCallback();
                } else {
                    await showCustomModal("❌ Güncelleme sırasında bir hata oluştu.");
                }
            } catch (err) {
                console.error(err);
                await showCustomModal("❌ Veritabanı bağlantı hatası.");
            }
        }
    });

    // Pop-up DOM'a basıldıktan hemen sonra etiket rozetlerini ve input dinleyicilerini yönetiyoruz
    setTimeout(() => {
        const tagBox = document.getElementById('modal-tag-box');
        const tagInput = document.getElementById('modal-tag-input');

        function renderModalTags() {
            // Mevcut eski rozetleri kutudan sil (input kalacak şekilde)
            const badges = tagBox.querySelectorAll('.tag-badge');
            badges.forEach(b => b.remove());

            currentTags.forEach((tag, index) => {
                const badge = document.createElement('span');
                badge.className = 'tag-badge';
                badge.innerHTML = `#${tag} <span class="tag-close" data-index="${index}">&times;</span>`;
                tagBox.insertBefore(badge, tagInput);
            });

            // Rozetlerin üzerindeki çarpı ikonları ile silme işlemi
            tagBox.querySelectorAll('.tag-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    currentTags.splice(idx, 1);
                    renderModalTags();
                });
            });
        }

        function addTagFromInput() {
            let value = tagInput.value.replace(/,/g, '').trim();
            if (value && !currentTags.includes(value)) {
                currentTags.push(value);
                tagInput.value = '';
                renderModalTags();
            }
        }

        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagFromInput();
            }
        });

        tagInput.addEventListener('input', (e) => {
            if (e.target.value.includes(' ,') || e.target.value.includes(',')) {
                addTagFromInput();
            }
        });

        renderModalTags();
    }, 60);
}

// MULTI-LANGUAGE ARABİRİM YÖNETİMİ
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
        applyFiltersAndSearch();
    }
}

// VİDEO KARTLARININ EKLEME VE RENDER MEKANİZMASI
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

        // Kart içi dinamik etiket badge'leri
        let tagsHtml = '';
        if (video.tags && video.tags.length > 0) {
            tagsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">`;
            video.tags.forEach(t => {
                tagsHtml += `<span style="background: rgba(56,189,248,0.1); color: #38bdf8; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px;">#${t}</span>`;
            });
            tagsHtml += `</div>`;
        }

        card.innerHTML = `
            <a href="${video.url}" target="_blank" class="video-cover-link">
                <div class="video-cover-container" style="background-image: url('${coverImg}');">
                    <div class="play-overlay">
                        <span class="play-icon">▶</span>
                    </div>
                </div>
            </a>
            <div class="card-info-content" style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px; width: 100%; flex: 1;">
                <strong style="font-size: 1.1rem; color: #38bdf8;">👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}</strong>
                <span style="color: #94a3b8; font-size: 0.9rem;">${lang.role}: ${roleDisplay}</span>
                ${partnerDisplay}
                <span style="color: #94a3b8; font-size: 0.9rem;">${lang.location}: ${storageDisplay}</span>
                ${tagsHtml}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                <button class="btn-tag-edit" data-id="${video.id}" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 0.85rem; font-weight: 500;">✏️ Etiketler</button>
                <a href="${video.url}" target="_blank" style="color: #ec4899; font-size: 0.85rem; text-decoration: none; font-weight: 600;">
                    🌐 Platformda İzle ↗
                </a>
            </div>
        `;

        // Etiket Açma Buton Dinleyicisi
        card.querySelector('.btn-tag-edit').addEventListener('click', () => {
            openTagModal(video, () => {
                fetchVideos(); 
            });
        });

        videoGrid.appendChild(card);
    });
}

// ARAMA VE ÇOKLU FİLTRELEME MOTORU
function applyFiltersAndSearch() {
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    const selectedRole = document.getElementById('filter-role-select').value;
    const selectedLocation = document.getElementById('filter-location-select').value;

    const filtered = globalVideos.filter(video => {
        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const tagMatch = video.tags ? video.tags.some(t => t.toLowerCase().includes(searchQuery)) : false;
        
        const matchesSearch = insName.includes(searchQuery) || partnerName.includes(searchQuery) || tagMatch;
        const matchesRole = (selectedRole === 'all') || (video.role_type === selectedRole);

        let matchesLocation = true;
        if (selectedLocation === 'drive') {
            matchesLocation = (video.is_downloaded === true);
        } else if (selectedLocation === 'social') {
            matchesLocation = (video.is_downloaded === false || video.is_downloaded === null);
        }

        return matchesSearch && matchesRole && matchesLocation;
    });

    renderVideoCards(filtered);
}

// SUPABASE'DEN VİDEOLARI ALMA (VERİ TABANI ÇEKİM BAĞLANTISI)
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

        if (!response.ok) throw new Error("Veritabanından veri alınamadı.");

        globalVideos = await response.json();
        applyFiltersAndSearch();

    } catch (error) {
        console.error("Hata:", error);
        if (videoGrid) {
            videoGrid.innerHTML = `<div class="info-msg" id="loading-msg" style="color: #ef4444;">${lang.error}</div>`;
        }
    }
}

// SEÇİM KUTUSUNA EĞİTMENLERİ EKLEME
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
        console.error("Eğitmen listesi alınamadı:", e);
    }
}

// MODERN POP-UP ENTEGRASYONLU EĞİTMEN KAYDETME / GÜNCELLEME
async function handleInstructorSubmit() {
    const nameInput = document.getElementById('form-new-instructor-input');
    const name = nameInput.value.trim();
    const lang = translations[currentLang];

    if (!name) {
        await showCustomModal(lang.insAlert);
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
            await showCustomModal(editInstructorId ? lang.insUpdateSuccess : lang.insSuccess);
            nameInput.value = '';
            editInstructorId = null; 
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            document.getElementById('new-instructor-container').classList.add('d-none');
            await fetchInstructorsForForm();
        } else {
            await showCustomModal("❌ İşlem başarısız oldu. Aynı isimde başka bir kayıt bulunuyor olabilir.");
        }
    } catch (err) {
        console.error(err);
        await showCustomModal("❌ Veritabanı bağlantı hatası.");
    }
}

// MODERN POP-UP SİLME ONAYLI EĞİTMEN SİLME İŞLEMİ
async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    const instructorId = select.value;
    const lang = translations[currentLang];

    if (!instructorId) return;

    const confirmed = await showCustomModal(lang.deleteConfirm, true);
    if (confirmed) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${instructorId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });

            if (response.ok) {
                await showCustomModal(lang.insDeleteSuccess);
                await fetchInstructorsForForm();
                fetchVideos();
            } else {
                await showCustomModal("❌ Eğitmen silinemedi.");
            }
        } catch (err) {
            console.error(err);
            await showCustomModal("❌ Bağlantı hatası yaşandı.");
        }
    }
}

// VİDEO FORMU GÖNDERİMİ VE BAĞLANTI SÜRECİ
async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const instructorId = document.getElementById('form-instructor-select').value;
    const videoUrl = document.getElementById('form-video-url').value;
    const roleType = document.getElementById('form-role-select').value;
    const partnerName = document.getElementById('form-partner-name').value;
    const isDownloaded = document.getElementById('form-is-downloaded').checked;

    if (!instructorId) {
        await showCustomModal("Lütfen video eklemeden önce bir eğitmen seçin veya oluşturun.");
        return;
    }

    const payload = {
        instructor_id: parseInt(instructorId),
        url: videoUrl,
        role_type: roleType,
        partner_name: partnerName || null,
        is_downloaded: isDownloaded,
        cover_url: getUploadedCoverUrl(),
        tags: [] 
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
            await showCustomModal(lang.successSave);
            
            document.getElementById('add-video-form').reset();
            resetUploadedCoverUrl();
            
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            
            document.getElementById('menu-library').click();
        } else {
            await showCustomModal("❌ Hata: Video veritabanına kaydedilemedi.");
        }
    } catch (err) {
        console.error(err);
        await showCustomModal("❌ Sunucu bağlantı hatası.");
    }
}

// EVENT LISTENERS VE DOM INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    updateInterfaceLanguage();
    fetchVideos();
    fetchInstructorsForForm();

    // Dil seçeneği değiştirme dinleyicisi
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });

    // Menü Sekme Yönetimi - Kütüphane
    document.getElementById('menu-library').addEventListener('click', (e) => {
        document.getElementById('menu-add-video').classList.remove('active');
        e.target.classList.add('active');
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById('view-library-container').classList.remove('d-none');
        fetchVideos();
    });

    // Menü Sekme Yönetimi - Video Ekle
    document.getElementById('menu-add-video').addEventListener('click', (e) => {
        document.getElementById('menu-library').classList.remove('active');
        e.target.classList.add('active');
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        fetchInstructorsForForm();
    });

    // Yeni Eğitmen Ekleme Alanını Açma / Kapatma
    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        editInstructorId = null; 
        document.getElementById('form-new-instructor-input').value = '';
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
        const container = document.getElementById('new-instructor-container');
        container.classList.toggle('d-none');
    });

    // Eğitmen Düzenleme Tetikleyicisi
    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return;
        
        editInstructorId = select.value;
        const selectedName = select.options[select.selectedIndex].text;
        
        document.getElementById('form-new-instructor-input').value = selectedName;
        document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnUpdateIns;
        document.getElementById('new-instructor-container').classList.remove('d-none');
    });

    // Diğer Olay Dinleyicileri (Filtreler ve Form Gönderimleri)
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