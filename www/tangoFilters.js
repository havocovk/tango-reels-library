// tangoFilters.js - Filtreleme (öğrenme durumu eklendi)
import { translations } from './i18n.js';

function formatAyYil(tarihString, lang) {
    if (!tarihString) return lang === 'tr' ? 'Bilinmeyen Tarih' : 'Unknown Date';
    const tarih = new Date(tarihString);
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    return tarih.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function populateFilterDropdowns(videolar, currentLang) {
    const lang = translations[currentLang];
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');
    const platformSelect = document.getElementById('filter-platform-select');
    const learningStatusSelect = document.getElementById('filter-learning-status-select');

    if (!instructorSelect || !tagSelect || !dateSelect) return;

    const oldInstructor = instructorSelect.value;
    const oldTag = tagSelect.value;
    const oldDate = dateSelect.value;
    const oldPlatform = platformSelect ? platformSelect.value : 'all';
    const oldLearningStatus = learningStatusSelect ? learningStatusSelect.value : 'all';

    instructorSelect.innerHTML = `<option value="all">${lang.allInstructors}</option>`;
    tagSelect.innerHTML = `<option value="all">${lang.allTags}</option>`;
    dateSelect.innerHTML = `<option value="all">${lang.allDates}</option>`;
    if (learningStatusSelect) {
        learningStatusSelect.innerHTML = `<option value="all">${lang.allLearningStatuses || 'Tümü'}</option>`;
        learningStatusSelect.innerHTML += `<option value="new">🆕 ${lang.learningNew || 'Yeni'}</option>`;
        learningStatusSelect.innerHTML += `<option value="learning">📚 ${lang.learningActive || 'Çalışıyorum'}</option>`;
        learningStatusSelect.innerHTML += `<option value="mastered">✅ ${lang.learningMastered || 'Ustalaştım'}</option>`;
    }

    const instructorCountMap = new Map();
    videolar.forEach(video => {
        if (video.instructor_name) {
            const name = video.instructor_name.trim();
            instructorCountMap.set(name, (instructorCountMap.get(name) || 0) + 1);
        }
    });
    const sortedInstructors = Array.from(instructorCountMap.keys()).sort();
    sortedInstructors.forEach(egitmenAdi => {
        const count = instructorCountMap.get(egitmenAdi);
        const opt = document.createElement('option');
        opt.value = egitmenAdi;
        opt.innerText = `${egitmenAdi} (${count})`;
        instructorSelect.appendChild(opt);
    });

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

    if (platformSelect) {
        const platformCounts = {
            drive: videolar.filter(v => v.platform === 'drive').length,
            youtube: videolar.filter(v => v.platform === 'youtube').length,
            instagram: videolar.filter(v => v.platform === 'instagram').length,
            facebook: videolar.filter(v => v.platform === 'facebook').length
        };
        const optDrive = platformSelect.querySelector('option[value="drive"]');
        const optYoutube = platformSelect.querySelector('option[value="youtube"]');
        const optInstagram = platformSelect.querySelector('option[value="instagram"]');
        const optFacebook = platformSelect.querySelector('option[value="facebook"]');
        if (optDrive) optDrive.innerText = `${lang.platformLabels.drive} (${platformCounts.drive})`;
        if (optYoutube) optYoutube.innerText = `${lang.platformLabels.youtube} (${platformCounts.youtube})`;
        if (optInstagram) optInstagram.innerText = `${lang.platformLabels.instagram} (${platformCounts.instagram})`;
        if (optFacebook) optFacebook.innerText = `${lang.platformLabels.facebook} (${platformCounts.facebook})`;
    }

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

export function getFilteredVideos(videolar, filtreler, currentLang) {
    const { aramaMetni, rol, egitmen, etiket, tarih, platform, learningStatus } = filtreler;
    return videolar.filter(video => {
        if (aramaMetni) {
            const aranacakKelime = aramaMetni.toLowerCase().trim();
            const egitmenUyuyor = video.instructor_name?.toLowerCase().includes(aranacakKelime) || false;
            const partnerUyuyor = video.partner_name?.toLowerCase().includes(aranacakKelime) || false;
            const etiketUyuyor = video.tags?.toLowerCase().includes(aranacakKelime) || false;
            let platformUyuyor = false;
            if (video.platform) {
                const platformLabel = (currentLang === 'tr' 
                    ? { drive: 'drive', youtube: 'youtube', instagram: 'instagram', facebook: 'facebook', other: 'diğer' }[video.platform]
                    : video.platform);
                platformUyuyor = platformLabel?.toLowerCase().includes(aranacakKelime) || false;
            }
            const notlarUyuyor = video.notes?.toLowerCase().includes(aranacakKelime) || false;
            if (!egitmenUyuyor && !partnerUyuyor && !etiketUyuyor && !platformUyuyor && !notlarUyuyor) return false;
        }
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