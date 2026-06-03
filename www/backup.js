// backup.js - Yedekleme ve geri yükleme modülü
// ✅ GÜNCELLEME (Adım 1.1): İçe aktarma sonucu mesajları persistent: true ile gösteriliyor
// ✅ GÜNCELLEME (Adım 8.2): İçe aktarma artık tek bir atomik veritabanı işlemi
//    (import_backup RPC) ile yapılır.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, fetchWithRetry } from './utils.js';

let currentLang = 'tr';

export function setBackupLang(lang) {
    currentLang = lang;
}

// ================= DIŞA AKTAR (Export) =================
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

// ================= İÇE AKTARMA (Import) — ATOMİK RPC İLE =================
/**
 * importFromJSON — Yedek dosyasını içe aktar
 * 
 * ✅ ADIM 1.1: Başarı ve hata mesajları artık persistent: true ile gösterilir
 *    (3 saniye sonra kaybolan toast yerine "Tamam" ile kapanan modal)
 * 
 * @param {File} file - Yüklenen JSON dosyası
 * @param {Array} currentVideos - Mevcut videolar
 * @param {Array} currentInstructors - Mevcut eğitmenler
 * @param {Array} currentFavorites - Mevcut favoriler
 * @param {Function} fetchVideosFn - Videoları yeniden çekme fonksiyonu
 * @param {Function} fetchInstructorsFn - Eğitmenleri yeniden çekme fonksiyonu
 */
export async function importFromJSON(file, currentVideos, currentInstructors, currentFavorites, fetchVideosFn, fetchInstructorsFn) {
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';

    // 1. Kullanıcıdan onay iste
    const confirmMsg = currentLang === 'tr'
        ? 'Bu yedek mevcut koleksiyonunuzla birleştirilecek. Aynı videolar (URL) tekrar eklenmez. İşlem tek bir veritabanı hareketi olarak yapılır: ya tamamı eklenir ya da hiçbiri. Devam edilsin mi?'
        : 'This backup will be merged with your current collection. Duplicate videos (URL) are skipped. The whole operation runs as a single database transaction: all-or-nothing. Continue?';
    
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) {
        return;
    }

    // 2. Dosyayı oku
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            showLoading(true);
            
            const content = e.target.result;
            const importData = JSON.parse(content);

            // Veri doğrulaması
            if (!importData.data || !importData.data.videos || !Array.isArray(importData.data.videos)) {
                showLoading(false);
                const errorMsg = currentLang === 'tr'
                    ? 'Dosya geçersiz veya bozuk. Lütfen daha önce dışa aktarılan bir yedek dosyasını seçin.'
                    : 'File is invalid or corrupted. Please select a backup file exported previously.';
                
                // ✅ ADIM 1.1: Hata mesajı persistent modal ile gösterilir
                await showCustomAlert(errorMsg, okText, true);
                return;
            }

            // 3. RPC çağrısı: import_backup (atomik işlem)
            const response = await fetchWithRetry(
                `${SUPABASE_URL}/rest/v1/rpc/import_backup`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${window.__tangoAuthToken || SUPABASE_KEY}`
                    },
                    body: JSON.stringify({
                        p_videos: importData.data.videos,
                        p_instructors: importData.data.instructors
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`İçe aktarma başarısız: ${response.status}`);
            }

            const result = await response.json();
            showLoading(false);

            // 4. Başarı mesajı (eklenen video sayısı)
            const addedCount = result.added_count || 0;
            const successMsg = currentLang === 'tr'
                ? `✅ ${addedCount} video başarıyla içe aktarıldı!`
                : `✅ ${addedCount} video(s) imported successfully!`;
            
            // ✅ ADIM 1.1: Başarı mesajı persistent modal ile gösterilir
            await showCustomAlert(successMsg, okText, true);

            // 5. Veri yenile
            if (fetchVideosFn) await fetchVideosFn();
            if (fetchInstructorsFn) await fetchInstructorsFn();

        } catch (err) {
            showLoading(false);
            console.error('İçe aktarma hatası:', err);

            const errorMsg = currentLang === 'tr'
                ? `Hata: ${err.message}`
                : `Error: ${err.message}`;
            
            // ✅ ADIM 1.1: Hata mesajı persistent modal ile gösterilir
            await showCustomAlert(errorMsg, okText, true);
        }
    };

    reader.onerror = async () => {
        const errorMsg = currentLang === 'tr'
            ? 'Dosya okunamadı. Lütfen tekrar deneyin.'
            : 'Could not read file. Please try again.';
        
        // ✅ ADIM 1.1: Dosya okuma hatası persistent modal ile gösterilir
        await showCustomAlert(errorMsg, okText, true);
    };

    reader.readAsText(file);
}

// ================= YARDIMCI FONKSİYONLAR =================

/**
 * downloadBackup — Yedek dosyasını indir (export fonksiyonunun alternatifi)
 */
export function downloadBackup(videos, instructors, favorites) {
    exportToJSON(videos, instructors, favorites);
}

/**
 * validateImportFile — Yedek dosyasının geçerli olduğunu kontrol et
 */
export function validateImportFile(data) {
    return (
        data &&
        data.data &&
        Array.isArray(data.data.videos) &&
        Array.isArray(data.data.instructors)
    );
}