// db/annotations.js - Annotation veritabanı işlemleri
// ✅ YENİ (Adım 6.1)
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// Bir videoya ait tüm notları sıralı çeker
export async function dbFetchAnnotations(videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/annotations?video_id=eq.${videoId}&order=timestamp_sec.asc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) throw new Error('Notlar alınamadı');
    return await res.json();
}

// Yeni not ekler; eklenen kaydı döndürür
export async function dbAddAnnotation(videoId, timestampSec, note) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/annotations`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ video_id: videoId, timestamp_sec: timestampSec, note })
    });
    if (!res.ok) throw new Error('Not eklenemedi');
    const rows = await res.json();
    return rows[0];
}

// Notu siler
export async function dbDeleteAnnotation(id) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/annotations?id=eq.${id}`,
        {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        }
    );
    if (!res.ok) throw new Error('Not silinemedi');
}