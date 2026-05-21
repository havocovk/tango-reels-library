// favorites.js
import { translations } from './config.js';
import { AppState } from './state.js';

export function getFavorites() {
    const favs = localStorage.getItem('atkk_favorites');
    return favs ? JSON.parse(favs) : [];
}

export function toggleFavorite(videoId, onComplete) {
    let favs = getFavorites();
    if (favs.includes(videoId)) {
        favs = favs.filter(id => id !== videoId);
    } else {
        favs.push(videoId);
    }
    localStorage.setItem('atkk_favorites', JSON.stringify(favs));
    if (onComplete) onComplete();
}

export function clearAllFavorites(onComplete) {
    const lang = translations[AppState.currentLang];
    if (confirm(lang.confirmClearFavs)) {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        if (onComplete) onComplete();
    }
}