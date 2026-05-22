/**
 * 💃 ARJANTİN TANGO KOMBİNASYON KÜTÜPHANESİ - AKILLI FİLTRE MOTORU
 * Bu dosya kütüphanedeki videoları eğitmen, etiket, tarih ve role göre süzer.
 */

// 📅 Yardımcı Fonksiyon: Veritabanındaki "2026-05-22T12:00:00" gibi karmaşık tarihleri "Mayıs 2026" formatına çevirir.
function formatAyYil(tarihString) {
    if (!tarihString) return 'Bilinmeyen Tarih';
    const tarih = new Date(tarihString);
    return tarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

/**
 * 🧺 GÖREV 1: HTML sayfasındaki Açılır Kutuları (Dropdown) Veritabanındaki Gerçek Verilerle Doldurur
 * @param {Array} videolar - Veritabanından gelen tüm videoların listesi
 */
export function populateFilterDropdowns(videolar) {
    const instructorSelect = document.getElementById('filter-instructor-select');
    const tagSelect = document.getElementById('filter-tag-select');
    const dateSelect = document.getElementById('filter-date-select');

    // Eğer sayfa tam yüklenmediyse ve bu kutular piyasada yoksa işlemi durdur
    if (!instructorSelect || !tagSelect || !dateSelect) return;

    // Eski verileri temizleyelim (İlk "Tüm ..." seçenekleri hariç)
    instructorSelect.innerHTML = '<option value="all">Tüm Eğitmenler</option>';
    tagSelect.innerHTML = '<option value="all">Tüm Etiketler</option>';
    dateSelect.innerHTML = '<option value="all">Tüm Tarihler</option>';

    // Benzersiz (tekrarsız) listeler oluşturmak için "Set" adı verilen akıllı torbaları kullanıyoruz
    const egitmenlerTorbasi = new Set();
    const etiketlerTorbasi = new Set();
    const tarihlerTorbasi = new Set();

    // Tüm videoları tek tek inceleyip içindeki bilgileri torbalara atıyoruz
    videolar.forEach(video => {
        // 1. Eğitmen adını ekle
        if (video.instructor_name) egitmenlerTorbasi.add(video.instructor_name.trim());

        // 2. Etiketleri ekle (Virgülle ayrılmış metni parçalara bölüyoruz: "Giro, Sacada" -> ["Giro", "Sacada"])
        if (video.tags) {
            video.tags.split(',').forEach(tag => {
                const temizTag = tag.trim();
                if (temizTag) etiketlerTorbasi.add(temizTag);
            });
        }

        // 3. Tarihi ekle ("Mayıs 2026" formatında)
        if (video.created_at) {
            tarihlerTorbasi.add(formatAyYil(video.created_at));
        }
    });

    // --- ŞİMDİ TORBALARDAKİ BİLGİLERİ ALIP ALFABETİK OLARAK KUTULARA DİZELİM ---

    // Eğitmenleri kutuya ekle
    Array.from(egitmenlerTorbasi).sort().forEach(egitmen => {
        const option = document.createElement('option');
        option.value = egitmen;
        option.textContent = egitmen;
        instructorSelect.appendChild(option);
    });

    // Etiketleri kutuya ekle
    Array.from(etiketlerTorbasi).sort().forEach(etiket => {
        const option = document.createElement('option');
        option.value = etiket;
        option.textContent = `#${etiket}`; // Başına şık bir hashtag koyalım
        tagSelect.appendChild(option);
    });

    // Tarihleri kutuya ekle (Tarihleri yeniden eskiye sıralayabiliriz)
    Array.from(tarihlerTorbasi).forEach(tarih => {
        const option = document.createElement('option');
        option.value = tarih;
        option.textContent = tarih;
        dateSelect.appendChild(option);
    });
}

/**
 * 🔍 GÖREV 2: Seçilen tüm filtrelere göre videoları süzgeçten geçirir
 * @param {Array} videolar - Tüm videolar
 * @param {Object} secilenFiltreler - Kullanıcının kutulardan seçtiği filtrelerin listesi
 * @returns {Array} Süzülmüş, ekranda gösterilmeye hazır videolar
 */
export function getFilteredVideos(videolar, secilenFiltreler) {
    const { aramaMetni, rol, egitmen, etiket, tarih, ortam } = secilenFiltreler;

    return videolar.filter(video => {
        
        // 1. Arama Çubuğu Kontrolü (Yazılan kelime Eğitmen, Partner veya Etiketlerde var mı?)
        if (aramaMetni) {
            const aranacakKelime = aramaMetni.toLowerCase();
            const egitmenVar Mi = video.instructor_name?.toLowerCase().includes(aranacakKelime);
            const partnerVar Mi = video.partner_name?.toLowerCase().includes(aranacakKelime);
            const etiketVar Mi = video.tags?.toLowerCase().includes(aranacakKelime);
            
            if (!egitmenVar Mi && !partnerVar Mi && !etiketVar Mi) return false;
        }

        // 2. Rol Tipi Filtresi (Lider / Takipçi / Çift)
        if (rol !== 'all' && video.role !== rol) return false;

        // 3. Eğitmen Filtresi
        if (egitmen !== 'all' && video.instructor_name !== egitmen) return false;

        // 4. Etiket Filtresi
        if (etiket !== 'all') {
            if (!video.tags) return false;
            // Videonun etiketleri arasında tam eşleşme var mı bakıyoruz
            const videoEtiketleri = video.tags.split(',').map(t => t.trim());
            if (!videoEtiketleri.includes(etiket)) return false;
        }

        // 5. Zaman Filtresi (Örn: "Mayıs 2026")
        if (tarih !== 'all' && formatAyYil(video.created_at) !== tarih) return false;

        // 6. Ortam Filtresi (Google Drive mı yoksa Sosyal Medya mı?)
        if (ortam !== 'all') {
            if (ortam === 'drive' && !video.is_downloaded) return false; // Drive seçildiyse indirilenleri getir
            if (ortam === 'social' && video.is_downloaded) return false; // Sosyal medya seçildiyse indirilmeyenleri getir
        }

        // Eğer video tüm bu engelleri başarıyla geçtiyse süzgecin üstünde kalır!
        return true;
    });
}

/**
 * Otomatik tamamlama havuzu için yardımcı fonksiyon (Eski sistemle uyumluluk için)
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