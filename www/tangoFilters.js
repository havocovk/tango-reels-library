// tangoFilters.js
// ✅ GÜNCELLEME (Adım 3.1): Fuse.js bulanık arama entegrasyonu
import { translations } from './i18n.js';

// ─────────────────────────────────────────────────────────────
// FUSE.JS INDEX YÖNETİMİ
// fuseInstance: Fuse araması yapan motor
// lastFuseSourceRef: "Bu index hangi video listesi için kuruldu?"
// Video listesi değiştiğinde index otomatik yeniden kurulur.
// ─────────────────────────────────────────────────────────────
let fuseInstance = null;
let lastFuseSourceRef = null;

function buildFuseIndex(videolar) {
    // window.Fuse: index.html'de CDN ile yüklenen kütüphane
    if (!window.Fuse) return;

    fuseInstance = new window.Fuse(videolar, {
        // Hangi alanlarda arama yapılsın ve her biri ne kadar ağırlıklı olsun?
        keys: [
            { name: 'instructor_name', weight: 0.4 }, // Eğitmen adı en önemli
            { name: 'tags',            weight: 0.3 }, // Etiketler ikinci önemli
            { name: 'partner_name',    weight: 0.2 }, // Partner adı üçüncü
            { name: 'notes',           weight: 0.1 }  // Notlar son
        ],
        threshold: 0.35,        // 0 = sadece tam eşleşme, 1 = her şeye eşleş
                                // 0.35 = "makul" tolerans: giro ↔ giroo geçer
                                //        ama tamamen alakasız kelimeler geçmez
        includeScore: false,    // Puan bilgisi döndürmeye gerek yok
        minMatchCharLength: 2,  // 1 karakter girişinde aramayı tetikleme
        ignoreLocation: true    // Kelimenin metindeki konumu arama sonucunu etkilemesin
    });

    // Hangi liste için index kurulduğunu hatırlıyoruz
    lastFuseSourceRef = videolar;
}

