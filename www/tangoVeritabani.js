import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Platform algılama
export function detectPlatform(url, isDownloaded) {
    if (isDownloaded) return 'drive';
    if (!url) return 'other';
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
    return 'other';
}

// Mevcut fonksiyonlar (kısaltmak için aynen bırakıyorum, ancak hepsi burada olacak)
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

export async function dbSaveTags(videoId, cleanTags) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: cleanTags || null })
    });
    if (!res.ok) throw new Error("Etiket güncellenemedi");
    return res;
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

export async function dbSaveVideo(id, payload) {
    let fixedPayload = { ...payload };
    if (fixedPayload.is_downloaded === true && (!fixedPayload.url || fixedPayload.url === '' || fixedPayload.url.startsWith('drive_temp'))) {
        const uniqueSuffix = Date.now() + '_' + Math.random().toString(36).substring(2, 10);
        fixedPayload.url = `drive_video_${uniqueSuffix}`;
    }
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `${SUPABASE_URL}/rest/v1/videos?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/videos`;
    const res = await fetch(url, {
        method,
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(fixedPayload)
    });
    if (!res.ok) {
        let errorText = await res.text();
        throw new Error(`Veritabanı hatası (${res.status}): ${errorText}`);
    }
    return res;
}

export async function dbUpdateTagsDirectly(videoId, cleanTags) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: cleanTags || null })
    });
    if (!res.ok) throw new Error("Etiket güncellenemedi");
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

export async function dbUpdateNote(videoId, note) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note || null })
    });
    if (!res.ok) throw new Error("Not kaydedilemedi");
    return res;
}

// ---------- YENİ TOPLU ETİKET FONKSİYONLARI ----------

// Tüm videoları çeker, her bir video için tags stringini günceller ve toplu PATCH gönderir
async function batchUpdateVideosTag(updates) {
    // updates: [{ id: videoId, newTags: string }]
    if (!updates.length) return;
    // Supabase'de in() filtresiyle toplu güncelleme yapmak için her bir video için ayrı PATCH gerekiyor? 
    // Aslında tek bir PATCH ile birden çok video güncellenemez. Bu yüzden Promise.all ile paralel göndereceğiz.
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

// Etiket birleştirme: eskiEtiketler dizisi, yeniEtiket
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
            updates.push({ id: video.id, newTags: tags.join(', ') });
        }
    }
    await batchUpdateVideosTag(updates);
}

// Etiket silme: tagsArray içindeki etiketleri tüm videolardan kaldır
export async function dbDeleteTagsFromAllVideos(tagsArray) {
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
            updates.push({ id: video.id, newTags: tags.join(', ') });
        }
    }
    await batchUpdateVideosTag(updates);
}

// Etiket yeniden adlandırma: oldTag -> newTag
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

// Normalize: tüm videoların tags alanındaki boşlukları, çift virgülleri temizle (isteğe bağlı)
export async function dbNormalizeAllTags() {
    const videos = await dbFetchVideos();
    const updates = [];
    for (const video of videos) {
        if (!video.tags) continue;
        let normalized = video.tags.split(',')
            .map(t => t.trim())
            .filter(t => t !== '')
            .join(', ');
        if (normalized !== video.tags) {
            updates.push({ id: video.id, newTags: normalized || null });
        }
    }
    await batchUpdateVideosTag(updates);
}