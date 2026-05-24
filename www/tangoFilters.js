/**
 * 💃 ARJANTİN TANGO KOMBİNASYON KÜTÜPHANESİ - AKILLI FİLTRE MOTORU
 * Bu dosya kütüphanedeki videoları süzmeye yarar ve açılır kutuları doldurur.
 */
import { translations } from './config.js';

// 📅 Yardımcı Fonksiyon: Karmaşık tarihleri "Mayıs 2026" veya "May 2026" formatına çevirir.
function formatAyYil(tarihString, currentLang = 'tr') {
    if (!tarihString) return translations[currentLang].unknownDate || 'Bilinmeyen Tarih';
    const tarih = new Date(tarihString);
    return tarih.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' });
}

/**
 * 🧺 GÖREV 1: HTML sayfasındaki Açılır Kutuları (Dropdown) Canlı Videolara Göre Doldurur
 * Seçimleri koruma sistemi eklendi.
 */
export function populateFilterDropdowns(videolar, currentLang = 'tr') {
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');

    // Eğer kutular ekranda yoksa işlemi durdur
    if (!instructorSelect || !tagSelect || !dateSelect) return;

    const lang = translations[currentLang];

    // ⚡ AKILLI KORUMA: Kullanıcının temizlikten önce seçmiş olduğu eski değerleri hafızaya alıyoruz
    const oldInstructor = instructorSelect.value;
    const oldTag = tagSelect.value;
    const oldDate = dateSelect.value;

    // İçerikleri temizle ve ilk "Tümünü Göster" seçeneklerini ekle
    instructorSelect.innerHTML = `<option value="all">${lang.allInstructors}</option>`;
    tagSelect.innerHTML = `<option value="all">${lang.allTags}</option>`;
    dateSelect.innerHTML = `<option value="all">${lang.allDates}</option>`;

    const uniqueInstructors = new Set();
    const uniqueTags = new Set();
    const uniqueDates = new Set();

    videolar.forEach(video => {
        if (video.instructor_name) uniqueInstructors.add(video.instructor_name);
        if (video.tags) {
            video.tags.split(',').forEach(t => {
                const cleanTag = t.trim();
                if (cleanTag) uniqueTags.add(cleanTag);
            });
        }
        if (video.created_at) {
            uniqueDates.add(formatAyYil(video.created_at, currentLang));
        }
    });

    // Sıralı olarak elemanları dropdown'lara ekle
    Array.from(uniqueInstructors).sort().forEach(ins => {
        const opt = document.createElement('option');
        opt.value = ins;
        opt.innerText = ins;
        instructorSelect.appendChild(opt);
    });

    Array.from(uniqueTags).sort().forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.innerText = `#${tag}`;
        tagSelect.appendChild(opt);
    });

    Array.from(uniqueDates).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
        const opt = document.createElement('option');
        opt.value = date;
        opt.innerText = date;
        dateSelect.appendChild(opt);
    });

    // Eski seçimleri geri yüklemeye çalış (eğer hala listede varsa)
    if (Array.from(instructorSelect.options).some(o => o.value === oldInstructor)) {
        instructorSelect.value = oldInstructor;
    }
    if (Array.from(tagSelect.options).some(o => o.value === oldTag)) {
        tagSelect.value = oldTag;
    }
    if (Array.from(dateSelect.options).some(o => o.value === oldDate)) {
        dateSelect.value = oldDate;
    }
}

/**
 * 🔍 GÖREV 2: Gelişmiş Arama ve Filtreleme Motoru
 */
export function getFilteredVideos(videolar, aramaKelimesi, rol, egitmen, etiket, tarih, ortam, currentLang = 'tr') {
    const kelime = aramaKelimesi ? aramaKelimesi.trim().toLowerCase() : '';

    return videolar.filter(video => {
        if (kelime) {
            const egitmenUyuyor = video.instructor_name && video.instructor_name.toLowerCase().includes(kelime);
            const partnerUyuyor = video.partner_name && video.partner_name.toLowerCase().includes(kelime);
            const etiketUyuyor = video.tags && video.tags.toLowerCase().includes(kelime);

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
        if (tarih !== 'all' && formatAyYil(video.created_at, currentLang) !== tarih) return false;

        // 5. Ortam Filtresi (Google Drive mı, Sosyal Medya mı?)
        if ( ortam !== 'all') {
            if (ortam === 'drive' && !video.is_downloaded) return false;
            if (ortam === 'social' && video.is_downloaded) return false;
        }

        return true;
    });
}

/**
 * 🏷️ GÖREV 3: Tüm videolardan benzersiz etiket havuzu oluşturur (Otomatik tamamlama için)
 */
export function getAllUniqueTagsPool(videolar) {
    const pool = new Set();
    videolar.forEach(video => {
        if (video.tags) {
            video.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean) pool.add(clean);
            });
        }
    });
    return Array.from(pool).sort();
}