// tangoVeritabani.js - Tüm veritabanı fonksiyonlarının merkezi export noktası
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// videos
import { 
    dbFetchVideos, 
    dbDeleteVideo, 
    dbSaveVideo, 
    dbUpdateTagsDirectly, 
    dbUpdateNote,
    dbUpdateLearningStatus   // 🔥 YENİ: eklendi
} from './db/videos.js';

// instructors
import { dbFetchInstructors, dbSaveInstructor, dbDeleteInstructor } from './db/instructors.js';

// favorites
import { dbFetchFavorites, dbAddFavorite, dbRemoveFavorite, dbClearAllFavorites } from './db/favorites.js';

// tags (toplu işlemler)
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './db/tags.js';

// Tüm fonksiyonları dışa aktar
export { 
    dbFetchVideos, 
    dbDeleteVideo, 
    dbSaveVideo, 
    dbUpdateTagsDirectly, 
    dbUpdateNote,
    dbUpdateLearningStatus,   // 🔥 YENİ
    dbFetchInstructors, 
    dbSaveInstructor, 
    dbDeleteInstructor,
    dbFetchFavorites, 
    dbAddFavorite, 
    dbRemoveFavorite, 
    dbClearAllFavorites,
    dbMergeTags, 
    dbDeleteTagFromAllVideos, 
    dbRenameTag, 
    dbCleanupUnusedTags
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
