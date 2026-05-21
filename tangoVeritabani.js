import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// 1. Postacı: Sadece internete gidip eğitmen listesini ham paket olarak getirir
export async function dbFetchInstructors() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Eğitmenler veritabanından çekilemedi");
    return await response.json();
}

// 2. Postacı: Sadece internete gidip video listesini ham paket olarak getirir
export async function dbFetchVideos() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Videolar veritabanından çekilemedi");
    return await response.json();
}

// 3. Postacı: Pop-up içinden yapılan anlık etiket güncellemelerini kaydeder (PATCH)
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

// 4. Postacı: Videoyu kütüphaneden tamamen siler (DELETE)
export async function dbDeleteVideo(videoId) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Video silinemedi");
    return response;
}

// 5. Postacı: Yeni eğitmen ekler (POST) veya var olan eğitmeni günceller (PATCH)
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

// 6. Postacı: Eğitmeni ve ona bağlı videoları siler (DELETE)
export async function dbDeleteInstructor(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Eğitmen silme işlemi başarısız");
    return response;
}

// 7. Postacı: Yeni video kaydeder (POST) veya var olan videoyu günceller (PATCH)
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