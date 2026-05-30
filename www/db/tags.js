// db/tags.js - Etiket toplu işlemleri (birleştirme, yeniden adlandırma, silme, temizleme)
import { dbFetchVideos } from './videos.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// Yardımcı: birden fazla videoyu toplu güncelle
async function batchUpdateVideosTag(updates) {
    if (!updates.length) return;
    const promises = updates.map(({ id, newTags }) => {
        return fetchWithRetry(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
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
