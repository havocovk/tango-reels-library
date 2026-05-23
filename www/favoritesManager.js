// 1. Yerel hafızadaki favori listesini getirir
export function getFavorites() {
    const favs = localStorage.getItem('atkk_favorites');
    return favs ? JSON.parse(favs) : [];
}

// 2. Listede varsa çıkarır, yoksa ekler (Yıldız butonları için)
export function addOrRemoveFavorite(videoId) {
    let favs = getFavorites();
    if (favs.includes(videoId)) {
        favs = favs.filter(id => id !== videoId);
    } else {
        favs.push(videoId);
    }
    localStorage.setItem('atkk_favorites', JSON.stringify(favs));
    return favs;
}

// 3. Videonun kendisi silindiğinde favorilerden de doğrudan temizler
export function removeFavoriteDirectly(videoId) {
    let favs = getFavorites();
    favs = favs.filter(id => id !== videoId);
    localStorage.setItem('atkk_favorites', JSON.stringify(favs));
}

// 4. Tüm haftalık pratik listesini sıfırlar
export function clearAllFavoritesData() {
    localStorage.setItem('atkk_favorites', JSON.stringify([]));
}