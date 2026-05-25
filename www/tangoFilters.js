/**
 * 💃 ARJANTİN TANGO KOMBİNASYON KÜTÜPHANESİ - AKILLI FİLTRE MOTORU
 * Bu dosya kütüphanedeki videoları süzmeye yarar ve açılır kutuları doldurur.
 */
import { translations } from './config.js';

// 📅 Yardımcı Fonksiyon: Karmaşık tarihleri "Mayıs 2026" formatına çevirir.
function formatAyYil(tarihString) {
    if (!tarihString) return 'Bilinmeyen Tarih';
    const tarih = new Date(tarihString);
    return tarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

/**
 * 🧺 GÖREV 1: HTML sayfasındaki Açılır Kutuları (Dropdown) Canlı Videolara Göre Doldurur
 * Seçimleri koruma sistemi eklendi. currentLang parametresi ile çokdillilik sağlanır.
 */
export function populateFilterDropdowns(videolar, currentLang) {
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');
    const langData = translations[currentLang];

    // Eğer kutular ekranda yoksa işlemi durdur
    if (!instructorSelect || !tagSelect || !dateSelect) return;

    // ⚡ AKILLI KORUMA: Kullanıcının temizlikten önce seçmiş olduğu eski değerleri hafızaya alıyoruz
    const oldInstructor = instructorSelect.value;
    const oldTag = tagSelect.value;
    const oldDate = dateSelect.value;

    // 1. Kutuların içini tamamen sıfırlıyoruz ve ilk seçeneklerini koyuyoruz (artık çeviri destekli)
    instructorSelect.innerHTML = `<option value="all">${langData.allInstructors}</option>`;
    tagSelect.innerHTML = `<option value="all">${langData.allTags}</option>`;
    dateSelect.innerHTML = `<option value="all">${langData.allDates}</option>`;

    // 2. Videolardaki güncel Eğitmen İsimlerini topluyoruz
    const egitmenlerTorba = new Set();
    videolar.forEach(video => {
        if (video.instructor_name) {
            egitmenlerTorba.add(video.instructor_name.trim());
        }
    });

    // Eğitmenleri alfabetik sırayla kutuya ekliyoruz
    Array.from(egitmenlerTorba).sort().forEach(egitmenAdi => {
        const opt = document.createElement('option');
        opt.value = egitmenAdi;
        opt.innerText = egitmenAdi;
        instructorSelect.appendChild(opt);
    });

    // 3. AKILLI ETİKET SİSTEMİ
    const etiketlerTorba = new Set();
    videolar.forEach(video => {
        if (video.tags) {
            video.tags.split(',').forEach(etiket => {
                const temizEtiket = etiket.trim();
                if (temizEtiket) {
                    etiketlerTorba.add(temizEtiket);
                }
            });
        }
    });

    // Canlı etiketleri alfabetik sırayla kutuya diziyoruz
    Array.from(etiketlerTorba).sort().forEach(etiketAdi => {
        const opt = document.createElement('option');
        opt.value = etiketAdi;
        opt.innerText = `#${etiketAdi}`;
        tagSelect.appendChild(opt);
    });

    // 4. Videolardaki güncel Tarihleri topluyoruz (her zaman Türkçe format, çevrilmez)
    const tarihlerTorba = new Set();
    videolar.forEach(video => {
        if (video.created_at) {
            tarihlerTorba.add(formatAyYil(video.created_at));
        }
    });

    // Tarihleri kutuya diziyoruz
    Array.from(tarihlerTorba).forEach(tarihMetni => {
        const opt = document.createElement('option');
        opt.value = tarihMetni;
        opt.innerText = tarihMetni;
        dateSelect.appendChild(opt);
    });

    // ⚡ HAFIZAYI GERİ YÜKLEME: Eğer kullanıcının eski seçtiği değer yeni listede hala varsa, onu otomatik geri seç
    if (Array.from(instructorSelect.options).some(opt => opt.value === oldInstructor)) {
        instructorSelect.value = oldInstructor;
    }
    if (Array.from(tagSelect.options).some(opt => opt.value === oldTag)) {
        tagSelect.value = oldTag;
    }
    if (Array.from(dateSelect.options).some(opt => opt.value === oldDate)) {
        dateSelect.value = oldDate;
    }
}

/**
 * 🔍 GÖREV 2: Seçtiğin filtrelere göre eşleşen videoları bulur ve ekrana taşır
 */
export function getFilteredVideos(videolar, filtreler) {
    const { aramaMetni, rol, egitmen, etiket, tarih, ortam } = filtreler;

    return videolar.filter(video => {
        // 0. Arama Çubuğu Filtresi (Eğitmen adı, etiketler veya partner adında eşleşme arar)
        if (aramaMetni) {
            const aranacakKelime = aramaMetni.toLowerCase().trim();
            const egitmenUyuyor = video.instructor_name?.toLowerCase().includes(aranacakKelime);
            const etiketUyuyor = video.tags?.toLowerCase().includes(aranacakKelime);
            const partnerUyuyor = video.partner_name?.toLowerCase().includes(aranacakKelime);
            
            if (!egitmenUyuyor && !etiketUyuyor && !partnerUyuyor) return false;
        }

        // 1. Rol Tipi Filtresi (Lider / Takipçi / Çift)
        if (rol !== 'all' && video.role_type !== rol) return false;

        // 2. Eğitmen Filtresi
        if (egitmen !== 'all' && video.instructor_name !== egitmen) return false;

        // 3. Etiket Filtresi
        if (etiket !== 'all') {
            if (!video.tags) return false;
            const videoEtiketleri = video.tags.split(',').map(t => t.trim());
            if (!videoEtiketleri.includes(etiket)) return false;
        }

        // 4. Zaman Filtresi (Örn: "Mayıs 2026")
        if (tarih !== 'all' && formatAyYil(video.created_at) !== tarih) return false;

        // 5. Ortam Filtresi (Google Drive mı, Sosyal Medya mı?)
        if (ortam !== 'all') {
            if (ortam === 'drive' && !video.is_downloaded) return false;
            if (ortam === 'social' && video.is_downloaded) return false;
        }

        // Tüm testlerden geçen video başarıyla listelenir!
        return true;
    });
}

/**
 * 🏷️ GÖREV 3: Yeni video eklerken alttaki otomatik tamamlama kutusunu besler
 */
export function getAllUniqueTagsPool(videolar) {
    const torba = new Set();
    videolar.forEach(video => {
        if (video.tags) {
            video.tags.split(',').map(t => t.trim()).forEach(t => {
                if (t) torba.add(t);
            });
        }
    });
    return Array.from(torba).sort();
}