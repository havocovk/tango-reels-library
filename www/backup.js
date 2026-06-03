// backup.js - Yedekleme ve geri yükleme modülü
// ✅ GÜNCELLEME (Adım 8.2): İçe aktarma artık tek bir atomik veritabanı işlemi
//    (import_backup RPC) ile yapılır. Eski tek tek ekleme döngüleri ve
//    performRollback fonksiyonu kaldırıldı; geri alma işini veritabanı yapar.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, fetchWithRetry } from './utils.js';

let currentLang = 'tr';

export function setBackupLang(lang) {
    currentLang = lang;
}

// --------------------------------------------------------------
// 1. DIŞA AKTAR (Export) — değişmedi
// --------------------------------------------------------------
export function exportToJSON(videos, instructors, favorites) {
    const exportData = {
        version: '1.0',
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
            favorites: favorites
        }
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tango_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --------------------------------------------------------------
// 2. İÇE AKTARMA (Import) — ATOMİK RPC İLE (Adım 8.2)
//    Tüm yedek tek bir veritabanı işlemine gönderilir:
//    ya tamamı eklenir ya da hata olursa hiçbiri (otomatik geri alma).
// --------------------------------------------------------------
export async function importFromJSON(file, currentVideos, currentInstructors, currentFavorites, fetchVideosFn, fetchInstructorsFn) {
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';

    const confirmMsg = currentLang === 'tr'
        ? 'Bu yedek mevcut koleksiyonunuzla birleştirilecek. Aynı videolar (URL) tekrar eklenmez. İşlem tek bir veritabanı hareketi olarak yapılır: ya tamamı eklenir ya da hiçbiri. Devam edilsin mi?'
        : 'This backup will be merged with your current collection. Duplicate videos (URL) are skipped. The whole operation runs as a single database transaction: all-or-nothing. Continue?';
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;

    // --- Dosyayı oku ve doğrula ---
    let backup;
    try {
        const fileContent = await file.text();
        backup = JSON.parse(fileContent);
        if (!backup.data || !Array.isArray(backup.data.videos) || !Array.isArray(backup.data.instructors)) {
            throw new Error('Invalid format');
        }
    } catch (err) {
        await showCustomAlert(currentLang === 'tr' ? 'Geçersiz yedek dosyası!' : 'Invalid backup file!', okText);
        return;
    }

    showLoading(true);

    try {
        // --- Tek RPC çağrısı: eğitmenler + videolar + favoriler tek seferde ---
        const payload = {
            backup_json: {
                instructors: backup.data.instructors || [],
                videos: backup.data.videos || [],
                favorites: backup.data.favorites || []
            }
        };

        const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/rpc/import_backup`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `HTTP ${res.status}`);
        }

        const result = await res.json();

        // --- Ekrandaki listeleri tazele ---
        await fetchInstructorsFn();
        await fetchVideosFn();

        showLoading(false);

        const insertedVideos = (result && result.insertedVideos) || 0;
        const skippedVideos = (result && result.skippedVideos) || 0;
        const insertedFavorites = (result && result.insertedFavorites) || 0;

        const successMsg = currentLang === 'tr'
            ? `Yedek içe aktarıldı ✓ ${insertedVideos} video, ${insertedFavorites} favori eklendi (${skippedVideos} zaten vardı).`
            : `Backup imported ✓ ${insertedVideos} videos, ${insertedFavorites} favorites added (${skippedVideos} already existed).`;
        await showCustomAlert(successMsg, okText);

    } catch (err) {
        console.error('İçe aktarma hatası:', err);
        showLoading(false);
        await showCustomAlert(currentLang === 'tr'
            ? `İçe aktarma başarısız: ${err.message}. Tek işlem olduğu için hiçbir değişiklik kaydedilmedi.`
            : `Import failed: ${err.message}. As a single transaction, no changes were saved.`, okText);
    }
}