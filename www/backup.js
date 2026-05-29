// backup.js - Yedekleme ve geri yükleme modülü (Eğitmen çakışması düzeltildi)
import { dbSaveInstructor, dbSaveVideo, dbAddFavorite, dbFetchInstructors, dbFetchVideos, dbFetchFavorites, dbDeleteInstructor, dbDeleteVideo, dbClearAllFavorites } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading } from './utils.js';
import { translations } from './i18n.js';

let currentLang = 'tr';

export function setBackupLang(lang) {
    currentLang = lang;
}

// --------------------------------------------------------------
// 1. DIŞA AKTAR (Export)
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
// 2. İÇE AKTARMA (Import) - Eğitmen çakışması düzeltildi
// --------------------------------------------------------------
export async function importFromJSON(file, currentVideos, currentInstructors, currentFavorites, fetchVideosFn, fetchInstructorsFn) {
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';

    const confirmMsg = currentLang === 'tr' 
        ? 'Bu yedek dosyası mevcut koleksiyonunuzla birleştirilecektir. Aynı ID\'ler yeni ID olarak eklenir. Devam etmek istiyor musunuz?'
        : 'This backup will be merged with your current collection. Duplicate IDs will get new IDs. Continue?';
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;

    showLoading(true);

    let backup;
    try {
        const fileContent = await file.text();
        backup = JSON.parse(fileContent);
        if (!backup.data || !backup.data.videos || !backup.data.instructors) throw new Error('Invalid format');
    } catch (err) {
        showLoading(false);
        await showCustomAlert(currentLang === 'tr' ? 'Geçersiz yedek dosyası!' : 'Invalid backup file!', okText);
        return;
    }

    const oldInstructors = [...currentInstructors];
    const oldVideos = [...currentVideos];
    const oldFavorites = [...currentFavorites];
    const newInstructorIds = [];
    const newVideoIds = [];
    const instructorIdMap = new Map();
    const videoIdMap = new Map();

    try {
        // ========== ADIM 1: Eğitmenleri ekle (aynı isim varsa onu kullan) ==========
        for (const ins of backup.data.instructors) {
            // Önce mevcut eğitmenlerde aynı isim var mı?
            let existingInstructor = currentInstructors.find(i => i.name === ins.name);
            if (!existingInstructor) {
                // Aynı isimde yoksa yeni ekle
                await dbSaveInstructor(null, ins.name);
            }
        }
        // Tüm eğitmenleri yeniden çek
        await fetchInstructorsFn();
        const freshInstructors = await dbFetchInstructors();
        // Eski ID -> yeni ID eşlemesi (isim bazlı)
        for (const oldIns of backup.data.instructors) {
            const matched = freshInstructors.find(i => i.name === oldIns.name);
            if (matched) {
                instructorIdMap.set(oldIns.id, matched.id);
                // Yeni eklenenleri rollback listesine ekle (eski listede yoksa)
                if (!oldInstructors.some(i => i.id === matched.id)) {
                    newInstructorIds.push(matched.id);
                }
            } else {
                throw new Error(`Yeni eğitmen bulunamadı: ${oldIns.name}`);
            }
        }

        // ========== ADIM 2: Videoları ekle ==========
        for (const vid of backup.data.videos) {
            const newInstructorId = instructorIdMap.get(vid.instructor_id);
            if (!newInstructorId) throw new Error(`Eğitmen ID ${vid.instructor_id} eşlenemedi`);
            const videoPayload = {
                url: vid.url,
                instructor_id: newInstructorId,
                role_type: vid.role_type,
                partner_name: vid.partner_name,
                tags: vid.tags,
                is_downloaded: vid.is_downloaded,
                drive_url: vid.drive_url,
                cover_url: vid.cover_url,
                platform: vid.platform,
                notes: vid.notes
            };
            await dbSaveVideo(null, videoPayload);
        }
        await fetchVideosFn();
        const freshVideos = await dbFetchVideos();
        for (const oldVid of backup.data.videos) {
            const matched = freshVideos.find(v => 
                v.url === oldVid.url && 
                v.instructor_id === instructorIdMap.get(oldVid.instructor_id) &&
                v.role_type === oldVid.role_type
            );
            if (matched) {
                videoIdMap.set(oldVid.id, matched.id);
                if (!oldVideos.some(v => v.id === matched.id)) {
                    newVideoIds.push(matched.id);
                }
            } else {
                throw new Error(`Yeni video bulunamadı: ${oldVid.url}`);
            }
        }

        // ========== ADIM 3: Favorileri ekle ==========
        for (const oldFavId of backup.data.favorites) {
            const newVideoId = videoIdMap.get(oldFavId);
            if (newVideoId) {
                const currentFavs = await dbFetchFavorites();
                const exists = currentFavs.some(f => f.video_id === newVideoId);
                if (!exists) {
                    await dbAddFavorite(newVideoId);
                }
            }
        }

        showLoading(false);
        await showCustomAlert(currentLang === 'tr' ? 'Yedek başarıyla içe aktarıldı (birleştirildi).' : 'Backup successfully imported (merged).', okText);

    } catch (err) {
        console.error('İçe aktarma hatası:', err);
        showLoading(false);
        await performRollback(newInstructorIds, newVideoIds, oldFavorites, fetchInstructorsFn, fetchVideosFn);
        await showCustomAlert(currentLang === 'tr' 
            ? `İçe aktarma başarısız oldu. Hata: ${err.message}. Yapılan tüm değişiklikler geri alındı.` 
            : `Import failed: ${err.message}. All changes have been rolled back.`, okText);
    }
}

// --------------------------------------------------------------
// 3. ROLLBACK FONKSİYONU
// --------------------------------------------------------------
async function performRollback(newInstructorIds, newVideoIds, oldFavorites, fetchInstructorsFn, fetchVideosFn) {
    console.log('Rollback başlıyor...', { newInstructorIds, newVideoIds });
    try {
        for (const vidId of newVideoIds) {
            await dbDeleteVideo(vidId).catch(e => console.warn(`Video ${vidId} silinemedi:`, e));
        }
        for (const insId of newInstructorIds) {
            await dbDeleteInstructor(insId).catch(e => console.warn(`Eğitmen ${insId} silinemedi:`, e));
        }
        await dbClearAllFavorites();
        for (const favId of oldFavorites) {
            await dbAddFavorite(favId).catch(e => console.warn(`Favori ${favId} eklenemedi:`, e));
        }
        await fetchInstructorsFn();
        await fetchVideosFn();
        console.log('Rollback tamamlandı.');
    } catch (rollbackErr) {
        console.error('Rollback sırasında hata:', rollbackErr);
        location.reload();
    }
}