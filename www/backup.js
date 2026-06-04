// backup.js - Yedekleme ve geri yükleme modülü
// ✅ v2.0 — Kapsamlı yedekleme sistemi
// ✅ v2.1 — tag_colors store'dan export edilir (DB yazma hatalarına karşı)
//         — video_links teker teker insert edilir (toplu batch hatası düzeltildi)

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, fetchWithRetry } from './utils.js';
import { store } from './store.js';
import { dbFetchAllAnnotations } from './db/annotations.js';
import { dbFetchPlaylists, dbFetchAllPlaylistVideos } from './db/playlists.js';
import { dbFetchAllVideoLinks } from './db/videoLinks.js';
import { dbFetchTagColors } from './db/tagColors.js';

let currentLang = 'tr';

export function setBackupLang(lang) {
    currentLang = lang;
}

// ================================================================
// 1. DIŞA AKTAR (Export) — v2.1
// ================================================================
export async function exportToJSON(videos, instructors, favorites) {
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';

    try {
        // Ek verileri paralel olarak çek
        const [annotations, playlists, playlistVideos, videoLinks, tagColorsFromDB] =
            await Promise.all([
                dbFetchAllAnnotations().catch(e => { console.warn('Notlar çekilemedi:', e); return []; }),
                dbFetchPlaylists().catch(e => { console.warn('Listeler çekilemedi:', e); return []; }),
                dbFetchAllPlaylistVideos().catch(e => { console.warn('Liste-video ilişkileri çekilemedi:', e); return []; }),
                dbFetchAllVideoLinks().catch(e => { console.warn('Bağlantılar çekilemedi:', e); return []; }),
                dbFetchTagColors().catch(e => { console.warn('DB etiket renkleri çekilemedi:', e); return []; })
            ]);

        // ── tag_colors: store'dan al (DB yazma hatalarına karşı güvenli) ──────
        // DB'nin boş gelmesi renklerin hiç olmadığı anlamına gelmez;
        // store her zaman güncel kaynaktır.
        const storeTagColors = store.get('tagColors') || {};
        const storeTagColorsArray = Object.entries(storeTagColors)
            .map(([tag_name, color_code]) => ({ tag_name, color_code }));

        // Store doluysa store'u kullan, boşsa DB'den geleni kullan
        const finalTagColors = storeTagColorsArray.length > 0
            ? storeTagColorsArray
            : tagColorsFromDB;

        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            data: {
                videos: videos.map(v => ({
                    id: v.id,
                    url: v.url,
                    instructor_id: v.instructor_id,
                    role_type: v.role_type,
                    partner_name: v.partner_name,
                    tags: v.tags,
                    is_downloaded: v.is_downloaded,
                    drive_url: v.drive_url,
                    cover_url: v.cover_url,
                    platform: v.platform,
                    notes: v.notes,
                    created_at: v.created_at
                })),
                instructors: instructors.map(i => ({
                    id: i.id,
                    name: i.name
                })),
                favorites: favorites,
                annotations: annotations,
                playlists: playlists,
                playlist_videos: playlistVideos,
                video_links: videoLinks,
                tag_colors: finalTagColors
            }
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tango_backup_v2_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error('Dışa aktarma hatası:', err);
        await showCustomAlert(
            currentLang === 'tr'
                ? `❌ Dışa aktarma sırasında hata: ${err.message}`
                : `❌ Export error: ${err.message}`,
            okText, true
        );
    }
}

