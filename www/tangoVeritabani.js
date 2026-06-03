// tangoVeritabani.js - Tüm veritabanı fonksiyonlarının merkezi export noktası
// ✅ GÜNCELLEME (Adım 2.4): playlist fonksiyonları eklendi
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// videos
import {
    dbFetchVideos,
    dbFetchVideosPage,
    dbFetchVideosCount,
    dbDeleteVideo,
    dbSaveVideo,
    dbUpdateTagsDirectly,
    dbUpdateNote,
    dbUpdateLearningStatus
} from './db/videos.js';

// instructors
import { dbFetchInstructors, dbSaveInstructor, dbDeleteInstructor } from './db/instructors.js';

// favorites
import { dbFetchFavorites, dbAddFavorite, dbRemoveFavorite, dbClearAllFavorites } from './db/favorites.js';

// tags (toplu işlemler)
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './db/tags.js';

// ✅ YENİ (Adım 2.4): playlists
import {
    dbFetchPlaylists,
    dbCreatePlaylist,
    dbUpdatePlaylist,
    dbDeletePlaylist,
    dbFetchPlaylistVideoIds,
    dbAddVideoToPlaylist,
    dbRemoveVideoFromPlaylist
} from './db/playlists.js';

// Tüm fonksiyonları dışa aktar
export {
    dbFetchVideos,
    dbFetchVideosPage,
    dbFetchVideosCount,
    dbDeleteVideo,
    dbSaveVideo,
    dbUpdateTagsDirectly,
    dbUpdateNote,
    dbUpdateLearningStatus,
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
    dbCleanupUnusedTags,
    // ✅ YENİ (Adım 2.4)
    dbFetchPlaylists,
    dbCreatePlaylist,
    dbUpdatePlaylist,
    dbDeletePlaylist,
    dbFetchPlaylistVideoIds,
    dbAddVideoToPlaylist,
    dbRemoveVideoFromPlaylist
};

// Yardımcı fonksiyon
export function detectPlatform(url, isDownloaded) {
    if (isDownloaded) return 'drive';
    if (!url) return 'other';
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('instagram.com')) return 'instagram';
    if (u.includes('facebook.com') || u.includes('fb.com')) return 'facebook';
    return 'other';
}