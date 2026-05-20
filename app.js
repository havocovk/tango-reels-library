import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';

// GLOBAL UYGULAMA DURUMU (STATE)
let currentLang = 'tr';
let globalVideos = [];
let editInstructorId = null;

/**
 * 1. ASENKRON MODERN POP-UP (MODAL) MOTORU
 * Tarayıcının 'alert' ve 'confirm' pencerelerini tamamen devre dışı bırakır.
 * Ekrandaki glassmorphic tasarımlı div'i kullanarak Promise tabanlı çalışır.
 * * @param {string} message - Kullanıcıya gösterilecek mesaj veya HTML içeriği
 * @param {boolean} isConfirm - Eğer true ise 'İptal' butonu görünür ve onay mekanizması çalışır
 * @param {string|null} title - Pop-up başlığı (Null ise varsayılan 'Bildirim' yazısı gelir)
 * @returns {Promise<boolean>} - Kullanıcı onaylarsa true, iptal ederse veya kapatırsa false döner
 */
export function showCustomModal(message, isConfirm = false, title = null) {
    return new Promise((resolve) => {
        const lang = translations[currentLang];
        const overlay = document.getElementById('custom-modal-overlay');
        const mTitle = document.getElementById('modal-title');
        const mBody = document.getElementById('modal-body');
        const btnConfirm = document.getElementById('modal-btn-confirm');
        const btnCancel = document.getElementById('modal-btn-cancel');
        const closeBtn = document.getElementById('modal-close-btn');

        // Başlık ve Gövde Metinlerini Eşitle
        mTitle.innerText = title || lang.notification || "Bildirim";
        mBody.innerHTML = message;
        
        // Buton Metinlerini Yerelleştir
        btnConfirm.innerText = lang.btnConfirm || "Tamam";
        btnCancel.innerText = lang.btnCancel || "İptal";

        // Tip Onay Penceresi ise İptal Butonunu Göster
        if (isConfirm) {
            btnCancel.classList.remove('d-none');
        } else {
            btnCancel.classList.add('d-none');
        }

        // Modalı Görünür Yap (Buzlu Cam Efekti Animasyonla Tetiklenir)
        overlay.classList.remove('d-none');

        // Olay Dinleyicilerini Temizleme ve Kapatma Fonksiyonu
        function cleanUp(value) {
            overlay.classList.add('d-none');
            btnConfirm.removeEventListener('click', onConfirm);
            btnCancel.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            resolve(value);
        }

        function onConfirm() { cleanUp(true); }
        function onCancel() { cleanUp(false); }

        // Dinleyicileri Ekle
        btnConfirm.addEventListener('click', onConfirm);
        btnCancel.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
    });
}

/**
 * 2. ETİKET DÜZENLEME POP-UP MOTORU (REVIZE EDİLDİ)
 * Üst taraftaki mükerrer (gereksiz) liste tamamen kaldırılmıştır.
 * Sadece alt kısımdaki dinamik etiket giriş yapısı (#etiket ✖) barındırır.
 * * @param {Object} video - Etiketleri düzenlenecek olan video nesnesi
 * @param {Function} onUpdateCallback - Veritabanı kaydı başarılı olunca çalışacak yenileme fonksiyonu
 */
