// db/monthlyStats.js - Aylık istatistik tablosu işlemleri
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { fetchWithRetry } from '../utils.js';

const HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
};

// Tüm kayıtları çek
export async function dbFetchMonthlyStats() {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/monthly_stats?select=*&order=year.desc,month.desc`,
        { headers: { ...HEADERS, 'Accept': 'application/json' } }
    );
    if (!res.ok) throw new Error(`dbFetchMonthlyStats: ${res.status}`);
    return res.json();
}

// Bu ayın kaydını getir (yoksa null)
export async function dbFetchCurrentMonthStat(year, month) {
    const res = await fetchWithRetry(
        `${SUPABASE_URL}/rest/v1/monthly_stats?year=eq.${year}&month=eq.${month}&select=*`,
        { headers: { ...HEADERS, 'Accept': 'application/json' } }
    );
    if (!res.ok) throw new Error(`dbFetchCurrentMonthStat: ${res.status}`);
    const rows = await res.json();
    return rows.length > 0 ? rows[0] : null;
}

// Upsert — yoksa oluştur, varsa practiced_count artır
export async function dbIncrementMonthlyPracticeCount(year, month) {
    const existing = await dbFetchCurrentMonthStat(year, month);
    if (existing) {
        const res = await fetchWithRetry(
            `${SUPABASE_URL}/rest/v1/monthly_stats?id=eq.${existing.id}`,
            {
                method: 'PATCH',
                headers: { ...HEADERS, 'Prefer': 'return=representation' },
                body: JSON.stringify({ practiced_count: (existing.practiced_count || 0) + 1 })
            }
        );
        if (!res.ok) throw new Error(`dbIncrementMonthlyPracticeCount patch: ${res.status}`);
        const rows = await res.json();
        return rows[0];
    } else {
        const res = await fetchWithRetry(
            `${SUPABASE_URL}/rest/v1/monthly_stats`,
            {
                method: 'POST',
                headers: { ...HEADERS, 'Prefer': 'return=representation' },
                body: JSON.stringify({ year, month, practiced_count: 1 })
            }
        );
        if (!res.ok) throw new Error(`dbIncrementMonthlyPracticeCount insert: ${res.status}`);
        const rows = await res.json();
        return rows[0];
    }
}