// SUPABASE BAĞLANTI BİLGİLERİ
const SUPABASE_URL = "https://airmuygsltqecjdgxlfh.supabase.co";
const SUPABASE_KEY = "sb_publishable_qdDgX_KWXDdDnEu8ljnF3w_9L4FDWso";

// DİL SÖZLÜĞÜ (TR / EN)
const translations = {
    tr: {
        title: "Tango Library",
        menuLibrary: "📚 Kütüphane",
        menuAddVideo: "➕ Yeni Video Ekle",
        searchPlaceholder: "Eğitmen, hareket veya etiket ara...",
        filterBtn: "🔍 Filtrele",
        loading: "Veritabanı bağlantısı kuruluyor...",
        empty: "Kütüphaneniz henüz boş. <br> Sol menüden yeni video eklemeye başlayabilirsiniz! 💃🕺",
        error: "❌ Veritabanı bağlantısı başarısız oldu. Lütfen anahtarlarınızı kontrol edin.",
        role: "🎬 Rol",
        location: "📍 Ortam",
        watch: "🔗 Videoyu İzle →",
        langBtn: "🇬🇧 EN",
        formTitle: "➕ Yeni Video Kaydet",
        lblInstructor: "Eğitmen Seç / Ekle:",
        lblVideoUrl: "Video URL (Instagram Reels / YouTube Shorts vb.):",
        lblRole: "Rol Tipi:",
        lblPartner: "Partner Adı (İsteğe Bağlı):",
        lblDownloaded: "Google Drive'a Yedeklendi mi?",
        btnSubmitVideo: "💾 Veritabanına Kaydet",
        successSave: "🎉 Video başarıyla kütüphaneye eklendi!"
    },
    en: {
        title: "Tango Library",
        menuLibrary: "📚 Library",
        menuAddVideo: "➕ Add New Video",
        searchPlaceholder: "Search instructor, movement or tag...",
        filterBtn: "🔍 Filter",
        loading: "Connecting to database...",
        empty: "Your library is empty yet. <br> You can start adding new videos from the left menu! 💃🕺",
        error: "❌ Database connection failed. Please check your keys.",
        role: "🎬 Role",
        location: "📍 Storage",
        watch: "🔗 Watch Video →",
        langBtn: "🇹🇷 TR",
        formTitle: "➕ Save New Video",
        lblInstructor: "Select / Add Instructor:",
        lblVideoUrl: "Video URL (Instagram Reels / YouTube Shorts etc.):",
        lblRole: "Role Type:",
        lblPartner: "Partner Name (Optional):",
        lblDownloaded: "Backed up to Google Drive?",
        btnSubmitVideo: "💾 Save to Database",
        successSave: "🎉 Video successfully added to library!"
    }
};

let currentLang = 'tr';
let globalVideos = [];

function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    // Form elemanlarının dilleri
    document.getElementById('form-title').innerText = lang.formTitle;
    document.getElementById('lbl-instructor').innerText = lang.lblInstructor;
    document.getElementById('lbl-video-url').innerText = lang.lblVideoUrl;
    document.getElementById('lbl-role').innerText = lang.lblRole;
    document.getElementById('lbl-partner').innerText = lang.lblPartner;
    document.getElementById('lbl-downloaded').innerText = lang.lblDownloaded;
    document.getElementById('btn-submit-video').innerText = lang.btnSubmitVideo;

    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
        if (loadingMsg.innerText.includes("bağlantısı") || loadingMsg.innerText.includes("Connecting")) {
            loadingMsg.innerText = lang.loading;
        } else if (loadingMsg.innerText.includes("boş") || loadingMsg.innerText.includes("empty")) {
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
        card.className = 'menu-btn active';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '8px';
        
        let roleDisplay = video.role_type || 'Both';
        if (currentLang === 'tr') {
            if (roleDisplay === 'Leader') roleDisplay = 'Lider';
            if (roleDisplay === 'Follower') roleDisplay = 'Takipçi';
            if (roleDisplay === 'Both') roleDisplay = 'İkisi de';
        }

        const storageDisplay = video.is_downloaded ? '💾 Google Drive' : '🌐 Social Media';
        
        card.innerHTML = `
            <strong style="font-size: 1.1rem; color: #38bdf8;">👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}</strong>
            <span style="color: #94a3b8; font-size: 0.9rem;">${lang.role}: ${roleDisplay}</span>
            <span style="color: #94a3b8; font-size: 0.9rem;">${lang.location}: ${storageDisplay}</span>
            <a href="${video.url}" target="_blank" style="color: #ec4899; font-size: 0.85rem; margin-top: 10px; text-decoration: none; font-weight: 600;">${lang.watch}</a>
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
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg" style="color: #ef4444;">${lang.error}</div>`;
    }
}

