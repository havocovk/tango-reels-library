// favorites.js
import { translations } from './config.js';
import { AppState } from './state.js';

export function getFavorites() {
    const favs = localStorage.getItem('atkk_favorites');
    return favs ? JSON.parse(favs) : [];
}

export function toggleFavorite(videoId) {
    let favs = getFavorites();
    if (favs.includes(videoId)) favs = favs.filter(id => id !== videoId);
    else favs.push(videoId);
    localStorage.setItem('atkk_favorites', JSON.stringify(favs));
}

export function clearAllFavorites(onSuccess) {
    if (confirm(translations[AppState.currentLang].confirmClearFavs)) {
        localStorage.setItem('atkk_favorites', JSON.stringify([]));
        if (onSuccess) onSuccess();
    }
}