export function openTagModal(video, onUpdateCallback) {
    let currentTags = video.tags ? [...video.tags] : [];
    
    // Şablonda sadece alt kısımdaki modern etiket kutusu (container) yer alıyor
    const modalContent = `
        <div class="form-group" style="margin-top: 10px; width: 100%;">
            <div id="modal-tag-box" class="tag-container">
                <input type="text" id="modal-tag-input" class="tag-input-field" placeholder="Yeni etiket yazıp Enter veya Virgül yapın">
            </div>
        </div>
    `;

    // Modern modal üzerinden penceremizi açıyoruz
    showCustomModal(modalContent, true, "✏️ Etiketleri Düzenle").then(async (confirmed) => {
        if (confirmed) {
            try {
                // Supabase'e PATCH isteği göndererek etiket dizisini güncelle
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
                console.error("Etiket patch hatası:", err);
                await showCustomModal("❌ Veritabanı bağlantı hatası.");
            }
        }
    });

    // Elementlerin DOM'a yerleşmesi için milisaniyelik gecikme (Timeout) veriyoruz
    setTimeout(() => {
        const tagBox = document.getElementById('modal-tag-box');
        const tagInput = document.getElementById('modal-tag-input');

        if (!tagBox || !tagInput) return;

        // Kutu içerisindeki etiket rozetlerini (badge) render eden alt fonksiyon
        function renderModalTags() {
            // Önceki etiketleri temizle (Input alanına dokunma)
            const badges = tagBox.querySelectorAll('.tag-badge');
            badges.forEach(b => b.remove());

            // Her bir etiketi döngüyle kutunun içine ekle
            currentTags.forEach((tag, index) => {
                const badge = document.createElement('span');
                badge.className = 'tag-badge';
                badge.innerHTML = `#${tag} <span class="tag-close" data-index="${index}">&times;</span>`;
                
                // Input alanının hemen önüne ekle ki yazma alanı hep sonda kalsın
                tagBox.insertBefore(badge, tagInput);
            });

            // Rozetlerin üzerindeki silme çarpılarına basıldığında
            tagBox.querySelectorAll('.tag-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.getAttribute('data-index'));
                    currentTags.splice(idx, 1); // Diziden sil
                    renderModalTags();         // Listeyi yeniden çiz
                });
            });
        }

        // Inputtan veri okuyup diziye ekleyen alt fonksiyon
        function addTagFromInput() {
            let value = tagInput.value.replace(/,/g, '').trim();
            if (value && !currentTags.includes(value)) {
                currentTags.push(value);
                tagInput.value = '';
                renderModalTags();
            }
        }

        // Enter tuşu dinleyicisi
        tagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTagFromInput();
            }
        });

        // Virgül tuşu dinleyicisi
        tagInput.addEventListener('input', (e) => {
            if (e.target.value.includes(',') || e.target.value.includes(' ,')) {
                addTagFromInput();
            }
        });

        // İlk açılışta mevcut etiketleri bas
        renderModalTags();
    }, 60);
}

/**
 * 3. MULTI-LANGUAGE ARABİRİM DİL YÖNETİMİ
 * Ekrandaki tüm statik metinleri config.js içerisindeki translations sözlüğüne göre
 * o an aktif olan dile (tr / en) çevirir. Hiçbir buton veya label atlanmamıştır.
 */
export function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    
    // Sayfa ve Sidebar Başlıkları
    document.title = lang.title;
    const sidebarTitle = document.getElementById('sidebar-title');
    if (sidebarTitle) sidebarTitle.innerText = lang.brandTitle;
    
    // Dil Butonu ve Menü Sekmeleri
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) langToggleBtn.innerText = lang.langBtn;
    
    const menuLibrary = document.getElementById('menu-library');
    if (menuLibrary) menuLibrary.innerText = lang.menuLibrary;
    
    const menuAddVideo = document.getElementById('menu-add-video');
    if (menuAddVideo) menuAddVideo.innerText = lang.menuAddVideo;

    // Arama Barı ve Arama Filtreleri Açılır Listeleri
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = lang.searchPlaceholder;
    
    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.innerText = lang.filterBtn;
    
    const optAllRoles = document.getElementById('opt-all-roles');
    if (optAllRoles) optAllRoles.innerText = lang.allRoles;
    
    const optLeader = document.getElementById('opt-leader');
    if (optLeader) optLeader.innerText = lang.leader;
    
    const optFollower = document.getElementById('opt-follower');
    if (optFollower) optFollower.innerText = lang.follower;
    
    const optBoth = document.getElementById('opt-both');
    if (optBoth) optBoth.innerText = lang.both;
    
    const optAllLocations = document.getElementById('opt-all-locations');
    if (optAllLocations) optAllLocations.innerText = lang.allLocations;
    
    const optDrive = document.getElementById('opt-drive');
    if (optDrive) optDrive.innerText = lang.drive;
    
    const optSocial = document.getElementById('opt-social');
    if (optSocial) optSocial.innerText = lang.social;

    // Video Kayıt Form Alanları
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.innerText = lang.formTitle;
    
    const lblInstructor = document.getElementById('lbl-instructor');
    if (lblInstructor) lblInstructor.innerText = lang.lblInstructor;
    
    const lblVideoUrl = document.getElementById('lbl-video-url');
    if (lblVideoUrl) lblVideoUrl.innerText = lang.lblVideoUrl;
    
    const coverUploadLbl = document.getElementById('lbl-cover-upload');
    if (coverUploadLbl) coverUploadLbl.innerText = lang.lblCoverUpload;
    
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText && !getUploadedCoverUrl()) {
        dropAreaText.innerText = lang.dropText;
    }

    const lblRole = document.getElementById('lbl-role');
    if (lblRole) lblRole.innerText = lang.lblRole;
    
    const lblPartner = document.getElementById('lbl-partner');
    if (lblPartner) lblPartner.innerText = lang.lblPartner;
    
    const lblDownloaded = document.getElementById('lbl-downloaded');
    if (lblDownloaded) lblDownloaded.innerText = lang.lblDownloaded;
    
    const btnSubmitVideo = document.getElementById('btn-submit-video');
    if (btnSubmitVideo) btnSubmitVideo.innerText = lang.btnSubmitVideo;
    
    const lblNewInstructorName = document.getElementById('lbl-new-instructor-name');
    if (lblNewInstructorName) lblNewInstructorName.innerText = lang.lblNewInstructorName;

    // Eğitmen Ekle/Güncelle Buton Durumu Yönetimi
    const saveBtn = document.getElementById('btn-save-instructor');
    if (saveBtn) {
        saveBtn.innerText = editInstructorId ? lang.btnUpdateIns : lang.btnAddIns;
    }

    // Dinamik Bilgilendirme Mesajları (Yükleniyor, Boş veya Hata Durumları Metin Çevirisi)
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
        const text = loadingMsg.innerText;
        if (text.includes("bağlantısı") || text.includes("Connecting")) {
            loadingMsg.innerText = lang.loading;
        } else if (loadingMsg.innerHTML.includes("boş") || loadingMsg.innerHTML.includes("empty")) {
            loadingMsg.innerHTML = lang.empty;
        } else if (text.includes("başarısız") || text.includes("failed")) {
            loadingMsg.innerText = lang.error;
        }
    }

    // Eğer hafızada yüklü video varsa dil değişiminde filtreleri tekrar tetikle ki kartlar da çevrilsin
    if (globalVideos.length > 0) {
        applyFiltersAndSearch();
    }
}

