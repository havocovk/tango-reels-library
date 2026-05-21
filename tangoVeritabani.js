import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// 1. Postacı: Sadece internete gidip eğitmen listesini ham paket olarak getirir
export async function dbFetchInstructors() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Eğitmenler veritabanından çekilemedi");
    return await response.json();
}

// 2. Postacı: Sadece internete gidip video listesini ham paket olarak getirir
export async function dbFetchVideos() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (!response.ok) throw new Error("Videolar veritabanından çekilemedi");
    return await response.json();
}