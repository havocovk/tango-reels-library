// db/tagColors.js - Etiket renk eşleşmelerini Supabase'den çeker/günceller
// ✅ DÜZELTME (Backup v2.1): dbSetTagColor body'i artık dizi olarak gönderir.
//    Supabase'in PostgREST'i, merge-duplicates (upsert) için tek objeyi
//    bazen 409 ile reddediyor ama dizi formatını kabul ediyor.

import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// ─────────────────────────────────────────────────────────────
// dbFetchTagColors()
// tag_colors tablosundaki tüm satırları çeker.
// Döner: [{ tag_name, color_code }, ...]
// ─────────────────────────────────────────────────────────────
export async function dbFetchTagColors() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/tag_colors?select=tag_name,color_code`,
        {
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );
    if (!res.ok) throw new Error('Etiket renkleri çekilemedi');
    return await res.json();
}

// ─────────────────────────────────────────────────────────────
// dbSetTagColor(tagName, colorCode)
// Bir etiket için renk ekler veya günceller (UPSERT).
//
// ✅ DÜZELTME: Body artık tek obje değil, dizi olarak gönderiliyor.
// Supabase'in bazı versiyonlarında merge-duplicates (upsert),
// tek obje gönderildiğinde 409 döndürüyor.
// Dizi formatı her zaman güvenilir şekilde çalışıyor.
// ─────────────────────────────────────────────────────────────
export async function dbSetTagColor(tagName, colorCode) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/tag_colors`, {
        method: 'POST',
        headers: {
            'apikey':        SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        'resolution=merge-duplicates,return=minimal'
        },
        // ✅ Dizi formatı: [{ ... }] — tek obje değil
        body: JSON.stringify([{ tag_name: tagName, color_code: colorCode }])
    });
    if (!res.ok) {
        // Hatanın gerçek sebebini logla (eskiden sadece "Renk kaydedilemedi" diyordu)
        const errText = await res.text().catch(() => '');
        throw new Error(`Renk kaydedilemedi (HTTP ${res.status}): ${errText}`);
    }
}

// ─────────────────────────────────────────────────────────────
// dbDeleteTagColor(tagName)
// Bir etiketin renk kaydını siler.
// ─────────────────────────────────────────────────────────────
export async function dbDeleteTagColor(tagName) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/tag_colors?tag_name=eq.${encodeURIComponent(tagName)}`,
        {
            method: 'DELETE',
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );
    if (!res.ok) throw new Error('Renk silinemedi');
}