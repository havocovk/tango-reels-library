// api.js
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

async function supabaseRequest(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        throw new Error(`Supabase Hatası: ${await response.text()}`);
    }
    return await response.json();
}

export async function fetchVideos() {
    return await supabaseRequest('videos?select=*,instructors(*)&order=id.desc');
}

export async function fetchInstructors() {
    return await supabaseRequest('instructors?select=*&order=name.asc');
}

export async function saveVideo(videoData) {
    if (videoData.id) {
        const id = videoData.id;
        const updateData = { ...videoData };
        delete updateData.id;
        return await supabaseRequest(`videos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(updateData) });
    } else {
        return await supabaseRequest('videos', { method: 'POST', body: JSON.stringify(videoData) });
    }
}

export async function deleteVideo(id) {
    return await supabaseRequest(`videos?id=eq.${id}`, { method: 'DELETE' });
}

export async function insertInstructor(name) {
    return await supabaseRequest('instructors', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function updateInstructor(id, name) {
    return await supabaseRequest(`instructors?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}

export async function deleteInstructor(id) {
    return await supabaseRequest(`instructors?id=eq.${id}`, { method: 'DELETE' });
}