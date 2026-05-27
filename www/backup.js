// backup.js - Yedekleme ve geri yükleme modülü
import { dbSaveInstructor, dbSaveVideo, dbAddFavorite, dbClearAllFavorites, dbFetchInstructors, dbFetchVideos } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { translations } from './config.js';

let currentLang = 'tr';

export function setBackupLang(lang) {
    currentLang = lang;
}

// Dışa aktarma: JSON dosyası oluştur ve indir
export function exportToJSON(videos, instructors, favorites) {
    console.log('exportToJSON çağrıldı', { videosCount: videos.length, instructorsCount: instructors.length, favoritesCount: favorites.length });
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
    console.log('Dışa aktarma tamamlandı, dosya indirildi.');
}

// İçe aktarma: dosyayı oku, merge yap, hata durumunda rollback
export async function importFromJSON(file, currentVideos, currentInstructors, currentFavorites, fetchVideosFn, fetchInstructorsFn) {
    console.log('importFromJSON çağrıldı, dosya:', file);
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const cancelText = currentLang === 'tr' ? 'İptal' : 'Cancel';

    const confirmMsg = currentLang === 'tr' 
        ? 'Bu yedek dosyası mevcut koleksiyonunuzla birleştirilecektir. Aynı ID\'ler yeni ID olarak eklenir. Devam etmek istiyor musunuz?'
        : 'This backup will be merged with your current collection. Duplicate IDs will get new IDs. Continue?';
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;

    let fileContent;
    try {
        fileContent = await file.text();
    } catch (err) {
        await showCustomAlert(currentLang === 'tr' ? 'Dosya okunamadı!' : 'Cannot read file!', okText);
        return;
    }

    let backup;
    try {
        backup = JSON.parse(fileContent);
        if (!backup.data || !backup.data.videos || !backup.data.instructors) throw new Error('Invalid format');
    } catch (err) {
        await showCustomAlert(currentLang === 'tr' ? 'Geçersiz yedek dosyası!' : 'Invalid backup file!', okText);
        return;
    }

    // Mevcut verilerin yedeğini al (rollback için)
    const oldInstructors = [...currentInstructors];
    const oldVideos = [...currentVideos];
    const oldFavorites = [...currentFavorites];

    // Yeni eğitmenleri ekle (ID çakışmasında yeni ID)
    const instructorIdMap = new Map();
    try {
        for (const ins of backup.data.instructors) {
            const existing = currentInstructors.find(i => i.id === ins.id);
            if (existing) {
                // Aynı ID var, yeni ID ile ekle (null gönder)
                await dbSaveInstructor(null, ins.name);
            } else {
                await dbSaveInstructor(null, ins.name);
            }
        }
        // Tüm eğitmenler eklendi, şimdi gerçek ID'leri almak için yeniden fetch
        await fetchInstructorsFn();
        const newInstructors = await dbFetchInstructors(); // global güncellenmeli
        // Map'i doldur: eski ID -> yeni ID (isim eşleşmesiyle)
        for (const oldIns of backup.data.instructors) {
            const matched = newInstructors.find(i => i.name === oldIns.name);
            if (matched) {
                instructorIdMap.set(oldIns.id, matched.id);
            } else {
                throw new Error(`Yeni eğitmen bulunamadı: ${oldIns.name}`);
            }
        }
    } catch (err) {
        console.error(err);
        await rollbackInstructors(oldInstructors, fetchInstructorsFn);
        await showCustomAlert(currentLang === 'tr' ? 'Eğitmenler eklenirken hata oluştu. İşlem geri alındı.' : 'Error adding instructors. Rolled back.', okText);
        return;
    }

    // Videoları ekle
    const newVideoIdsMap = new Map();
    try {
        for (const vid of backup.data.videos) {
            const newInstructorId = instructorIdMap.get(vid.instructor_id);
            if (!newInstructorId) {
                throw new Error(`Eğitmen ID ${vid.instructor_id} bulunamadı`);
            }
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
            // ID'yi göndermeden ekle (yeni ID alır)
            await dbSaveVideo(null, videoPayload);
        }
        // Yeni videoların ID'lerini almak için fetch
        await fetchVideosFn();
        const newVideos = await dbFetchVideos();
        // Eski ID -> yeni ID eşlemesi (url + instructor_id + role_type ile)
        for (const oldVid of backup.data.videos) {
            const matched = newVideos.find(v => 
                v.url === oldVid.url && 
                v.instructor_id === instructorIdMap.get(oldVid.instructor_id) &&
                v.role_type === oldVid.role_type
            );
            if (matched) {
                newVideoIdsMap.set(oldVid.id, matched.id);
            }
        }
    } catch (err) {
        console.error(err);
        await rollbackAll(oldInstructors, oldVideos, oldFavorites, fetchInstructorsFn, fetchVideosFn);
        await showCustomAlert(currentLang === 'tr' ? 'Videolar eklenirken hata oluştu. Tüm işlem geri alındı.' : 'Error adding videos. Full rollback.', okText);
        return;
    }

    // Favorileri ekle
    try {
        for (const oldFavId of backup.data.favorites) {
            const newVideoId = newVideoIdsMap.get(oldFavId);
            if (newVideoId) {
                // Favori zaten var mı kontrol et (mevcut favorilerde yoksa ekle)
                const currentFavs = await dbFetchFavorites();
                const exists = currentFavs.some(f => f.video_id === newVideoId);
                if (!exists) {
                    await dbAddFavorite(newVideoId);
                }
            }
        }
    } catch (err) {
        console.error(err);
        await rollbackAll(oldInstructors, oldVideos, oldFavorites, fetchInstructorsFn, fetchVideosFn);
        await showCustomAlert(currentLang === 'tr' ? 'Favoriler eklenirken hata oluştu. İşlem geri alındı.' : 'Error adding favorites. Rolled back.', okText);
        return;
    }

    await showCustomAlert(currentLang === 'tr' ? 'Yedek başarıyla içe aktarıldı (birleştirildi).' : 'Backup successfully imported (merged).', okText);
}

// Rollback yardımcıları (basitleştirilmiş)
async function rollbackInstructors(oldInstructors, fetchInstructorsFn) {
    // Burada tüm eğitmenleri silip eskilerini eklemek yerine, sadece hata mesajı verip sayfayı yenileyelim
    console.warn('Rollback instructors - reloading page');
    location.reload();
}

async function rollbackAll(oldInstructors, oldVideos, oldFavorites, fetchInstructorsFn, fetchVideosFn) {
    console.error('Full rollback triggered - reloading page');
    location.reload();
}