// ─────────────────────────────────────────────────────────────
// YARDIMCI: Tarihi "Haziran 2025" formatına çevir
// ─────────────────────────────────────────────────────────────
function formatAyYil(tarihString, lang) {
    if (!tarihString) return lang === 'tr' ? 'Bilinmeyen Tarih' : 'Unknown Date';
    const tarih = new Date(tarihString);
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    return tarih.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────
// FİLTRE DROPDOWN'LARINI DOLDUR
// ─────────────────────────────────────────────────────────────
export function populateFilterDropdowns(videolar, currentLang) {
    const lang = translations[currentLang];
    const instructorSelect    = document.getElementById('filter-instructor-select');
    const tagSelect           = document.getElementById('filter-tag-select');
    const dateSelect          = document.getElementById('filter-date-select');
    const platformSelect      = document.getElementById('filter-platform-select');
    const learningStatusSelect = document.getElementById('filter-learning-status-select');

    if (!instructorSelect || !tagSelect || !dateSelect) return;

    // Mevcut seçimleri hatırla (dropdown yeniden dolunca seçim kaybolmasın)
    const oldInstructor    = instructorSelect.value;
    const oldTag           = tagSelect.value;
    const oldDate          = dateSelect.value;
    const oldPlatform      = platformSelect ? platformSelect.value : 'all';
    const oldLearningStatus = learningStatusSelect ? learningStatusSelect.value : 'all';

    // Dropdown'ları temizle ve "Tümü" seçeneğini ekle
    instructorSelect.innerHTML = `<option value="all">${lang.allInstructors}</option>`;
    tagSelect.innerHTML        = `<option value="all">${lang.allTags}</option>`;
    dateSelect.innerHTML       = `<option value="all">${lang.allDates}</option>`;

    if (learningStatusSelect) {
        learningStatusSelect.innerHTML  = `<option value="all">${lang.allLearningStatuses || 'Tümü'}</option>`;
        learningStatusSelect.innerHTML += `<option value="new">🆕 ${lang.learningNew || 'Yeni'}</option>`;
        learningStatusSelect.innerHTML += `<option value="learning">📚 ${lang.learningActive || 'Çalışıyorum'}</option>`;
        learningStatusSelect.innerHTML += `<option value="mastered">✅ ${lang.learningMastered || 'Ustalaştım'}</option>`;
    }

    // Eğitmenleri say ve sırala
    const instructorCountMap = new Map();
    videolar.forEach(video => {
        if (video.instructor_name) {
            const name = video.instructor_name.trim();
            instructorCountMap.set(name, (instructorCountMap.get(name) || 0) + 1);
        }
    });
    Array.from(instructorCountMap.keys()).sort().forEach(egitmenAdi => {
        const count = instructorCountMap.get(egitmenAdi);
        const opt = document.createElement('option');
        opt.value = egitmenAdi;
        opt.innerText = `${egitmenAdi} (${count})`;
        instructorSelect.appendChild(opt);
    });

    // Etiketleri topla ve sırala
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

    // Tarihleri topla
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

    // Platform sayılarını güncelle
    if (platformSelect) {
        const platformCounts = {
            drive:     videolar.filter(v => v.platform === 'drive').length,
            youtube:   videolar.filter(v => v.platform === 'youtube').length,
            instagram: videolar.filter(v => v.platform === 'instagram').length,
            facebook:  videolar.filter(v => v.platform === 'facebook').length
        };
        const optDrive     = platformSelect.querySelector('option[value="drive"]');
        const optYoutube   = platformSelect.querySelector('option[value="youtube"]');
        const optInstagram = platformSelect.querySelector('option[value="instagram"]');
        const optFacebook  = platformSelect.querySelector('option[value="facebook"]');
        if (optDrive)     optDrive.innerText     = `${lang.platformLabels.drive} (${platformCounts.drive})`;
        if (optYoutube)   optYoutube.innerText   = `${lang.platformLabels.youtube} (${platformCounts.youtube})`;
        if (optInstagram) optInstagram.innerText = `${lang.platformLabels.instagram} (${platformCounts.instagram})`;
        if (optFacebook)  optFacebook.innerText  = `${lang.platformLabels.facebook} (${platformCounts.facebook})`;
    }

    // Eski seçimleri geri yükle
    if (Array.from(instructorSelect.options).some(opt => opt.value === oldInstructor))
        instructorSelect.value = oldInstructor;
    if (Array.from(tagSelect.options).some(opt => opt.value === oldTag))
        tagSelect.value = oldTag;
    if (Array.from(dateSelect.options).some(opt => opt.value === oldDate))
        dateSelect.value = oldDate;
    if (platformSelect && Array.from(platformSelect.options).some(opt => opt.value === oldPlatform))
        platformSelect.value = oldPlatform;
    if (learningStatusSelect && Array.from(learningStatusSelect.options).some(opt => opt.value === oldLearningStatus))
        learningStatusSelect.value = oldLearningStatus;
}

// ─────────────────────────────────────────────────────────────
// ANA FİLTRELEME FONKSİYONU
// ✅ ADIM 3.1: Arama metni varsa Fuse.js ile bulanık arama yapar.
//             Arama metni yoksa doğrudan dropdown filtrelerine geçer.
// ─────────────────────────────────────────────────────────────
export function getFilteredVideos(videolar, filtreler, currentLang) {
    const { aramaMetni, rol, egitmen, etiket, tarih, platform, learningStatus } = filtreler;

    // Video listesi değiştiyse Fuse indexini yeniden kur.
    // (Yeni video ekleme, silme, playlist geçişi gibi durumlarda liste değişir.)
    if (videolar !== lastFuseSourceRef) {
        buildFuseIndex(videolar);
    }

    // ── 1. ADIM: Arama metniyle aday liste belirle ────────────
    let kandidatlar = videolar; // Varsayılan: tüm videolar adaydır

    if (aramaMetni && aramaMetni.trim().length >= 2) {
        if (fuseInstance && window.Fuse) {
            // ✅ Fuse bulanık arama: [{ item: video, score: ... }, ...] döner
            const fuseResults = fuseInstance.search(aramaMetni.trim());
            kandidatlar = fuseResults.map(r => r.item);
        } else {
            // Fuse CDN henüz yüklenmediyse yedek olarak eski tam eşleşme çalışır
            const aranacakKelime = aramaMetni.toLowerCase().trim();
            kandidatlar = videolar.filter(video => {
                const egitmenUyuyor = video.instructor_name?.toLowerCase().includes(aranacakKelime) || false;
                const partnerUyuyor = video.partner_name?.toLowerCase().includes(aranacakKelime) || false;
                const etiketUyuyor  = video.tags?.toLowerCase().includes(aranacakKelime) || false;
                const notlarUyuyor  = video.notes?.toLowerCase().includes(aranacakKelime) || false;
                return egitmenUyuyor || partnerUyuyor || etiketUyuyor || notlarUyuyor;
            });
        }
    } else if (aramaMetni && aramaMetni.trim().length === 1) {
        // Tek karakter için Fuse yerine basit "içerir" kontrolü (Fuse minMatchCharLength = 2)
        const aranacakKelime = aramaMetni.toLowerCase().trim();
        kandidatlar = videolar.filter(video => {
            const egitmenUyuyor = video.instructor_name?.toLowerCase().includes(aranacakKelime) || false;
            const partnerUyuyor = video.partner_name?.toLowerCase().includes(aranacakKelime) || false;
            const etiketUyuyor  = video.tags?.toLowerCase().includes(aranacakKelime) || false;
            const notlarUyuyor  = video.notes?.toLowerCase().includes(aranacakKelime) || false;
            return egitmenUyuyor || partnerUyuyor || etiketUyuyor || notlarUyuyor;
        });
    }

    // ── 2. ADIM: Dropdown filtrelerini aday liste üzerinde uygula ──
    return kandidatlar.filter(video => {
        if (rol !== 'all' && video.role_type !== rol) return false;
        if (egitmen !== 'all' && video.instructor_name !== egitmen) return false;
        if (etiket !== 'all') {
            if (!video.tags) return false;
            const videoEtiketleri = video.tags.split(',').map(t => t.trim());
            if (!videoEtiketleri.includes(etiket)) return false;
        }
        if (tarih !== 'all') {
            const formatliTarih = formatAyYil(video.created_at, currentLang);
            if (formatliTarih !== tarih) return false;
        }
        if (platform !== 'all' && video.platform !== platform) return false;
        if (learningStatus && learningStatus !== 'all' && video.learning_status !== learningStatus) return false;
        return true;
    });
}

// ─────────────────────────────────────────────────────────────
// ETİKET HAVUZU — Autocomplete için tüm benzersiz etiketler
// ─────────────────────────────────────────────────────────────
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