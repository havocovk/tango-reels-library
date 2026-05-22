/**
 * 💃 ARJANTİN TANGO KOMBİNASYON KÜTÜPHANESİ - AKILLI FİLTRE MOTORU
 * Bu dosya kütüphanedeki videoları eğitmen, etiket, tarih ve role göre süzer.
 */

// 📅 Yardımcı Fonksiyon: Veritabanındaki karmaşık tarihleri "Mayıs 2026" formatına çevirir.
function formatAyYil(tarihString) {
    if (!tarihString) return 'Bilinmeyen Tarih';
    const tarih = new Date(tarihString);
    return tarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

/**
 * 🧺 GÖREV 1: HTML sayfasındaki Açılır Kutuları (Dropdown) Veritabanındaki Gerçek Verilerle Doldurur
 */
export function populateFilterDropdowns(videolar) {
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');

    if (!instructorSelect || !tagSelect || !dateSelect) return;

    instructorSelect.innerHTML = '<option value="all">Tüm Eğitmenler</option>';
    tagSelect.innerHTML = '<option value="all">Tüm Etiketler</option>';
    dateSelect.innerHTML = '<option value="all">Tüm Tarihler</option>';

    const egitmenlerTorbasi = new Set();
    const etiketlerTorbasi = new Set();
    const tarihlerTorbasi = new Set();

    videolar.forEach(video => {
        if (video.instructor_name) egitmenlerTorbasi.add(video.instructor_name.trim());

        if (video.tags) {
            video.tags.split(',').forEach(tag => {
                const temizTag = tag.trim();
                if (temizTag) etiketlerTorbasi.add(temizTag);
            });
        }

        if (video.created_at) {
            tarihlerTorbasi.add(formatAyYil(video.created_at));
        }
    });

    Array.from(egitmenlerTorbasi).sort().forEach(egitmen => {
        const option = document.createElement('option');
        option.value = egitmen;
        option.textContent = egitmen;
        instructorSelect.appendChild(option);
    });

    Array.from(etiketlerTorbasi).sort().forEach(etiket => {
        const option = document.createElement('option');
        option.value = etiket;
        option.textContent = `#${etiket}`;
        tagSelect.appendChild(option);
    });

    Array.from(tarihlerTorbasi).forEach(tarih => {
        const option = document.createElement('option');
        option.value = tarih;
        option.textContent = tarih;
        dateSelect.appendChild(option);
    });
}

/**
 * 🔍 GÖREV 2: Seçilen tüm filtrelere göre videoları süzgeçten geçirir
 */
export function getFilteredVideos(videolar, secilenFiltreler) {
    const { aramaMetni, rol, egitmen, etiket, tarih, ortam } = secilenFiltreler;

    return videolar.filter(video => {
        
        // 1. Arama Çubuğu Kontrolü (Değişken isimleri birleştirildi)
        if (aramaMetni) {
            const aranacakKelime = aramaMetni.toLowerCase();
            const egitmenVarMi = video.instructor_name?.toLowerCase().includes(aranacakKelime);
            const partnerVarMi = video.partner_name?.toLowerCase().includes(aranacakKelime);
            const etiketVarMi = video.tags?.toLowerCase().includes(aranacakKelime);
            
            if (!egitmenVarMi && !partnerVarMi && !etiketVarMi) return false;
        }

        // 2. Rol Tipi Filtresi (video.role alanı video.role_type olarak düzeltildi)
        if (rol !== 'all' && video.role_type !== rol) return false;

        // 3. Eğitmen Filtresi
        if (egitmen !== 'all' && video.instructor_name !== egitmen) return false;

        // 4. Etiket Filtresi
        if (etiket !== 'all') {
            if (!video.tags) return false;
            const videoEtiketleri = video.tags.split(',').map(t => t.trim());
            if (!videoEtiketleri.includes(etiket)) return false;
        }

        // 5. Zaman Filtresi
        if (tarih !== 'all' && formatAyYil(video.created_at) !== tarih) return false;

        // 6. Ortam Filtresi
        if (ortam !== 'all') {
            if (ortam === 'drive' && !video.is_downloaded) return false; 
            if (ortam === 'social' && video.is_downloaded) return false; 
        }

        return true;
    });
}

/**
 * Otomatik tamamlama havuzu için yardımcı fonksiyon
 */
export function getAllUniqueTagsPool(videolar) {
    const havuz = new Set();
    videolar.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const temiz = t.trim();
                if (temiz) havuz.add(temiz);
            });
        }
    });
    return Array.from(havuz);
}