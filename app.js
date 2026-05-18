// SUPABASE BAĞLANTI BİLGİLERİ
const SUPABASE_URL = "https://airmuygsltqecjdgxlfh.supabase.co";
const SUPABASE_KEY = "sb_publishable_qdDgX_KWXDdDnEu8ljnF3w_9L4FDWso";

// Uygulama açıldığında veritabanından videoları çekecek ana fonksiyon
async function fetchVideos() {
    const videoGrid = document.getElementById('video-grid');
    
    try {
        // Supabase API'sine videoları getirmesi için istek atıyoruz
        // Bu istek videolarla birlikte eğitmen adını da otomatik bağlayacak
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Veri çekilemedi.");

        const videos = await response.json();
        
        // Eğer kütüphane henüz boşsa kullanıcıyı bilgilendiriyoruz
        if (videos.length === 0) {
            videoGrid.innerHTML = `<div class="info-msg">Kütüphaneniz henüz boş. <br> Sol menüden yeni video eklemeye başlayabilirsiniz! 💃🕺</div>`;
            return;
        }

        // Videolar varsa ekrandaki "Bağlantı kuruluyor" yazısını silip kartları diziyoruz
        videoGrid.innerHTML = '';
        
        videos.forEach(video => {
            const card = document.createElement('div');
            card.className = 'menu-btn active'; // Geçici olarak cam stilini verdik
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.gap = '8px';
            
            card.innerHTML = `
                <strong style="font-size: 1.1rem; color: #38bdf8;">👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}</strong>
                <span style="color: #94a3b8; font-size: 0.9rem;">🎬 Rol: ${video.role_type || 'Belirtilmedi'}</span>
                <span style="color: #94a3b8; font-size: 0.9rem;">📍 Ortam: ${video.is_downloaded ? '💾 Google Drive' : '🌐 Sosyal Medya'}</span>
                <a href="${video.url}" target="_blank" style="color: #ec4899; font-size: 0.85rem; margin-top: 10px; text-decoration: none; font-weight: 600;">🔗 Videoyu İzle →</a>
            `;
            videoGrid.appendChild(card);
        });

    } catch (error) {
        console.error("Hata:", error);
        videoGrid.innerHTML = `<div class="info-msg" style="color: #ef4444;">❌ Veritabanı bağlantısı başarısız oldu. Lütfen anahtarlarınızı kontrol edin.</div>`;
    }
}

// Sayfa tamamen yüklendiğinde otomatik olarak verileri çekmeye başla
document.addEventListener('DOMContentLoaded', fetchVideos);