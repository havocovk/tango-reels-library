// db/practiceSessions.js — Adim 4.3: Pratik seans geçmişi
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

// ─────────────────────────────────────────────────────────────
// dbSavePracticeSession — Seans bitince çağrılır
// ─────────────────────────────────────────────────────────────
export async function dbSavePracticeSession({ practiced_count, skipped_count, duration_seconds }) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/practice_sessions`,
        {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_KEY,
                'Content-Type':  'application/json',
                'Prefer':        'return=minimal'
            },
            body: JSON.stringify({
                practiced_count,
                skipped_count,
                duration_seconds,
                session_date: new Date().toISOString()
            })
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Seans kaydedilemedi: ${err}`);
    }
}

// ─────────────────────────────────────────────────────────────
// dbFetchPracticeSessions — Son 12 haftanın seanslarını çeker
// ─────────────────────────────────────────────────────────────
export async function dbFetchPracticeSessions() {
    // Son 12 hafta = 84 gün
    const since = new Date();
    since.setDate(since.getDate() - 84);
    const sinceISO = since.toISOString();

    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/practice_sessions?session_date=gte.${sinceISO}&order=session_date.desc&limit=200`,
        {
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );
    if (!res.ok) throw new Error('Seanslar alınamadı');
    return await res.json();
}