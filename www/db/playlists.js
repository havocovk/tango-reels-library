// db/playlists.js - Playlist ile ilgili tüm veritabanı işlemleri
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
};
const JSON_HEADERS = {
    ...HEADERS,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// Tüm playlist'leri çek (oluşturulma tarihine göre sıralı)
export async function dbFetchPlaylists() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlists?select=*&order=created_at.asc`,
        { headers: HEADERS }
    );
    if (!res.ok) throw new Error('Playlist\'ler alınamadı');
    return await res.json();
}

// Yeni playlist oluştur
export async function dbCreatePlaylist(name, color = '#ff007f') {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlists`,
        {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ name, color })
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Playlist oluşturulamadı: ${err}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
}

// Playlist adını veya rengini güncelle
export async function dbUpdatePlaylist(id, name, color) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlists?id=eq.${id}`,
        {
            method: 'PATCH',
            headers: JSON_HEADERS,
            body: JSON.stringify({ name, color })
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Playlist güncellenemedi: ${err}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
}

// Playlist'i sil (playlist_videos cascade ile otomatik silinir)
export async function dbDeletePlaylist(id) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlists?id=eq.${id}`,
        { method: 'DELETE', headers: HEADERS }
    );
    if (!res.ok) throw new Error('Playlist silinemedi');
    return res;
}

// Bir playlist'teki tüm video ID'lerini çek
export async function dbFetchPlaylistVideoIds(playlistId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlist_videos?playlist_id=eq.${playlistId}&select=video_id`,
        { headers: HEADERS }
    );
    if (!res.ok) throw new Error('Playlist videoları alınamadı');
    const rows = await res.json();
    return rows.map(r => r.video_id);
}

// Playlist'e video ekle
export async function dbAddVideoToPlaylist(playlistId, videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlist_videos`,
        {
            method: 'POST',
            headers: { ...HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ playlist_id: playlistId, video_id: videoId })
        }
    );
    // 409 Conflict = zaten eklendi, sessizce geç
    if (!res.ok && res.status !== 409) {
        const err = await res.text();
        throw new Error(`Video playlist'e eklenemedi: ${err}`);
    }
    return res;
}

// Playlist'ten video çıkar
export async function dbRemoveVideoFromPlaylist(playlistId, videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/playlist_videos?playlist_id=eq.${playlistId}&video_id=eq.${videoId}`,
        { method: 'DELETE', headers: HEADERS }
    );
    if (!res.ok) throw new Error('Video playlist\'ten çıkarılamadı');
    return res;
}