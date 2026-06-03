// db/tagsNormalized.js — Normalize Edilmiş Etiket Yapısı API'si
// ✅ YENİ (Adım 8.1)
//
// ÖNEMLİ NOT (mimari):
// Uygulama şu an etiketleri ESKİSİ GİBİ `videos.tags` (virgülle ayrılmış
// metin) sütunu üzerinden okuyup yazmaya devam eder. Yeni `tags` ve
// `video_tags` ilişkisel tabloları, Supabase'de kurulan bir VERİTABANI
// TRIGGER'ı (sync_video_tags) tarafından otomatik olarak senkron tutulur:
// videos.tags her değiştiğinde (form kaydı, satır içi düzenleme, RPC ile
// rename/merge/delete — hepsi) trigger normalize tabloları günceller.
//
// Bu sayede mevcut 26 özellik HİÇ değişmeden çalışmaya devam ederken,
// normalize tablolar her zaman doğru ve dolu kalır.
//
// Aşağıdaki fonksiyonlar bu normalize tabloları OKUMAK (güvenilir etiket
// istatistikleri) ve gelecekteki tam geçiş (server-side etiket filtreleme,
// Adım 8.2 vb.) için hazır API'dir. Yazma fonksiyonları doğrudan normalize
// tablolara yazar; bunları kullanırsanız `videos.tags` metnini de ayrıca
// güncellemeniz gerektiğini unutmayın (şu an uygulama bunlara ihtiyaç
// duymaz, trigger işi halleder).

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

const authHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
};

// ─────────────────────────────────────────────────────────────
// OKUMA FONKSİYONLARI
// ─────────────────────────────────────────────────────────────

// Tüm etiketleri çeker (tags tablosu) — { id, name } dizisi
export async function dbFetchAllTags() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/tags?select=*&order=name.asc`,
        { headers: authHeaders }
    );
    if (!res.ok) throw new Error('Etiketler alınamadı (normalize)');
    return await res.json();
}

// Bir videonun etiketlerini çeker (video_tags → tags JOIN) — { id, name } dizisi
export async function dbFetchVideoTags(videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/video_tags?video_id=eq.${videoId}&select=tag_id,tags(id,name)`,
        { headers: authHeaders }
    );
    if (!res.ok) throw new Error('Video etiketleri alınamadı');
    const rows = await res.json();
    return rows.map(r => r.tags).filter(Boolean);
}

// Her etiketin kaç videoda kullanıldığını döndürür (GÜVENİLİR istatistik).
// PostgREST'in gömülü sayım (embedded count) özelliğini kullanır.
// Dönüş: [{ id, name, count }, ...]
export async function dbGetTagUsageCounts() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/tags?select=id,name,video_tags(count)&order=name.asc`,
        { headers: authHeaders }
    );
    if (!res.ok) throw new Error('Etiket sayıları alınamadı');
    const rows = await res.json();
    return rows.map(r => ({
        id: r.id,
        name: r.name,
        count: (Array.isArray(r.video_tags) && r.video_tags[0])
            ? (r.video_tags[0].count || 0)
            : 0
    }));
}

// ─────────────────────────────────────────────────────────────
// YAZMA FONKSİYONLARI (gelecekteki tam geçiş için hazır API)
// ─────────────────────────────────────────────────────────────

// İsimde etiket yoksa oluşturur, ID döner (yarış durumuna dayanıklı)
export async function dbGetOrCreateTag(name) {
    const clean = (name || '').trim();
    if (!clean) throw new Error('Etiket adı boş olamaz');

    // Önce var mı?
    const findRes = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/tags?name=eq.${encodeURIComponent(clean)}&select=id`,
        { headers: authHeaders }
    );
    if (findRes.ok) {
        const found = await findRes.json();
        if (found.length > 0) return found[0].id;
    }

    // Yoksa oluştur
    const insRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/tags`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ name: clean })
    });

    if (!insRes.ok) {
        // Aynı anda başka biri oluşturduysa (UNIQUE çakışması) tekrar bul
        const retry = await fetchWithRetry(
            `${SUPABASE_URL}/rest/v1/tags?name=eq.${encodeURIComponent(clean)}&select=id`,
            { headers: authHeaders }
        );
        if (retry.ok) {
            const rows = await retry.json();
            if (rows.length > 0) return rows[0].id;
        }
        throw new Error('Etiket oluşturulamadı');
    }

    const created = await insRes.json();
    return created[0].id;
}

// Videoya etiket ekler (video_tags satırı oluşturur)
export async function dbAddTagToVideo(videoId, tagName) {
    const tagId = await dbGetOrCreateTag(tagName);
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/video_tags`, {
        method: 'POST',
        headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify({ video_id: videoId, tag_id: tagId })
    });
    if (!res.ok && res.status !== 409) throw new Error('Etiket videoya eklenemedi');
    return tagId;
}

// Videodan etiket bağını kaldırır
export async function dbRemoveTagFromVideo(videoId, tagId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/video_tags?video_id=eq.${videoId}&tag_id=eq.${tagId}`,
        { method: 'DELETE', headers: authHeaders }
    );
    if (!res.ok) throw new Error('Etiket videodan kaldırılamadı');
}

// Etiketi yeniden adlandır (tek satır günceller → bağlı tüm videolara yansır)
export async function dbRenameTagNormalized(oldName, newName) {
    const cleanOld = (oldName || '').trim();
    const cleanNew = (newName || '').trim();
    if (!cleanOld || !cleanNew) throw new Error('Etiket adları boş olamaz');

    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/tags?name=eq.${encodeURIComponent(cleanOld)}`,
        {
            method: 'PATCH',
            headers: { ...authHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name: cleanNew })
        }
    );
    if (!res.ok) throw new Error('Etiket adı değiştirilemedi (normalize)');
}

// Birden çok kaynak etiketi tek bir hedef etikette birleştirir.
// sourceIds: birleştirilecek etiket ID'leri, targetName: hedef etiket adı.
export async function dbMergeTagsNormalized(sourceIds, targetName) {
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) return;
    const targetId = await dbGetOrCreateTag(targetName);

    for (const srcId of sourceIds) {
        if (srcId === targetId) continue;

        // Kaynağa bağlı videoları bul
        const vtRes = await fetchWithRetry(
            `${SUPABASE_URL}/rest/v1/video_tags?tag_id=eq.${srcId}&select=video_id`,
            { headers: authHeaders }
        );
        const rows = vtRes.ok ? await vtRes.json() : [];

        // Bu videoları hedef etikete bağla
        for (const row of rows) {
            await fetchWithRetry(`${SUPABASE_URL}/rest/v1/video_tags`, {
                method: 'POST',
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal,resolution=ignore-duplicates'
                },
                body: JSON.stringify({ video_id: row.video_id, tag_id: targetId })
            });
        }

        // Kaynak etiketi sil (video_tags bağları ON DELETE CASCADE ile silinir)
        await fetchWithRetry(
            `${SUPABASE_URL}/rest/v1/tags?id=eq.${srcId}`,
            { method: 'DELETE', headers: authHeaders }
        );
    }
}