/**
 * 4. VİDEO KARTLARININ DİNAMİK OLARAK OLUŞTURULMASI VE RENDER EDİLMESİ
 * Supabase'den gelen veya filtrelenen video dizisini alır, HTML elementlerine dönüştürür.
 * Dil seçeneğine duyarlıdır ve kart içi etiket pop-up tetikleyicisini barındırır.
 * @param {Array} videos - Ekrana basılacak video nesnelerinin dizisi
 */
export function renderVideoCards(videos) {
    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    
    // Grid alanını temizle
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    // Eğer gösterilecek hiç video yoksa kullanıcıya boş kütüphane mesajı dön
    if (videos.length === 0) {
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${lang.empty}</div>`;
        return;
    }

    // Her bir video nesnesi için DOM elementlerini inşa et
    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        
        // Rol Tipi Çeviri Mantığı
        let roleDisplay = video.role_type || 'Both';
        if (currentLang === 'tr') {
            if (roleDisplay === 'Leader') roleDisplay = 'Lider';
            if (roleDisplay === 'Follower') roleDisplay = 'Takipçi';
            if (roleDisplay === 'Both') roleDisplay = 'İkisi de';
        }

        // Konum / Depolama Durumu Çeviri Mantığı
        const storageDisplay = video.is_downloaded ? '💾 Google Drive' : '🌐 Sosyal Medya';
        
        // Partner Alanı Boş Değilse Gösterilecek HTML yapısı
        const partnerDisplay = video.partner_name 
            ? `<span style="color: #94a3b8; font-size: 0.9rem;">👥 Partner: ${video.partner_name}</span>` 
            : '';
        
        // Varsayılan Kapak Resmi Mantığı (Eğer veritabanında kapak resmi URL'i yoksa)
        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;

        // Kart içi dinamik etiket badge'lerinin (rozetlerinin) hazırlanması
        let tagsHtml = '';
        if (video.tags && video.tags.length > 0) {
            tagsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;">`;
            video.tags.forEach(t => {
                tagsHtml += `<span style="background: rgba(56,189,248,0.1); color: #38bdf8; font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.2);">#${t}</span>`;
            });
            tagsHtml += `</div>`;
        }

        // Kart Şablonunun Oluşturulması
        card.innerHTML = `
            <a href="${video.url}" target="_blank" class="video-cover-link">
                <div class="video-cover-container" style="background-image: url('${coverImg}');">
                    <div class="play-overlay">
                        <span class="play-icon">▶</span>
                    </div>
                </div>
            </a>
            <div class="card-info-content" style="display: flex; flex-direction: column; gap: 5px; margin-top: 10px; width: 100%; flex: 1;">
                <strong style="font-size: 1.1rem; color: #38bdf8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}
                </strong>
                <span style="color: #94a3b8; font-size: 0.9rem;">🎬 ${lang.role}: ${roleDisplay}</span>
                ${partnerDisplay}
                <span style="color: #94a3b8; font-size: 0.9rem;">📍 ${lang.location}: ${storageDisplay}</span>
                ${tagsHtml}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 12px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                <button class="btn-tag-edit" data-id="${video.id}" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: color 0.2s;">
                    ✏️ Etiketler
                </button>
                <a href="${video.url}" target="_blank" style="color: #ec4899; font-size: 0.85rem; text-decoration: none; font-weight: 600; transition: opacity 0.2s;">
                    ${lang.watch || "İzle ↗"}
                </a>
            </div>
        `;

        // Kart Üzerindeki Etiketleri Düzenle Butonunun Event Listener'ı
        card.querySelector('.btn-tag-edit').addEventListener('click', (e) => {
            e.preventDefault();
            openTagModal(video, () => {
                fetchVideos(); // Başarılı güncelleme sonrası ana listeyi yenile
            });
        });

        // Kartı Grid Yapısına Ekle
        videoGrid.appendChild(card);
    });
}

