// db/tagColors.js - Etiket renk eşleşmelerini Supabase'den çeker/günceller
import { SUPABASE_URL, SUPABASE_KEY } from '../tangoVeritabani.js';

// ─────────────────────────────────────────────────────────────
// dbFetchTagColors()
// tag_colors tablosundaki tüm satırları çeker.
// Döner: [{ tag_name, color_code }, ...]
// ─────────────────────────────────────────────────────────────
export async function dbFetchTagColors() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tag_colors?select=tag_name,color_code`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    if (!res.ok) throw new Error('Etiket renkleri çekilemedi');
    return await res.json();
}

// ─────────────────────────────────────────────────────────────
// dbSetTagColor(tagName, colorCode)
// Bir etiket için renk ekler veya günceller (UPSERT).
// ─────────────────────────────────────────────────────────────
export async function dbSetTagColor(tagName, colorCode) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tag_colors`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ tag_name: tagName, color_code: colorCode })
    });
    if (!res.ok) throw new Error('Renk kaydedilemedi');
}

// ─────────────────────────────────────────────────────────────
// dbDeleteTagColor(tagName)
// Bir etiketin renk kaydını siler.
// ─────────────────────────────────────────────────────────────
export async function dbDeleteTagColor(tagName) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/tag_colors?tag_name=eq.${encodeURIComponent(tagName)}`,
        {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );
    if (!res.ok) throw new Error('Renk silinemedi');
}