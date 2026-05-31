// db/tags.js - Etiket toplu işlemleri (RPC ile, atomik)
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// Yardımcı: RPC çağrısı yapan fonksiyon
async function callRPC(functionName, params) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`RPC hatası (${functionName}): ${errorText}`);
    }
    return await res.json();
}

// 1. Eski etiketleri yeni bir etiket altında birleştir
export async function dbMergeTags(oldTagsArray, newTag) {
    if (!oldTagsArray.length) return;
    return await callRPC('merge_tags', { old_tags: oldTagsArray, new_tag: newTag });
}

// 2. Belirtilen etiketleri tüm videolardan sil
export async function dbDeleteTagFromAllVideos(tagsArray) {
    if (!tagsArray.length) return;
    return await callRPC('delete_tags', { tags_to_delete: tagsArray });
}

// 3. Bir etiketin adını değiştir
export async function dbRenameTag(oldTag, newTag) {
    return await callRPC('rename_tag', { old_tag: oldTag, new_tag: newTag });
}

// 4. Videolardaki tekrar eden etiketleri temizle (benzersiz yap)
export async function dbCleanupUnusedTags() {
    const updatedCount = await callRPC('cleanup_unused_tags', {});
    return { removedCount: updatedCount };
}