// db/videoLinks.js - Kombinasyon zinciri (video bağlantıları) veritabanı işlemleri
// ✅ YENİ (Adım 6.2)
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// ─────────────────────────────────────────────────────────────
// dbFetchAllVideoLinks
// Tüm bağlantıları tek seferde çeker. Uygulama açılışında store'a
// yüklenir; kartlar bu listeyi okuyarak ekstra istek atmadan
// "← Önceki / → Sonraki" navigasyonunu çizer.
// ─────────────────────────────────────────────────────────────
export async function dbFetchAllVideoLinks() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/video_links?select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error('Bağlantılar alınamadı');
    return await res.json();
}

// ─────────────────────────────────────────────────────────────
// dbFetchVideoLinks(videoId)
// Tek bir videoya ait bağlantıları çeker.
//   outgoing → bu videodan SONRA gelenler (source = videoId)
//   incoming → bu videodan ÖNCE gelenler (target = videoId)
// ─────────────────────────────────────────────────────────────
export async function dbFetchVideoLinks(videoId) {
    const outRes = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/video_links?source_video_id=eq.${videoId}&select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!outRes.ok) throw new Error('Sonraki bağlantılar alınamadı');
    const outgoing = await outRes.json();

    const inRes = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/video_links?target_video_id=eq.${videoId}&select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!inRes.ok) throw new Error('Önceki bağlantılar alınamadı');
    const incoming = await inRes.json();

    return { outgoing, incoming };
}

// ─────────────────────────────────────────────────────────────
// dbAddVideoLink(sourceId, targetId)
// "sourceId videosundan sonra targetId gelir" ilişkisini ekler.
// Eklenen kaydı döndürür. Aynı ilişki zaten varsa UNIQUE kısıtı
// nedeniyle 409 döner; çağıran taraf bunu yakalar.
// ─────────────────────────────────────────────────────────────
export async function dbAddVideoLink(sourceId, targetId) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/video_links`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ source_video_id: sourceId, target_video_id: targetId })
    });
    if (!res.ok) {
        if (res.status === 409) throw new Error('DUPLICATE');
        throw new Error('Bağlantı eklenemedi');
    }
    const rows = await res.json();
    return rows[0];
}

// ─────────────────────────────────────────────────────────────
// dbDeleteVideoLink(id)
// Bir bağlantıyı id'sine göre siler.
// ─────────────────────────────────────────────────────────────
export async function dbDeleteVideoLink(id) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/video_links?id=eq.${id}`,
        {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }
    );
    if (!res.ok) throw new Error('Bağlantı silinemedi');
}