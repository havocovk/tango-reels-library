// db/favorites.js - Favori ile ilgili tüm veritabanı işlemleri
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

export async function dbFetchFavorites() {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/favorites?select=video_id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Favoriler alınamadı");
    return await res.json();
}

export async function dbAddFavorite(videoId) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/favorites`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ video_id: videoId })
    });
    if (!res.ok) throw new Error("Favori eklenemedi");
    return res;
}

export async function dbRemoveFavorite(videoId) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/favorites?video_id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Favori silinemedi");
    return res;
}

export async function dbClearAllFavorites() {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/favorites?video_id=gt.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Favoriler temizlenemedi");
    return res;
}