/**
 * 5. ARAMA VE ÇOKLU FİLTRELEME MOTORU
 * Arama çubuğundaki kelimeleri, seçili rol tipini ve depolama ortamını eşzamanlı olarak tarar.
 * `globalVideos` dizisi üzerinde filtreleme yaparak `renderVideoCards` fonksiyonuna gönderir.
 */
export function applyFiltersAndSearch() {
    const searchInput = document.getElementById('search-input');
    const roleSelect = document.getElementById('filter-role-select');
    const locationSelect = document.getElementById('filter-location-select');

    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedRole = roleSelect ? roleSelect.value : 'all';
    const selectedLocation = locationSelect ? locationSelect.value : 'all';

    const filtered = globalVideos.filter(video => {
        // Arama kriterleri: Eğitmen adı, partner adı veya etiket eşleşmesi
        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const tagMatch = video.tags ? video.tags.some(t => t.toLowerCase().includes(searchQuery)) : false;
        
        const matchesSearch = insName.includes(searchQuery) || partnerName.includes(searchQuery) || tagMatch;
        
        // Rol Kriteri Eşleşmesi
        const matchesRole = (selectedRole === 'all') || (video.role_type === selectedRole);

        // Konum / Ortam Kriteri Eşleşmesi
        let matchesLocation = true;
        if (selectedLocation === 'drive') {
            matchesLocation = (video.is_downloaded === true);
        } else if (selectedLocation === 'social') {
            matchesLocation = (video.is_downloaded === false || video.is_downloaded === null);
        }

        return matchesSearch && matchesRole && matchesLocation;
    });

    // Filtrelenmiş sonuçları ekrana bas
    renderVideoCards(filtered);
}

/**
 * 6. SUPABASE VERİTABANI BAĞLANTISI (FETCH VIDEOS)
 * REST API üzerinden 'videos' tablosundaki tüm kayıtları ilişkili eğitmen isimleriyle birlikte çeker.
 */
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

        if (!response.ok) throw new Error("Veritabanından veriler başarıyla çekilemedi.");

        // Gelen veriyi global hafızaya (state) kaydet
        globalVideos = await response.json();
        
        // Filtreleme motorunu çalıştırarak ekrana bas
        applyFiltersAndSearch();

    } catch (error) {
        console.error("Fetch hatası:", error);
        if (videoGrid) {
            videoGrid.innerHTML = `<div class="info-msg" id="loading-msg" style="color: #ef4444;">${lang.error}</div>`;
        }
    }
}

/**
 * 7. FORM İÇİN EĞİTMEN SEÇİM KUTUSUNU DOLDURMA (FETCH INSTRUCTORS)
 * Kayıt formundaki select elementini alfabetik eğitmen isimleriyle doldurur.
 */
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
        
        if (!response.ok) throw new Error("Eğitmen listesi alınamadı.");
        
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
        console.error("Eğitmen listesi yüklenirken hata oluştu:", e);
    }
}

