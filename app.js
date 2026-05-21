// SUPABASE BAĞLANTI BİLGİLERİ
const SUPABASE_URL = "https://coasifpuxnykgswnjguh.supabase.co";
const SUPABASE_KEY = "sb_publishable_xQ58KgtPyiyCUHWynnHdbQ_k78iXfS1";

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
        langBtn: "🇬🇧 EN"
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
        langBtn: "🇹🇷 TR"
    }
};

// Varsayılan dilimiz Türkçe başlıyor
let currentLang = 'tr';
let globalVideos = []; // Videoları hafızada tutup dil değişiminde hızlıca basmak için

// Arayüz kelimelerini seçili dile göre güncelleyen fonksiyon
function updateInterfaceLanguage() {
    const lang = translations[currentLang];
    
    // Elemanları güncelle
    document.getElementById('lang-toggle-btn').innerText = lang.langBtn;
    document.getElementById('menu-library').innerText = lang.menuLibrary;
    document.getElementById('menu-add-video').innerText = lang.menuAddVideo;
    document.getElementById('search-input').placeholder = lang.searchPlaceholder;
    document.getElementById('filter-btn').innerText = lang.filterBtn;
    
    // Eğer ekranda sadece yükleniyor veya boş mesajı varsa onları da çevir
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

    // Eğer halihazırda listelenmiş videolar varsa kartların dilini güncellemek için ekrana tekrar bas
    if (globalVideos.length > 0) {
        renderVideoCards(globalVideos);
    }
}

// Videoları ekrana kartlar halinde basan fonksiyon
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
        
        // Veritabanından gelen Leader/Follower değerlerini de dile göre uyarlayalım
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

// Veritabanından videoları çeken ana fonksiyon
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

// Sayfa yüklendiğinde ve dil butonuna tıklandığında tetiklenecek olaylar
document.addEventListener('DOMContentLoaded', () => {
    // İlk dil ayarını yap
    updateInterfaceLanguage();
    // Verileri çek
    fetchVideos();

    // Dil butonuna tıklama olayı
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        currentLang = currentLang === 'tr' ? 'en' : 'tr';
        updateInterfaceLanguage();
    });
});