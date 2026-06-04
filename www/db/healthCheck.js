// db/healthCheck.js - Etiket senkronizasyon sağlık kontrolü
// ✅ YENİ DOSYA (Adım 3.3)

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// ─────────────────────────────────────────────────────────────
// dbRunTagSyncCheck — Senkron bozuk videoları döner
// Boş dizi → her şey yolunda
// ─────────────────────────────────────────────────────────────
export async function dbRunTagSyncCheck() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/rpc/check_tag_sync`,
        {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${window.__tangoAuthToken || SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        }
    );
    if (!res.ok) throw new Error(`Sağlık kontrolü başarısız: ${res.status}`);
    return await res.json(); // [{ video_id, video_url, tags_text, normalized_tags }]
}

// ─────────────────────────────────────────────────────────────
// dbRepairTagSync — Belirli bir video için trigger'ı yeniden tetikle
// videos.tags değerini kendisiyle günceller → trigger çalışır → video_tags düzelir
// ─────────────────────────────────────────────────────────────
export async function dbRepairTagSync(videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/videos?id=eq.${videoId}`,
        {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${window.__tangoAuthToken || SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            // tags = tags: trigger'ı tetiklemek için kendisiyle güncelle
            body: JSON.stringify({ _sync_trigger: true })
        }
    );
    if (!res.ok) throw new Error(`Onarım başarısız (video ${videoId}): ${res.status}`);
}