/**
 * 8. EĞİTMEN KAYDETME VEYA GÜNCELLEME İŞLEMİ (POST / PATCH)
 * Eğitmen ekleme formundaki girdiyi okur, yeni kayıt açar veya mevcut kaydı günceller.
 */
async function handleInstructorSubmit() {
    const nameInput = document.getElementById('form-new-instructor-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const lang = translations[currentLang];

    if (!name) {
        await showCustomModal(lang.insAlert);
        return;
    }

    try {
        let response;
        if (editInstructorId) {
            // Düzenleme Modu (PATCH)
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
            // Yeni Kayıt Modu (POST)
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
            
            // Temizlik ve Arayüz Sıfırlama işlemleri
            nameInput.value = '';
            editInstructorId = null; 
            document.getElementById('btn-save-instructor').innerText = lang.btnAddIns;
            document.getElementById('new-instructor-container').classList.add('d-none');
            
            // Formu ve video listesini tazele
            await fetchInstructorsForForm();
            fetchVideos();
        } else {
            await showCustomModal("❌ İşlem başarısız oldu. Girdiğiniz isimde bir eğitmen zaten mevcut olabilir.");
        }
    } catch (err) {
        console.error("Eğitmen veritabanı hatası:", err);
        await showCustomModal("❌ Sunucu ile bağlantı kurulamadı.");
    }
}

/**
 * 9. MODERN ONAY PENCERELİ EĞİTMEN SİLME İŞLEMİ (DELETE)
 * Bir eğitmen silindiğinde ona ait cascade bağlı videoların da silineceğini kullanıcıya onaylatır.
 */
async function deleteInstructor() {
    const select = document.getElementById('form-instructor-select');
    const instructorId = select ? select.value : null;
    const lang = translations[currentLang];

    if (!instructorId) return;

    // Promise tabanlı modern onay kutumuzu çağırıyoruz
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
                fetchVideos(); // Silinen eğitmene ait kartların gitmesi için listeyi yenile
            } else {
                await showCustomModal("❌ Eğitmen silme işlemi veritabanı tarafından reddedildi.");
            }
        } catch (err) {
            console.error("Eğitmen silme hatası:", err);
            await showCustomModal("❌ Bağlantı hatası sebebiyle silme gerçekleştirilemedi.");
        }
    }
}