// Supabase'den eğitmen listesini çekip formdaki açılır menüye dolduran fonksiyon
async function fetchInstructorsForForm() {
    const select = document.getElementById('form-instructor-select');
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const instructors = await response.json();
        
        // Menüyü sıfırla, varsayılan bir "Seçiniz" veya örnek eğitmen koyalım
        select.innerHTML = '';
        
        if (instructors.length === 0) {
            // Eğer hiç eğitmen yoksa test amaçlı el ile seçebileceğimiz gizli bir id oluşturalım veya boş bırakalım
            select.innerHTML = `<option value="">Önce Supabase'den Eğitmen Ekleyin</option>`;
        } else {
            instructors.forEach(ins => {
                select.innerHTML += `<option value="${ins.id}">${ins.name}</option>`;
            });
        }
    } catch (e) {
        console.error("Eğitmenler çekilemedi:", e);
    }
}

// FORM GÖNDERME (VİDEO KAYDETME) FONKSİYONU
async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];

    const instructorId = document.getElementById('form-instructor-select').value;
    const videoUrl = document.getElementById('form-video-url').value;
    const roleType = document.getElementById('form-role-select').value;
    const partnerName = document.getElementById('form-partner-name').value;
    const isDownloaded = document.getElementById('form-is-downloaded').checked;

    if(!instructorId) {
        alert("Lütfen önce bir eğitmen seçin.");
        return;
    }

    const payload = {
        instructor_id: parseInt(instructorId),
        url: videoUrl,
        role_type: roleType,
        partner_name: partnerName || null,
        is_downloaded: isDownloaded
    };

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(lang.successSave);
            document.getElementById('add-video-form').reset();
            // Kütüphane sayfasına geri dön ve listeyi yenile
            document.getElementById('menu-library').click();
        } else {
            alert("Hata: Video kaydedilemedi. (Aynı URL daha önce eklenmiş olabilir)");
        }
    } catch (err) {
        console.error(err);
        alert("Bağlantı hatası gerçekleşti.");
    }
}

// EVENT LISTENERS & INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    updateInterfaceLanguage();
    fetchVideos();
    fetchInstructorsForForm();

    // Dil Değişimi
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });

    // Sekme Geçişleri: Kütüphane Butonu
    document.getElementById('menu-library').addEventListener('click', (e) => {
        document.getElementById('menu-add-video').classList.remove('active');
        e.target.classList.add('active');
        document.getElementById('view-add-container').classList.add('d-none');
        document.getElementById('view-library-container').classList.remove('d-none');
        fetchVideos(); // Listeyi tazele
    });

    // Sekme Geçişleri: Yeni Video Ekle Butonu
    document.getElementById('menu-add-video').addEventListener('click', (e) => {
        document.getElementById('menu-library').classList.remove('active');
        e.target.classList.add('active');
        document.getElementById('view-library-container').classList.add('d-none');
        document.getElementById('view-add-container').classList.remove('d-none');
        fetchInstructorsForForm(); // Güncel eğitmenleri getir
    });

    // Form Gönderimi
    document.getElementById('add-video-form').addEventListener('submit', handleFormSubmit);
});