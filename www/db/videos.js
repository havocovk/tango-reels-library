// db/videos.js - Video ile ilgili tüm veritabanı işlemleri (öğrenme durumu eklendi)
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

export async function dbFetchVideos() {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Videolar alınamadı");
    return await res.json();
}

export async function dbDeleteVideo(videoId) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Video silinemedi");
    return res;
}

export async function dbSaveVideo(id, payload, old_updated_at = null) {
    let fixedPayload = { ...payload };
    
    if (fixedPayload.is_downloaded === true && (!fixedPayload.url || fixedPayload.url === '' || fixedPayload.url.startsWith('drive_temp'))) {
        const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        fixedPayload.url = `drive_video_${uniqueSuffix}`;
    }

    if (id) {
        let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`;
        if (old_updated_at) {
            url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
        }
        const res = await fetchWithRetry(url, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(fixedPayload)
        });
        
        const responseText = await res.text();
        let affectedRows = 0;
        let updatedVideo = null;
        try {
            const json = JSON.parse(responseText);
            if (Array.isArray(json)) {
                affectedRows = json.length;
                if (json.length > 0) updatedVideo = json[0];
            }
        } catch(e) {}
        
        if (affectedRows === 0) {
            throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
        }
        if (!res.ok) {
            throw new Error(`Veritabanı hatası (${res.status}): ${responseText}`);
        }
        return updatedVideo;
    }

    // Yeni ekleme
    const checkRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos?url=eq.${encodeURIComponent(fixedPayload.url)}&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!checkRes.ok) {
        let errorText = await checkRes.text();
        throw new Error(`Kontrol hatası: ${errorText}`);
    }
    const existing = await checkRes.json();
    
    if (existing && existing.length > 0) {
        const existingId = existing[0].id;
        const updateRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos?id=eq.${existingId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(fixedPayload)
        });
        if (!updateRes.ok) {
            let errorText = await updateRes.text();
            throw new Error(`Güncelleme hatası (${updateRes.status}): ${errorText}`);
        }
        const responseText = await updateRes.text();
        let updatedVideo = null;
        try {
            const json = JSON.parse(responseText);
            if (Array.isArray(json) && json.length > 0) updatedVideo = json[0];
        } catch(e) {}
        return updatedVideo;
    } else {
        const insertRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(fixedPayload)
        });
        if (!insertRes.ok) {
            let errorText = await insertRes.text();
            throw new Error(`Ekleme hatası (${insertRes.status}): ${errorText}`);
        }
        const responseText = await insertRes.text();
        let newVideo = null;
        try {
            const json = JSON.parse(responseText);
            if (Array.isArray(json) && json.length > 0) newVideo = json[0];
        } catch(e) {}
        return newVideo;
    }
}

export async function dbUpdateTagsDirectly(videoId, cleanTags, old_updated_at = null) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }
    const res = await fetchWithRetry(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ tags: cleanTags || null })
    });
    const responseText = await res.text();
    let affectedRows = 0;
    let updatedVideo = null;
    try {
        const json = JSON.parse(responseText);
        if (Array.isArray(json)) {
            affectedRows = json.length;
            if (json.length > 0) updatedVideo = json[0];
        }
    } catch(e) {}
    if (affectedRows === 0) {
        throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
    }
    if (!res.ok) {
        throw new Error(`Etiket güncellenemedi: ${responseText}`);
    }
    return updatedVideo;
}

export async function dbUpdateNote(videoId, note, old_updated_at = null) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }
    const res = await fetchWithRetry(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ notes: note || null })
    });
    const responseText = await res.text();
    let affectedRows = 0;
    let updatedVideo = null;
    try {
        const json = JSON.parse(responseText);
        if (Array.isArray(json)) {
            affectedRows = json.length;
            if (json.length > 0) updatedVideo = json[0];
        }
    } catch(e) {}
    if (affectedRows === 0) {
        throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
    }
    if (!res.ok) {
        throw new Error(`Not kaydedilemedi: ${responseText}`);
    }
    return updatedVideo;
}

// 🔥 YENİ: Öğrenme durumu güncelleme
export async function dbUpdateLearningStatus(videoId, status, old_updated_at = null) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }
    const now = new Date().toISOString();
    // review_count'u artır sadece 'learning' ve 'mastered' durumlarında (isteğe bağlı)
    const res = await fetchWithRetry(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            learning_status: status,
            last_reviewed_at: now,
            review_count: status === 'mastered' ? 0 : 1 // basit mantık, isterseniz review_count artırma
        })
    });
    const responseText = await res.text();
    let affectedRows = 0;
    let updatedVideo = null;
    try {
        const json = JSON.parse(responseText);
        if (Array.isArray(json)) {
            affectedRows = json.length;
            if (json.length > 0) updatedVideo = json[0];
        }
    } catch(e) {}
    if (affectedRows === 0) {
        throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
    }
    if (!res.ok) {
        throw new Error(`Öğrenme durumu güncellenemedi: ${responseText}`);
    }
    return updatedVideo;
}