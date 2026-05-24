/**
 * 💃 ARJANTİN TANGO KOMBİNASYON KÜTÜPHANESİ - AKILLI FİLTRE MOTORU
 * Bu dosya kütüphanedeki videoları süzmeye yarar ve açılır kutuları doldurur.
 */

function formatAyYil(tarihString) {
    if (!tarihString) return 'Bilinmeyen Tarih';
    const tarih = new Date(tarihString);
    return tarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export function populateFilterDropdowns(videolar) {
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');

    if (!instructorSelect || !tagSelect || !dateSelect) return;

    const oldInstructor = instructorSelect.value;
    const oldTag = tagSelect.value;
    const oldDate = dateSelect.value;

    instructorSelect.innerHTML = '<option value="all">Tüm Eğitmenler</option>';
    tagSelect.innerHTML = '<option value="all">Tüm Etiketler</option>';
    dateSelect.innerHTML = '<option value="all">Tüm Tarihler</option>';

    const egitmenlerTorba = new Set();
    videolar.forEach(video => {
        if (video.instructor_name) {
            egitmenlerTorba.add(video.instructor_name.trim());
        }
    });

    Array.from(egitmenlerTorba).sort().forEach(egitmenAdi => {
        const opt = document.createElement('option');
        opt.value = egitmenAdi;
        opt.innerText = egitmenAdi;
        instructorSelect.appendChild(opt);
    });

    const etiketlerTorba = new Set();
    videolar.forEach(video => {
        if (video.tags) {
            video.tags.split(',').forEach(tag => {
                const t = tag.trim();
                if (t) etiketlerTorba.add(t);
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
            tarihlerTorba.add(formatAyYil(video.created_at));
        }
    });

    Array.from(tarihlerTorba).forEach(tarihMetni => {
        const opt = document.createElement('option');
        opt.value = tarihMetni;
        opt.innerText = tarihMetni;
        dateSelect.appendChild(opt);
    });

    if (Array.from(egitmenlerTorba).includes(oldInstructor)) instructorSelect.value = oldInstructor;
    if (Array.from(etiketlerTorba).includes(oldTag)) tagSelect.value = oldTag;
    if (Array.from(tarihlerTorba).includes(oldDate)) dateSelect.value = oldDate;
}

export function getFilteredVideos(videolar, filtreler) {
    const { query, rol, egitmen, etiket, tarih, ortam } = filtreler;
    const temizQuery = query ? query.toLowerCase().trim() : '';

    return videolar.filter(video => {
        if (temizQuery) {
            const egitmenUyuyor = video.instructor_name?.toLowerCase().includes(temizQuery);
            const etiketUyuyor = video.tags?.toLowerCase().includes(temizQuery);
            const partnerUyuyor = video.partner_name?.toLowerCase().includes(temizQuery);
            if (!egitmenUyuyor && !etiketUyuyor && !partnerUyuyor) return false;
        }

        if (rol !== 'all' && video.role_type !== rol) return false;
        if (egitmen !== 'all' && video.instructor_name !== egitmen) return false;

        if (etiket !== 'all') {
            if (!video.tags) return false;
            const videoEtiketleri = video.tags.split(',').map(t => t.trim());
            if (!videoEtiketleri.includes(etiket)) return false;
        }

        if (tarih !== 'all' && formatAyYil(video.created_at) !== tarih) return false;

        if (ortam !== 'all') {
            if (ortam === 'drive' && !video.is_downloaded) return false;
            if (ortam === 'social' && video.is_downloaded) return false;
        }

        return true;
    });
}

export function getAllUniqueTagsPool(videolar) {
    const havuz = new Set();
    videolar.forEach(video => {
        if (video.tags) {
            video.tags.split(',').forEach(t => {
                const temiz = t.trim();
                if (temiz) havuz.add(temiz);
            });
        }
    });
    return Array.from(havuz).sort();
}