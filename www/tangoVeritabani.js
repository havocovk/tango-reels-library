import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export function detectPlatform(url, isDownloaded) {
    if (isDownloaded) return 'drive';
    if (!url) return 'other';
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
    return 'other';
}

export async function dbFetchInstructors() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Eğitmenler alınamadı");
    return await res.json();
}

export async function dbFetchVideos() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Videolar alınamadı");
    return await res.json();
}

export async function dbDeleteVideo(videoId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Video silinemedi");
    return res;
}

export async function dbSaveInstructor(id, name) {
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/instructors`;
    const res = await fetch(url, {
        method,
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error("Eğitmen kaydedilemedi");
    return res;
}

export async function dbDeleteInstructor(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Eğitmen silinemedi");
    return res;
}

// ⭐⭐⭐ ÇÖZÜM: URL çakışmasında UPSERT (güncelle) yapan fonksiyon
export async function dbSaveVideo(id, payload, old_updated_at = null) {
    let fixedPayload = { ...payload };
    
    if (fixedPayload.is_downloaded === true && (!fixedPayload.url || fixedPayload.url === '' || fixedPayload.url.startsWith('drive_temp'))) {
        const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        fixedPayload.url = `drive_video_${uniqueSuffix}`;
    }

    // Eğer ID verilmişse (düzenleme) -> direkt güncelle
    if (id) {
        let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`;
        if (old_updated_at) {
            url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
        }
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fixedPayload)
        });
        if (!res.ok) {
            let errorText = await res.text();
            if (res.status === 409 || errorText.includes('0 rows')) {
                throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
            }
            throw new Error(`Veritabanı hatası (${res.status}): ${errorText}`);
        }
        return res;
    }

    // YENİ EKLEME: URL kontrolü yap, varsa GÜNCELLE, yoksa EKLE
    // 1) Aynı URL var mı kontrol et
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/videos?url=eq.${encodeURIComponent(fixedPayload.url)}&select=id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!checkRes.ok) {
        let errorText = await checkRes.text();
        throw new Error(`Kontrol hatası: ${errorText}`);
    }
    const existing = await checkRes.json();
    
    if (existing && existing.length > 0) {
        // Aynı URL var -> GÜNCELLE (UPSERT)
        const existingId = existing[0].id;
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${existingId}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fixedPayload)
        });
        if (!updateRes.ok) {
            let errorText = await updateRes.text();
            throw new Error(`Güncelleme hatası (${updateRes.status}): ${errorText}`);
        }
        return updateRes;
    } else {
        // Aynı URL yok -> YENİ EKLE
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(fixedPayload)
        });
        if (!insertRes.ok) {
            let errorText = await insertRes.text();
            throw new Error(`Ekleme hatası (${insertRes.status}): ${errorText}`);
        }
        return insertRes;
    }
}

export async function dbUpdateTagsDirectly(videoId, cleanTags, old_updated_at = null) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: cleanTags || null })
    });
    if (!res.ok) {
        let errorText = await res.text();
        if (res.status === 409 || errorText.includes('0 rows')) {
            throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
        }
        throw new Error(`Etiket güncellenemedi: ${errorText}`);
    }
    return res;
}

export async function dbUpdateNote(videoId, note, old_updated_at = null) {
    let url = `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`;
    if (old_updated_at) {
        url += `&updated_at=eq.${encodeURIComponent(old_updated_at)}`;
    }
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note || null })
    });
    if (!res.ok) {
        let errorText = await res.text();
        if (res.status === 409 || errorText.includes('0 rows')) {
            throw new Error('ÇAKIŞMA: Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.');
        }
        throw new Error(`Not kaydedilemedi: ${errorText}`);
    }
    return res;
}

export async function dbFetchFavorites() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?select=video_id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Favoriler alınamadı");
    return await res.json();
}

export async function dbAddFavorite(videoId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ video_id: videoId })
    });
    if (!res.ok) throw new Error("Favori eklenemedi");
    return res;
}

export async function dbRemoveFavorite(videoId) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?video_id=eq.${videoId}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Favori silinemedi");
    return res;
}

export async function dbClearAllFavorites() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/favorites?video_id=gt.0`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Favoriler temizlenemedi");
    return res;
}

// Toplu etiket işlemleri (isteğe bağlı, daha önceki gibi kalabilir)
async function batchUpdateVideosTag(updates) {
    if (!updates.length) return;
    const promises = updates.map(({ id, newTags }) => {
        return fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
            method: 'PATCH',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: newTags })
        });
    });
    const results = await Promise.all(promises);
    const failed = results.filter(r => !r.ok);
    if (failed.length) throw new Error(`${failed.length} video güncellenemedi`);
}

export async function dbMergeTags(oldTagsArray, newTag) {
    const videos = await dbFetchVideos();
    const updates = [];
    for (const video of videos) {
        if (!video.tags) continue;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        let changed = false;
        for (const old of oldTagsArray) {
            if (tags.includes(old)) {
                tags = tags.filter(t => t !== old);
                if (!tags.includes(newTag)) tags.push(newTag);
                changed = true;
            }
        }
        if (changed) {
            updates.push({ id: video.id, newTags: tags.join(', ') || null });
        }
    }
    await batchUpdateVideosTag(updates);
}

export async function dbDeleteTagFromAllVideos(tagsArray) {
    const videos = await dbFetchVideos();
    const updates = [];
    for (const video of videos) {
        if (!video.tags) continue;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        let changed = false;
        tagsArray.forEach(tag => {
            if (tags.includes(tag)) {
                tags = tags.filter(t => t !== tag);
                changed = true;
            }
        });
        if (changed) {
            updates.push({ id: video.id, newTags: tags.join(', ') || null });
        }
    }
    await batchUpdateVideosTag(updates);
}

export async function dbRenameTag(oldTag, newTag) {
    const videos = await dbFetchVideos();
    const updates = [];
    for (const video of videos) {
        if (!video.tags) continue;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        if (tags.includes(oldTag)) {
            tags = tags.map(t => t === oldTag ? newTag : t);
            updates.push({ id: video.id, newTags: tags.join(', ') });
        }
    }
    await batchUpdateVideosTag(updates);
}

export async function dbCleanupUnusedTags() {
    const videos = await dbFetchVideos();
    const usedTagsSet = new Set();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) usedTagsSet.add(tag);
            });
        }
    });
    let removedCount = 0;
    const updates = [];
    for (const video of videos) {
        if (!video.tags) continue;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        const uniqueTags = [...new Set(tags)];
        if (uniqueTags.length !== tags.length) {
            updates.push({ id: video.id, newTags: uniqueTags.join(', ') });
            removedCount += (tags.length - uniqueTags.length);
        }
    }
    await batchUpdateVideosTag(updates);
    return { removedCount };
}