// db/practiceList.js - Pratik Listesi veritabanı işlemleri
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
};

export async function dbFetchPracticeList() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/practice_list?select=video_id,created_at`,
        { headers: { ...HEADERS, 'Accept': 'application/json' } }
    );
    if (!res.ok) throw new Error(`dbFetchPracticeList: ${res.status}`);
    return res.json();
}

export async function dbAddToPracticeList(videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/practice_list`,
        {
            method: 'POST',
            headers: { ...HEADERS, 'Prefer': 'return=representation' },
            body: JSON.stringify({ video_id: videoId })
        }
    );
    if (!res.ok) throw new Error(`dbAddToPracticeList: ${res.status}`);
    return res.json();
}

export async function dbRemoveFromPracticeList(videoId) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/practice_list?video_id=eq.${videoId}`,
        {
            method: 'DELETE',
            headers: HEADERS
        }
    );
    if (!res.ok) throw new Error(`dbRemoveFromPracticeList: ${res.status}`);
}

export async function dbClearPracticeList() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/practice_list?video_id=neq.0`,
        {
            method: 'DELETE',
            headers: HEADERS
        }
    );
    if (!res.ok) throw new Error(`dbClearPracticeList: ${res.status}`);
}