// ================================================================
// 2. İÇE AKTARMA (Import) — v2.1 (2 Aşamalı)
// ================================================================
export async function importFromJSON(
    file,
    currentVideos,
    currentInstructors,
    currentFavorites,
    fetchVideosFn,
    fetchInstructorsFn
) {
    const okText     = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';

    // ── 1. Kullanıcıdan onay ────────────────────────────────────
    const confirmMsg = currentLang === 'tr'
        ? 'Bu yedek mevcut koleksiyonunuzla birleştirilecek.\n\n• Aynı URL\'li videolar tekrar eklenmez.\n• Notlar, listeler, bağlantılar ve etiket renkleri ayrı ayrı geri yüklenir.\n\nDevam edilsin mi?'
        : 'This backup will be merged with your current collection.\n\n• Duplicate videos (same URL) are skipped.\n• Notes, playlists, links, and tag colors are restored separately.\n\nContinue?';

    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;

    // ── 2. Dosyayı oku ve doğrula ───────────────────────────────
    let backup;
    try {
        const fileContent = await file.text();
        backup = JSON.parse(fileContent);
        if (!backup.data || !Array.isArray(backup.data.videos) || !Array.isArray(backup.data.instructors)) {
            throw new Error('Beklenen alanlar eksik');
        }
    } catch (err) {
        await showCustomAlert(
            currentLang === 'tr'
                ? `❌ Geçersiz veya bozuk yedek dosyası!\nDetay: ${err.message}`
                : `❌ Invalid or corrupted backup file!\nDetail: ${err.message}`,
            okText, true
        );
        return;
    }

    // ── 3. Versiyon uyarısı (v1.0 → v2.0 yükseltme) ────────────
    const backupVersion = backup.version || '1.0';
    if (backupVersion === '1.0') {
        const warnMsg = currentLang === 'tr'
            ? '⚠️ Bu eski format (v1.0) bir yedek dosyası!\n\nNotlar, oynatma listeleri, bağlantılar ve etiket renkleri bu dosyada YOK.\n\nYalnızca videolar, eğitmenler ve favoriler içe aktarılacak.\n\nDevam edilsin mi?'
            : '⚠️ This is an old format (v1.0) backup!\n\nNotes, playlists, links, and tag colors are NOT included.\n\nOnly videos, instructors, and favorites will be imported.\n\nContinue?';
        if (!await showCustomConfirm(warnMsg, okText, cancelText)) return;
    }

    showLoading(true);

    try {
        // ────────────────────────────────────────────────────────
        // AŞAMA 1: ATOMİK RPC — videos + instructors + favorites
        // ────────────────────────────────────────────────────────
        const rpcPayload = {
            backup_json: {
                instructors: backup.data.instructors || [],
                videos:      backup.data.videos      || [],
                favorites:   backup.data.favorites   || []
            }
        };

        const rpcRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/rpc/import_backup`, {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify(rpcPayload)
        });

        if (!rpcRes.ok) {
            const errText = await rpcRes.text();
            throw new Error(
                currentLang === 'tr'
                    ? `Veritabanı işlemi başarısız (HTTP ${rpcRes.status}): ${errText}`
                    : `Database operation failed (HTTP ${rpcRes.status}): ${errText}`
            );
        }

        const rpcResult = await rpcRes.json();
        const insertedVideos    = rpcResult?.insertedVideos    ?? 0;
        const skippedVideos     = rpcResult?.skippedVideos     ?? 0;
        const insertedFavorites = rpcResult?.insertedFavorites ?? 0;

        // ────────────────────────────────────────────────────────
        // AŞAMA 2: EK TABLOLAR
        // ────────────────────────────────────────────────────────
        let phase2Results = {
            annotations: 0, playlists: 0, playlistVideos: 0,
            videoLinks: 0, videoLinksSkipped: 0, tagColors: 0, errors: []
        };

        if (backupVersion !== '1.0') {
            phase2Results = await importSecondaryData(backup.data);
        }

        // ── Ekranı tazele ───────────────────────────────────────
        if (fetchVideosFn)      await fetchVideosFn();
        if (fetchInstructorsFn) await fetchInstructorsFn();

        showLoading(false);

        // ── Başarı mesajı ───────────────────────────────────────
        const successMsg = buildSuccessMessage(
            insertedVideos, skippedVideos, insertedFavorites, phase2Results, backupVersion
        );
        await showCustomAlert(successMsg, okText, true);

    } catch (err) {
        console.error('İçe aktarma hatası:', err);
        showLoading(false);
        await showCustomAlert(
            currentLang === 'tr'
                ? `❌ İçe aktarma başarısız!\n\nHata: ${err.message}\n\nVideolar, eğitmenler ve favoriler eklenmedi (işlem geri alındı).`
                : `❌ Import failed!\n\nError: ${err.message}\n\nNo videos, instructors, or favorites were added (transaction rolled back).`,
            okText, true
        );
    }
}

// ================================================================
// 3. İKİNCİL VERİ İÇE AKTARMA (Aşama 2)
// ================================================================
async function importSecondaryData(data) {
    const results = {
        annotations:       0,
        playlists:         0,
        playlistVideos:    0,
        videoLinks:        0,
        videoLinksSkipped: 0,
        tagColors:         0,
        errors:            []
    };

    const BASE_HEADERS = {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json'
    };

    // ── TAG COLORS ────────────────────────────────────────────
    if (Array.isArray(data.tag_colors) && data.tag_colors.length > 0) {
        try {
            const payload = data.tag_colors
                .filter(tc => tc.tag_name && tc.color_code)
                .map(tc => ({ tag_name: tc.tag_name, color_code: tc.color_code }));

            if (payload.length > 0) {
                const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/tag_colors`, {
                    method: 'POST',
                    headers: { ...BASE_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    results.tagColors = payload.length;
                } else {
                    const errText = await res.text();
                    console.warn(`tag_colors batch insert başarısız (HTTP ${res.status}): ${errText}`);
                    results.errors.push('tag_colors');
                }
            }
        } catch (e) {
            console.warn('tag_colors içe aktarma hatası:', e);
            results.errors.push('tag_colors');
        }
    }

    // ── VIDEO LINKS — TEK TEK INSERT (toplu batch güvenilmez) ─
    // Her bağlantı ayrı ayrı gönderilir:
    //   - 201/200 → başarıyla eklendi
    //   - 409     → zaten vardı, atla (bu bir hata değil)
    //   - diğer   → gerçek hata, logla
    if (Array.isArray(data.video_links) && data.video_links.length > 0) {
        const payload = data.video_links
            .filter(vl => vl.source_video_id && vl.target_video_id)
            .map(vl => ({
                source_video_id: vl.source_video_id,
                target_video_id: vl.target_video_id
            }));

        if (payload.length > 0) {
            let insertedCount = 0;
            let skippedCount  = 0;
            let failedCount   = 0;

            for (const link of payload) {
                try {
                    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/video_links`, {
                        method: 'POST',
                        headers: { ...BASE_HEADERS, 'Prefer': 'return=minimal' },
                        body: JSON.stringify(link)
                    });

                    if (res.ok) {
                        insertedCount++;
                    } else if (res.status === 409) {
                        // Zaten var — bu normal, atla
                        skippedCount++;
                    } else {
                        const errText = await res.text();
                        console.warn(
                            `video_link eklenemedi (${link.source_video_id}→${link.target_video_id}): ` +
                            `HTTP ${res.status}: ${errText}`
                        );
                        failedCount++;
                    }
                } catch (singleErr) {
                    console.warn('video_link tekil insert hatası:', link, singleErr);
                    failedCount++;
                }
            }

            results.videoLinks        = insertedCount;
            results.videoLinksSkipped = skippedCount;

            if (failedCount > 0) {
                results.errors.push(`video_links (${failedCount} eklenemedi)`);
            }
        }
    }

    // ── ANNOTATIONS ───────────────────────────────────────────
    if (Array.isArray(data.annotations) && data.annotations.length > 0) {
        try {
            const payload = data.annotations
                .filter(a => a.video_id && a.timestamp_sec !== undefined && a.note)
                .map(a => ({
                    id:            a.id,
                    video_id:      a.video_id,
                    timestamp_sec: a.timestamp_sec,
                    note:          a.note,
                    created_at:    a.created_at || new Date().toISOString()
                }));

            if (payload.length > 0) {
                const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/annotations`, {
                    method: 'POST',
                    headers: { ...BASE_HEADERS, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    results.annotations = payload.length;
                } else {
                    const errText = await res.text();
                    console.warn(`annotations batch insert başarısız (HTTP ${res.status}): ${errText}`);
                    results.errors.push('annotations');
                }
            }
        } catch (e) {
            console.warn('annotations içe aktarma hatası:', e);
            results.errors.push('annotations');
        }
    }

    // ── PLAYLISTS + PLAYLIST_VIDEOS ───────────────────────────
    if (Array.isArray(data.playlists) && data.playlists.length > 0) {
        try {
            const playlistIdMap = {};

            for (const pl of data.playlists) {
                if (!pl.name) continue;

                let existingId = null;
                try {
                    const checkRes = await fetchWithRetry(
                        `${SUPABASE_URL}/rest/v1/playlists?name=eq.${encodeURIComponent(pl.name)}&select=id`,
                        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
                    );
                    if (checkRes.ok) {
                        const rows = await checkRes.json();
                        if (rows.length > 0) existingId = rows[0].id;
                    }
                } catch (e) { /* kontrol başarısız, eklemeye devam */ }

                if (existingId !== null) {
                    playlistIdMap[pl.id] = existingId;
                } else {
                    try {
                        const insRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/playlists`, {
                            method: 'POST',
                            headers: { ...BASE_HEADERS, 'Prefer': 'return=representation' },
                            body: JSON.stringify({ name: pl.name, color: pl.color || '#ff007f' })
                        });
                        if (insRes.ok) {
                            const rows = await insRes.json();
                            const newPl = Array.isArray(rows) ? rows[0] : rows;
                            if (newPl?.id) {
                                playlistIdMap[pl.id] = newPl.id;
                                results.playlists++;
                            }
                        } else {
                            results.errors.push(`playlist:${pl.name}`);
                        }
                    } catch (e) {
                        console.warn(`Playlist eklenemedi (${pl.name}):`, e);
                        results.errors.push(`playlist:${pl.name}`);
                    }
                }
            }

            if (Array.isArray(data.playlist_videos) && data.playlist_videos.length > 0) {
                const pvPayload = data.playlist_videos
                    .filter(pv => pv.playlist_id && pv.video_id && playlistIdMap[pv.playlist_id])
                    .map(pv => ({
                        playlist_id: playlistIdMap[pv.playlist_id],
                        video_id:    pv.video_id
                    }));

                if (pvPayload.length > 0) {
                    try {
                        const pvRes = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/playlist_videos`, {
                            method: 'POST',
                            headers: { ...BASE_HEADERS, 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
                            body: JSON.stringify(pvPayload)
                        });
                        if (pvRes.ok) {
                            results.playlistVideos = pvPayload.length;
                        } else {
                            const errText = await pvRes.text();
                            console.warn(`playlist_videos insert başarısız: ${errText}`);
                            results.errors.push('playlist_videos');
                        }
                    } catch (e) {
                        console.warn('playlist_videos içe aktarma hatası:', e);
                        results.errors.push('playlist_videos');
                    }
                }
            }
        } catch (e) {
            console.warn('Playlist içe aktarma genel hatası:', e);
            results.errors.push('playlists');
        }
    }

    return results;
}

// ================================================================
// 4. BAŞARI MESAJI OLUŞTURUCU
// ================================================================
function buildSuccessMessage(insertedVideos, skippedVideos, insertedFavorites, phase2, backupVersion) {
    const isOld = backupVersion === '1.0';

    if (currentLang === 'tr') {
        let msg = `✅ İçe aktarma tamamlandı!`;
        if (isOld) msg += ` (v1.0 yedek)`;
        msg += `\n\n`;
        msg += `📹 Video: ${insertedVideos} eklendi, ${skippedVideos} zaten vardı\n`;
        msg += `⭐ Favori: ${insertedFavorites} eklendi\n`;
        if (!isOld) {
            if (phase2.tagColors > 0)
                msg += `🎨 Etiket rengi: ${phase2.tagColors} güncellendi\n`;
            if (phase2.videoLinks > 0 || phase2.videoLinksSkipped > 0) {
                const total = phase2.videoLinks + phase2.videoLinksSkipped;
                msg += `🔗 Kombinasyon bağlantısı: ${phase2.videoLinks} eklendi`;
                if (phase2.videoLinksSkipped > 0) msg += `, ${phase2.videoLinksSkipped} zaten vardı`;
                msg += `\n`;
            }
            if (phase2.annotations > 0)
                msg += `📝 Video notu: ${phase2.annotations} eklendi\n`;
            if (phase2.playlists > 0)
                msg += `🎵 Oynatma listesi: ${phase2.playlists} oluşturuldu\n`;
            if (phase2.playlistVideos > 0)
                msg += `   └─ ${phase2.playlistVideos} video listeye bağlandı\n`;
            if (phase2.errors.length > 0)
                msg += `\n⚠️ Bazı ek veriler eklenemedi: ${phase2.errors.join(', ')}`;
        }
        return msg;
    } else {
        let msg = `✅ Import completed!`;
        if (isOld) msg += ` (v1.0 backup)`;
        msg += `\n\n`;
        msg += `📹 Videos: ${insertedVideos} added, ${skippedVideos} already existed\n`;
        msg += `⭐ Favorites: ${insertedFavorites} added\n`;
        if (!isOld) {
            if (phase2.tagColors > 0)
                msg += `🎨 Tag colors: ${phase2.tagColors} updated\n`;
            if (phase2.videoLinks > 0 || phase2.videoLinksSkipped > 0) {
                msg += `🔗 Combination links: ${phase2.videoLinks} added`;
                if (phase2.videoLinksSkipped > 0) msg += `, ${phase2.videoLinksSkipped} already existed`;
                msg += `\n`;
            }
            if (phase2.annotations > 0)
                msg += `📝 Video notes: ${phase2.annotations} added\n`;
            if (phase2.playlists > 0)
                msg += `🎵 Playlists: ${phase2.playlists} created\n`;
            if (phase2.playlistVideos > 0)
                msg += `   └─ ${phase2.playlistVideos} videos linked\n`;
            if (phase2.errors.length > 0)
                msg += `\n⚠️ Some secondary data could not be imported: ${phase2.errors.join(', ')}`;
        }
        return msg;
    }
}

// ================================================================
// 5. YARDIMCI FONKSİYONLAR (geriye dönük uyumluluk)
// ================================================================
export function downloadBackup(videos, instructors, favorites) {
    return exportToJSON(videos, instructors, favorites);
}

export function validateImportFile(data) {
    return (
        data &&
        data.data &&
        Array.isArray(data.data.videos) &&
        Array.isArray(data.data.instructors)
    );
}