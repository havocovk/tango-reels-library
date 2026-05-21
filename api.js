// api.js
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

export async function getAllInstructors() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?select=*&order=name.asc`, { headers });
    if (!response.ok) throw new Error("Eğitmenler yüklenemedi");
    return await response.json();
}

export async function getAllVideos() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?select=*,instructors(name)&order=created_at.desc`, { headers });
    if (!response.ok) throw new Error("Videolar yüklenemedi");
    return await response.json();
}

export async function saveInstructor({ id, name }) {
    let response;
    if (id) {
        response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
            method: 'PATCH',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name })
        });
    } else {
        response = await fetch(`${SUPABASE_URL}/rest/v1/instructors`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ name })
        });
    }
    if (!response.ok) throw new Error("Eğitmen kaydedilemedi");
    return true;
}

export async function deleteInstructor(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/instructors?id=eq.${id}`, {
        method: 'DELETE',
        headers
    });
    if (!response.ok) throw new Error("Eğitmen silinemedi");
    return true;
}

export async function saveVideo({ id, payload }) {
    let response;
    if (id) {
        response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(payload)
        });
    } else {
        response = await fetch(`${SUPABASE_URL}/rest/v1/videos`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
    }
    if (!response.ok) throw new Error("Video kaydedilemedi");
    return true;
}

export async function deleteVideo(id) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${id}`, {
        method: 'DELETE',
        headers
    });
    if (!response.ok) throw new Error("Video veritabanından silinemedi");
    return true;
}