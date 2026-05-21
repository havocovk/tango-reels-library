// api.js
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Ortak Fetch İstek Atıcı Yardımcı Fonksiyonu
async function supabaseFetch(endpoint, options = {}) {
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
        const errorText = await response.text();
        throw new Error(`Supabase Hatası (${response.status}): ${errorText}`);
    }
    return await response.json();
}

// 1. TÜM VİDEOLARI GETİR (Eğitmen Bilgileriyle Birlikte)
export async function fetchVideos() {
    // instructors(*) ile videolar tablosuna bağlı eğitmen detaylarını da tek seferde çekiyoruz
    return await supabaseFetch('videos?select=*,instructors(*)&order=id.desc');
}

// 2. TÜM EĞİTMENLERİ GETİR
export async function fetchInstructors() {
    return await supabaseFetch('instructors?select=*&order=name.asc');
}

// 3. VİDEO KAYDET VEYA GÜNCELLE
export async function saveVideo(videoData) {
    // Eğer videoData içinde id varsa GÜNCELLEME (PATCH), yoksa YENİ KAYIT (POST) yapıyoruz
    if (videoData.id) {
        const videoId = videoData.id;
        // id alanını veritabanına tekrar göndermemek için kopyasından siliyoruz
        const updateData = { ...videoData };
        delete updateData.id;

        return await supabaseFetch(`videos?id=eq.${videoId}`, {
            method: 'PATCH',
            body: JSON.stringify(updateData)
        });
    } else {
        return await supabaseFetch('videos', {
            method: 'POST',
            body: JSON.stringify(videoData)
        });
    }
}

// 4. VİDEO SİL
export async function deleteVideo(videoId) {
    return await supabaseFetch(`videos?id=eq.${videoId}`, {
        method: 'DELETE'
    });
}

// 5. YENİ EĞİTMEN EKLE
export async function insertInstructor(name) {
    return await supabaseFetch('instructors', {
        method: 'POST',
        body: JSON.stringify({ name })
    });
}

// 6. EĞİTMEN ADI GÜNCELLE
export async function updateInstructor(instructorId, name) {
    return await supabaseFetch(`instructors?id=eq.${instructorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name })
    });
}

// 7. EĞİTMENİ SİL (Bağlı videolar veritabanında CASCADE silmeye ayarlı olmalıdır)
export async function deleteInstructor(instructorId) {
    return await supabaseFetch(`instructors?id=eq.${instructorId}`, {
        method: 'DELETE'
    });
}