import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export async function dbFetchInstructors() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Eğitmenler veritabanından çekilemedi");
    return await response.json();
}

export async function dbFetchVideos() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Videolar veritabanından çekilemedi");
    return await response.json();
}

export async function dbSaveTags(videoId, cleanTags) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags: cleanTags || null })
    });
    if (!response.ok) throw new Error("Etiket güncellenemedi");
    return response;
}

export async function dbDeleteVideo(videoId) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Video silinemedi");
    return response;
}

export async function dbSaveInstructor(id, name) {
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/instructors`;
    const response = await fetch(url, {
        method: method,
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ name })
    });
    if (!response.ok) throw new Error("Eğitmen veritabanına kaydedilemedi");
    return response;
}

export async function dbDeleteInstructor(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Eğitmen silme işlemi başarısız");
    return response;
}

export async function dbSaveVideo(id, payload) {
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `${SUPABASE_URL}/rest/v1/videos?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/videos`;
    const response = await fetch(url, {
        method: method,
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Video veritabanına yazılamadı");
    return response;
}

export async function dbUpdateTagsDirectly(videoId, cleanTags) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tags: cleanTags || null })
    });
    if (!response.ok) throw new Error("Etiket güncellenemedi");
    return response;
}

export async function dbFetchFavorites() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites?select=video_id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Favoriler veritabanından çekilemedi");
    return await response.json();
}

export async function dbAddFavorite(videoId) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json', 'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ video_id: videoId })
    });
    if (!response.ok) throw new Error("Favori veritabanına eklenemedi");
    return response;
}

export async function dbRemoveFavorite(videoId) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites?video_id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Favori veritabanından silinemedi");
    return response;
}

export async function dbClearAllFavorites() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/favorites?video_id=gt.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Favori listesi temizlenemedi");
    return response;
}

// Not güncelleme fonksiyonu (2. adım)
export async function dbUpdateNote(videoId, note) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes: note || null })
    });
    if (!response.ok) throw new Error("Not kaydedilemedi");
    return response;
}