/**
 * 10. YENİ VİDEO FORMU GÖNDERİMİ (POST)
 * Formdaki verileri derler, yapıştırılan resim URL'ini de alarak yeni bir video kaydı oluşturur.
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const instructorId = document.getElementById('form-instructor-select').value;
    const videoUrl = document.getElementById('form-video-url').value;
    const roleType = document.getElementById('form-role-select').value;
    const partnerName = document.getElementById('form-partner-name').value;
    const isDownloaded = document.getElementById('form-is-downloaded').checked;

    if (!instructorId) {
        await showCustomModal("Lütfen video kaydetmeden önce listeden bir eğitmen seçin veya yanındaki buton ile ekleyin.");
        return;
    }

    // Gönderilecek Veri Paketi (Payload)
    const payload = {
        instructor_id: parseInt(instructorId),
        url: videoUrl,
        role_type: roleType,
        partner_name: partnerName || null,
        is_downloaded: isDownloaded,
        cover_url: getUploadedCoverUrl(), // storage.js dosyasından çekilen güncel görsel linki
        tags: [] // Başlangıçta boş etiket dizisiyle açılır
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
            
            // Formu ve yüklenen resimleri sıfırla
            document.getElementById('add-video-form').reset();
            resetUploadedCoverUrl();
            
            const imgPreview = document.getElementById('image-preview');
            if (imgPreview) imgPreview.classList.add('d-none');
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) {
                dropAreaText.innerText = lang.dropText;
                dropAreaText.classList.remove('d-none');
            }
            
            // Kullanıcıyı otomatik olarak kütüphane paneline geri yönlendir
            document.getElementById('menu-library').click();
        } else {
            await showCustomModal("❌ Hata: Girilen bilgiler doğrulanamadı ve video kaydedilemedi.");
        }
    } catch (err) {
        console.error("Video post hatası:", err);
        await showCustomModal("❌ Sunucu bağlantı hatası yaşandı.");
    }
}

/**
 * 11. EVENT LISTENERS VE DOM INITIALIZATION (BAŞLANGIÇ TETİKLEYİCİLERİ)
 * Sayfa yüklendiği an tüm DOM elemanlarını yakalar ve ilgili tıklama/girdi olaylarını bağlar.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Dil metinlerini eşitle ve veritabanı bağlantılarını başlat
    updateInterfaceLanguage();
    fetchVideos();
    fetchInstructorsForForm();

    // Dil Değiştirme Buton Tıklaması
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'tr' ? 'en' : 'tr';
            updateInterfaceLanguage();
        });
    }

    // Menü Yönetimi: Kütüphane Sekmesine Tıklama
    const menuLibrary = document.getElementById('menu-library');
    if (menuLibrary) {
        menuLibrary.addEventListener('click', (e) => {
            document.getElementById('menu-add-video').classList.remove('active');
            e.target.classList.add('active');
            document.getElementById('view-add-container').classList.add('d-none');
            document.getElementById('view-library-container').classList.remove('d-none');
            fetchVideos(); // Verileri tazelemek için fetch isteğini yenile
        });
    }

    // Menü Yönetimi: Video Ekleme Sekmesine Tıklama
    const menuAddVideo = document.getElementById('menu-add-video');
    if (menuAddVideo) {
        menuAddVideo.addEventListener('click', (e) => {
            document.getElementById('menu-library').classList.remove('active');
            e.target.classList.add('active');
            document.getElementById('view-library-container').classList.add('d-none');
            document.getElementById('view-add-container').classList.remove('d-none');
            fetchInstructorsForForm(); // Form içindeki eğitmen listesini yenile
        });
    }

    // Form: Yeni Eğitmen Giriş Alanı Görünürlük Tetikleyicisi (➕ Butonu)
    const btnToggleNewInstructor = document.getElementById('btn-toggle-new-instructor');
    if (btnToggleNewInstructor) {
        btnToggleNewInstructor.addEventListener('click', () => {
            editInstructorId = null; 
            document.getElementById('form-new-instructor-input').value = '';
            document.getElementById('btn-save-instructor').innerText = translations[currentLang].btnAddIns;
            const container = document.getElementById('new-instructor-container');
            if (container) container.classList.toggle('d-none');
        });
    }

    // Form: Eğitmen İsmi Düzenleme Tetikleyicisi (✏️ Butonu)
    const btnEditInstructor = document.getElementById('btn-edit-instructor');
    if (btnEditInstructor) {
        btnEditInstructor.addEventListener('click', () => {
            const select = document.getElementById('form-instructor-select');
            if (!select || !select.value) return;
            
            editInstructorId = select.value;
            const selectedName = select.options[select.selectedIndex].text;
            
            const nameInput = document.getElementById('form-new-instructor-input');
            const saveBtn = document.getElementById('btn-save-instructor');
            const container = document.getElementById('new-instructor-container');
            
            if (nameInput) nameInput.value = selectedName;
            if (saveBtn) saveBtn.innerText = translations[currentLang].btnUpdateIns;
            if (container) container.classList.remove('d-none');
        });
    }

    // Form Operasyonları ve Filtreleme Dinleyicileri Bağlantıları
    const btnDeleteInstructor = document.getElementById('btn-delete-instructor');
    if (btnDeleteInstructor) btnDeleteInstructor.addEventListener('click', deleteInstructor);

    const btnSaveInstructor = document.getElementById('btn-save-instructor');
    if (btnSaveInstructor) btnSaveInstructor.addEventListener('click', handleInstructorSubmit);

    const addVideoForm = document.getElementById('add-video-form');
    if (addVideoForm) addVideoForm.addEventListener('submit', handleFormSubmit);
    
    // Filtre Değişimleri ve Gerçek Zamanlı Girdi Dinleyicileri
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSearch);

    const filterRoleSelect = document.getElementById('filter-role-select');
    if (filterRoleSelect) filterRoleSelect.addEventListener('change', applyFiltersAndSearch);

    const filterLocationSelect = document.getElementById('filter-location-select');
    if (filterLocationSelect) filterLocationSelect.addEventListener('change', applyFiltersAndSearch);

    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) filterBtn.addEventListener('click', applyFiltersAndSearch);

    // Görsel Sürükle - Bırak / Yapıştır Alanı Dinleyicisi
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    }
});