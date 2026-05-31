// tangoVeritabani.js - YENİ: Sadece re-export (modüler hale getirildi)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Veritabanı modüllerinden fonksiyonları içe aktar
import { dbFetchVideos, dbDeleteVideo, dbSaveVideo, dbUpdateTagsDirectly, dbUpdateNote } from './db/videos.js';
import { dbFetchInstructors, dbSaveInstructor, dbDeleteInstructor } from './db/instructors.js';
import { dbFetchFavorites, dbAddFavorite, dbRemoveFavorite, dbClearAllFavorites } from './db/favorites.js';
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './db/tags.js';

// Aynı isimlerle dışa aktar (eski kodlar hiç değişmeden çalışmaya devam eder)
export { 
    dbFetchVideos, dbDeleteVideo, dbSaveVideo, dbUpdateTagsDirectly, dbUpdateNote, dbUpdateLearningStatus,
    dbFetchInstructors, dbSaveInstructor, dbDeleteInstructor,
    dbFetchFavorites, dbAddFavorite, dbRemoveFavorite, dbClearAllFavorites,
    dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags
};

// Yardımcı fonksiyon (bağımlılığı yok, burada kalsın)
export function detectPlatform(url, isDownloaded) {
    if (isDownloaded) return 'drive';
    if (!url) return 'other';
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
    return 'other';
}
