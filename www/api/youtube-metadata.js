// api/youtube-metadata.js
// ✅ YENİ DOSYA (Adım 4.1) — Vercel Serverless Function
// GET /api/youtube-metadata?videoId={id}
// YouTube Data API v3'ten başlık, açıklama ve süre çeker.
// YOUTUBE_API_KEY anahtarı Vercel ortam değişkeninde saklanır,
// hiçbir zaman istemci tarafına gönderilmez.

export default async function handler(req, res) {
    // Sadece GET isteği kabul et
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { videoId } = req.query;

    // Video ID kontrolü
    if (!videoId || videoId.trim() === '') {
        return res.status(400).json({ error: 'videoId parametresi gerekli' });
    }

    // YouTube API anahtarı ortam değişkeninden al
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'YouTube API anahtarı yapılandırılmamış' });
    }

    try {
        // YouTube Data API v3 isteği
        // part=snippet → başlık ve açıklama
        // part=contentDetails → süre (ISO 8601 formatında, örn. PT4M13S)
        const youtubeUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${apiKey}`;

        const response = await fetch(youtubeUrl);

        if (!response.ok) {
            throw new Error(`YouTube API hatası: ${response.status}`);
        }

        const data = await response.json();

        // Video bulunamadıysa
        if (!data.items || data.items.length === 0) {
            return res.status(404).json({ error: 'Video bulunamadı' });
        }

        const video = data.items[0];
        const snippet = video.snippet || {};
        const contentDetails = video.contentDetails || {};

        // ISO 8601 süreyi okunabilir formata çevir (PT4M13S → 4:13)
        const duration = formatDuration(contentDetails.duration || '');

        // Açıklamayı kısalt (çok uzun olabilir, AI için 500 karakter yeterli)
        const description = (snippet.description || '').substring(0, 500);

        return res.status(200).json({
            title: snippet.title || '',
            description: description,
            duration: duration,
            channelTitle: snippet.channelTitle || '',
            publishedAt: snippet.publishedAt || ''
        });

    } catch (err) {
        console.error('YouTube metadata hatası:', err);
        return res.status(500).json({ error: err.message });
    }
}

// ─────────────────────────────────────────────────────────────
// ISO 8601 süre formatını "dk:sn" şekline çevir
// Örnekler: PT4M13S → "4:13" | PT1H2M5S → "1:02:05" | PT45S → "0:45"
// ─────────────────────────────────────────────────────────────
function formatDuration(iso) {
    if (!iso) return '';

    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';

    const hours   = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
        // Saat varsa: 1:02:05
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
        // Saat yoksa: 4:13
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
}