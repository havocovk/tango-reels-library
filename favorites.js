// favorites.js
import { translations } from './config.js';

export function getFavorites() {
    const favs = localStorage.getItem('atkk_favorites');
    return favs ? JSON.parse(favs) : [];
}

export function toggleFavorite(videoId, currentLang, callback) {
    let favs = getFavorites();
    if (favs.includes(videoId)) {
        favs = favs.filter(id => id !== videoId);
    } else {
        favs.push(videoId);
    }
    localStorage.setItem('atkk_favorites', JSON.stringify(favs));
    if (callback) callback(); 
}

export function clearAllFavorites(currentLang, callback) {
    const lang = translations[currentLang];
    if (confirm(lang.confirmClearFavs)) {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        if (callback) callback();
    }
}