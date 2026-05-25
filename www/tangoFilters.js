/**
 * 💃 ARJANTİN TANGO KOMBİNASYON KOLEKSİYONU - AKILLI FİLTRE MOTORU
 * Bu dosya kütüphanedeki videoları süzmeye yarar ve açılır kutuları doldurur.
 */

import { translations } from './config.js';

// 📅 Yardımcı Fonksiyon: Tarihi dile göre "Mayıs 2026" veya "May 2026" formatına çevirir.
function formatAyYil(tarihString, lang) {
    if (!tarihString) return lang === 'tr' ? 'Bilinmeyen Tarih' : 'Unknown Date';
    const tarih = new Date(tarihString);
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    return tarih.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/**
 * 🧺 GÖREV 1: HTML sayfasındaki Açılır Kutuları (Dropdown) Canlı Videolara Göre Doldurur
 * Artık dil parametresi alır ve çeviri metinlerini kullanır.
 * Eğitmenlerin ve kaynakların (drive/social) yanına sayı eklenir.
 */
export function populateFilterDropdowns(videolar, currentLang) {
    const lang = translations[currentLang];
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');

    if (!instructorSelect || !tagSelect || !dateSelect) return;

    // Önceki seçimleri hafızaya al
    const oldInstructor = instructorSelect.value;
    const oldTag = tagSelect.value;
    const oldDate = dateSelect.value;

    // Kutuları temizle ve çevrilmiş "Tüm ..." seçeneklerini ekle
    instructorSelect.innerHTML = `<option value="all">${lang.allInstructors}</option>`;
    tagSelect.innerHTML = `<option value="all">${lang.allTags}</option>`;
    dateSelect.innerHTML = `<option value="all">${lang.allDates}</option>`;

    // 📊 Eğitmenlere göre video sayılarını hesapla
    const instructorCountMap = new Map();
    videolar.forEach(video => {
        if (video.instructor_name) {
            const name = video.instructor_name.trim();
            instructorCountMap.set(name, (instructorCountMap.get(name) || 0) + 1);
        }
    });

    // Eğitmenleri alfabetik sırayla, yanında sayı ile ekle
    const sortedInstructors = Array.from(instructorCountMap.keys()).sort();
    sortedInstructors.forEach(egitmenAdi => {
        const count = instructorCountMap.get(egitmenAdi);
        const opt = document.createElement('option');
        opt.value = egitmenAdi;
        opt.innerText = `${egitmenAdi} (${count})`;
        instructorSelect.appendChild(opt);
    });

    // Etiketleri ekle
    const etiketlerTorba = new Set();
    videolar.forEach(video => {
        if (video.tags) {
            video.tags.split(',').forEach(etiket => {
                const temizEtiket = etiket.trim();
                if (temizEtiket) etiketlerTorba.add(temizEtiket);
            });
        }
    });
    Array.from(etiketlerTorba).sort().forEach(etiketAdi => {
        const opt = document.createElement('option');
        opt.value = etiketAdi;
        opt.innerText = `#${etiketAdi}`;
        tagSelect.appendChild(opt);
    });

    // Tarihleri ekle (dile göre formatlanmış)
    const tarihlerTorba = new Set();
    videolar.forEach(video => {
        if (video.created_at) {
            tarihlerTorba.add(formatAyYil(video.created_at, currentLang));
        }
    });
    Array.from(tarihlerTorba).forEach(tarihMetni => {
        const opt = document.createElement('option');
        opt.value = tarihMetni;
        opt.innerText = tarihMetni;
        dateSelect.appendChild(opt);
    });

    // 📊 Kaynaklar (location) seçeneklerine sayı ekle (Google Drive ve Sosyal Medya)
    const driveCount = videolar.filter(v => v.is_downloaded === true).length;
    const socialCount = videolar.filter(v => v.is_downloaded === false).length;
    
    const driveOption = document.getElementById('opt-drive');
    const socialOption = document.getElementById('opt-social');
    if (driveOption) {
        driveOption.innerText = `${lang.drive} (${driveCount})`;
    }
    if (socialOption) {
        socialOption.innerText = `${lang.social} (${socialCount})`;
    }
    // "Tüm Kaynaklar" seçeneğinin metnini güncelle (sayı ekleme isteğe bağlı, sadece başlık)
    const allLocationsOpt = document.getElementById('opt-all-locations');
    if (allLocationsOpt) {
        allLocationsOpt.innerText = lang.allLocations;
    }

    // Önceki seçimleri geri yükle (eğer hala mevcutsa)
    if (Array.from(instructorSelect.options).some(opt => opt.value === oldInstructor))
        instructorSelect.value = oldInstructor;
    if (Array.from(tagSelect.options).some(opt => opt.value === oldTag))
        tagSelect.value = oldTag;
    if (Array.from(dateSelect.options).some(opt => opt.value === oldDate))
        dateSelect.value = oldDate;
}

/**
 * 🔍 GÖREV 2: Seçtiğin filtrelere göre eşleşen videoları bulur (dil desteği eklendi)
 */
export function getFilteredVideos(videolar, filtreler, currentLang) {
    const { aramaMetni, rol, egitmen, etiket, tarih, ortam } = filtreler;

    return videolar.filter(video => {
        if (aramaMetni) {
            const aranacakKelime = aramaMetni.toLowerCase().trim();
            const egitmenUyuyor = video.instructor_name?.toLowerCase().includes(aranacakKelime);
            const etiketUyuyor = video.tags?.toLowerCase().includes(aranacakKelime);
            const partnerUyuyor = video.partner_name?.toLowerCase().includes(aranacakKelime);
            if (!egitmenUyuyor && !etiketUyuyor && !partnerUyuyor) return false;
        }

        if (rol !== 'all' && video.role_type !== rol) return false;
        if (egitmen !== 'all' && video.instructor_name !== egitmen) return false;
        if (etiket !== 'all') {
            if (!video.tags) return false;
            const videoEtiketleri = video.tags.split(',').map(t => t.trim());
            if (!videoEtiketleri.includes(etiket)) return false;
        }
        if (tarih !== 'all' && formatAyYil(video.created_at, currentLang) !== tarih) return false;
        if (ortam !== 'all') {
            if (ortam === 'drive' && !video.is_downloaded) return false;
            if (ortam === 'social' && video.is_downloaded) return false;
        }
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