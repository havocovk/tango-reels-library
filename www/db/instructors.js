// db/instructors.js - Eğitmen ile ilgili tüm veritabanı işlemleri
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

export async function dbFetchInstructors() {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Eğitmenler alınamadı");
    return await res.json();
}

export async function dbSaveInstructor(id, name) {
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}` : `${SUPABASE_URL}/rest/v1/instructors`;
    const res = await fetchWithRetry(url, {
        method,
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ name })
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Eğitmen kaydedilemedi: ${errorText}`);
    }
    return res;
}

export async function dbDeleteInstructor(id) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!res.ok) throw new Error("Eğitmen silinemedi");
    return res;
}

// ✅ YENİ (Adım 6.3): Eğitmen profil fotoğrafı ve biyografisi güncelleme
export async function dbUpdateInstructorProfile(id, photoUrl, bio) {
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            photo_url: photoUrl || null,
            bio: bio || null
        })
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Profil kaydedilemedi: ${errorText}`);
    }
    return res;
}