// db/videos.js - Video ile ilgili tüm veritabanı işlemleri
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

export async function dbFetchVideos() {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Videolar alınamadı");
    return await res.json();
}

// ✅ YENİ (Adım 4.3): Sayfa sayfa video çekme (server-side pagination)
// page: 0'dan başlar, pageSize: bir sayfadaki kayıt sayısı.
// Supabase'in Range header'ı kullanılır. Hem videos dizisini hem de
// toplam kayıt sayısını (totalCount) döner.
export async function dbFetchVideosPage(page = 0, pageSize = 100) {
    const start = page * pageSize;
    const end = start + pageSize - 1;

    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`,
        {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Range-Unit': 'items',
                'Range': `${start}-${end}`,
                // count=exact: Content-Range header'ında toplam kayıt sayısı döner
                'Prefer': 'count=exact'
            }
        }
    );

    // Range kullanılınca Supabase başarıda 200 veya 206 döner; ikisi de OK kabul edilir.
    if (!res.ok && res.status !== 206) {
        throw new Error('Videolar alınamadı (sayfalı)');
    }

    const videos = await res.json();

    // Content-Range örneği: "0-99/247" → toplam 247 kayıt
    const contentRange = res.headers.get('Content-Range') || '';
    let totalCount = videos.length;
    const match = contentRange.match(/\/(\d+)\s*$/);
    if (match) totalCount = parseInt(match[1], 10);

    return { videos, totalCount };
}

// ✅ YENİ (Adım 4.3): Sadece toplam video sayısını döndürür (HEAD isteği).
// Filtresiz toplam sayıyı hızlıca almak için kullanılabilir.
export async function dbFetchVideosCount() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/videos?select=id`,
        {
            method: 'HEAD',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Range-Unit': 'items',
                'Range': '0-0',
                'Prefer': 'count=exact'
            }
        }
    );
    const contentRange = res.headers.get('Content-Range') || '';
    const match = contentRange.match(/\/(\d+)\s*$/);
    return match ? parseInt(match[1], 10) : 0;
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

// ✅ DÜZELTİLDİ: Öğrenme durumu güncelleme
// Değişiklik: review_count artık sabit 0 veya 1 yazmak yerine,
// mevcut değerin üzerine +1 ekliyor. Bu, Adım 2.2'deki
// Spaced Repetition algoritmasının doğru çalışması için kritiktir.
// Parametre olarak currentReviewCount eklendi.
export async function dbUpdateLearningStatus(videoId, status, currentReviewCount = 0, old_updated_at = null) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }
    const now = new Date().toISOString();

    // review_count: her tıklamada mevcut sayının üzerine +1 eklenir.
    // Yol haritasının şartı: "mevcut + 1"
    const newReviewCount = (currentReviewCount || 0) + 1;

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
            review_count: newReviewCount
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