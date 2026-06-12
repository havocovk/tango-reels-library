// db/videos.js - Video ile ilgili tüm veritabanı işlemleri
// ✅ GÜNCELLEME (Adım 4.1): dbSaveVideo payload'ına duration alanı eklendi
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// ─────────────────────────────────────────────────────────────
// Tüm videoları tek seferde çek
// ─────────────────────────────────────────────────────────────
export async function dbFetchVideos() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error("Videolar alınamadı");
    return await res.json();
}

// ─────────────────────────────────────────────────────────────
// Sayfa sayfa video çekme (server-side pagination)
// ─────────────────────────────────────────────────────────────
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
                'Prefer': 'count=exact'
            }
        }
    );

    if (!res.ok && res.status !== 206) {
        throw new Error('Videolar alınamadı (sayfalı)');
    }

    const videos = await res.json();
    const contentRange = res.headers.get('Content-Range') || '';
    let totalCount = videos.length;
    const match = contentRange.match(/\/(\d+)\s*$/);
    if (match) totalCount = parseInt(match[1], 10);

    return { videos, totalCount };
}

// ─────────────────────────────────────────────────────────────
// Sadece toplam video sayısını döndürür (HEAD isteği)
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Video sil
// ─────────────────────────────────────────────────────────────
export async function dbDeleteVideo(videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`,
        {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }
    );
    if (!res.ok) throw new Error("Video silinemedi");
    return res;
}

// ─────────────────────────────────────────────────────────────
// Video kaydet veya güncelle
// ✅ GÜNCELLEME (Adım 4.1): duration alanı payload'a eklendi
// ─────────────────────────────────────────────────────────────
export async function dbSaveVideo(id, payload, old_updated_at = null) {
    let fixedPayload = { ...payload };

    // Drive video için URL placeholder oluştur
    if (fixedPayload.is_downloaded === true && (!fixedPayload.url || fixedPayload.url === '' || fixedPayload.url.startsWith('drive_temp'))) {
        const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        fixedPayload.url = `drive_video_${uniqueSuffix}`;
    }

    // duration alanı yoksa (eski kayıtlar için) undefined bırakma, null yap
    if (fixedPayload.duration === undefined) {
        delete fixedPayload.duration; // Supabase'e gönderme, mevcut değeri koru
    }

    if (id) {
        // ── GÜNCELLEME ──
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

        return updatedVideo;

    } else {
        // ── YENİ KAYIT ──
        const res = await fetchWithRetry(
            `${SUPABASE_URL}/rest/v1/videos`,
            {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(fixedPayload)
            }
        );

        if (!res.ok) throw new Error("Video eklenemedi");
        const json = await res.json();
        return Array.isArray(json) ? json[0] : json;
    }
}

// ─────────────────────────────────────────────────────────────
// Etiketleri doğrudan güncelle (çakışma korumalı)
// ─────────────────────────────────────────────────────────────
export async function dbUpdateTagsDirectly(videoId, cleanTags, old_updated_at) {
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

    return updatedVideo;
}

// ─────────────────────────────────────────────────────────────
// Notu güncelle
// ─────────────────────────────────────────────────────────────
export async function dbUpdateNote(videoId, newNote, old_updated_at) {
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
        body: JSON.stringify({ notes: newNote || null })
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

    return updatedVideo;
}

// ─────────────────────────────────────────────────────────────
// Öğrenme durumunu güncelle
// ─────────────────────────────────────────────────────────────
export async function dbUpdateLearningStatus(videoId, newStatus, reviewCount, old_updated_at, reviewCountDelta = 1) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }

    const now = new Date().toISOString();
    const res = await fetchWithRetry(url, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            learning_status: newStatus,
            last_reviewed_at: now,
            review_count: (reviewCount || 0) + reviewCountDelta
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

    return updatedVideo;
}