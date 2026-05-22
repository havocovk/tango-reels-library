// Arama ve Filtreleme Mantığını Yöneten Algoritma
export function getFilteredVideos(globalVideos, currentView, favs) {
    const searchInput = document.getElementById('search-input');
    const roleSelect = document.getElementById('filter-role-select');
    const locationSelect = document.getElementById('filter-location-select');

    // DOM elementleri henüz yüklenmediyse veya bulunamadıysa güvenli varsayılan değerler
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const roleVal = roleSelect ? roleSelect.value : 'all';
    const locationVal = locationSelect ? locationSelect.value : 'all';

    return globalVideos.filter(video => {
        // Eğer Pratik Listem (Favorites) görünümündeysek, sadece yıldızlananları filtrele
        if (currentView === 'favorites' && !favs.includes(video.id)) {
            return false;
        }

        const insName = video.instructors ? video.instructors.name.toLowerCase() : '';
        const partnerName = video.partner_name ? video.partner_name.toLowerCase() : '';
        const videoTags = video.tags ? video.tags.toLowerCase() : '';
        
        // Arama terimi eğitmen, partner veya etiketlerde geçiyor mu?
        const matchesSearch = insName.includes(searchVal) || partnerName.includes(searchVal) || videoTags.includes(searchVal);
        
        // Rol filtresi eşleşiyor mu?
        const matchesRole = (roleVal === 'all') || (video.role_type === roleVal);
        
        // Ortam (Google Drive / Sosyal Medya) filtresi eşleşiyor mu?
        let matchesLocation = true;
        if (locationVal === 'drive') {
            matchesLocation = (video.is_downloaded === true);
        } else if (locationVal === 'social') {
            matchesLocation = (video.is_downloaded === false || !video.is_downloaded);
        }

        return matchesSearch && matchesRole && matchesLocation;
    });
}

// Videolardaki tüm benzersiz etiketleri tarayarak Autocomplete havuzu oluşturur
export function getAllUniqueTagsPool(globalVideos) {
    let pool = new Set();
    globalVideos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean) pool.add(clean);
            });
        }
    });
    return Array.from(pool);
}