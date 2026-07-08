// tangoVeritabani.js - Tüm veritabanı fonksiyonlarının merkezi export noktası
// ✅ GÜNCELLEME: Tüm db/ fonksiyonları wrapper'a eklendi — tek erişim noktası

// videos
import {
    dbFetchVideos,
    dbFetchVideosPage,
    dbFetchVideosCount,
    dbDeleteVideo,
    dbSaveVideo,
    dbUpdateTagsDirectly,
    dbUpdateNote,
    dbUpdateLearningStatus,
    dbIncrementPracticeCount,
    dbResetPracticeCount
} from './db/videos.js';

// instructors
import {
    dbFetchInstructors,
    dbSaveInstructor,
    dbDeleteInstructor,
    dbUpdateInstructorProfile
} from './db/instructors.js';

// favorites
import {
    dbFetchFavorites,
    dbAddFavorite,
    dbRemoveFavorite,
    dbClearAllFavorites
} from './db/favorites.js';

// tags
import {
    dbMergeTags,
    dbDeleteTagFromAllVideos,
    dbRenameTag,
    dbCleanupUnusedTags
} from './db/tags.js';

// playlists
import {
    dbFetchPlaylists,
    dbCreatePlaylist,
    dbUpdatePlaylist,
    dbDeletePlaylist,
    dbFetchPlaylistVideoIds,
    dbAddVideoToPlaylist,
    dbRemoveVideoFromPlaylist,
    dbFetchAllPlaylistVideos
} from './db/playlists.js';

// annotations
import {
    dbFetchAnnotations,
    dbFetchAllAnnotations,
    dbAddAnnotation,
    dbDeleteAnnotation
} from './db/annotations.js';

// videoLinks
import {
    dbFetchAllVideoLinks,
    dbFetchVideoLinks,
    dbAddVideoLink,
    dbDeleteVideoLink
} from './db/videoLinks.js';

// tagColors
import {
    dbFetchTagColors,
    dbSetTagColor,
    dbDeleteTagColor
} from './db/tagColors.js';

// healthCheck
import {
    dbRunTagSyncCheck,
    dbRepairTagSync
} from './db/healthCheck.js';

// monthlyStats
import {
    dbFetchMonthlyStats,
    dbFetchCurrentMonthStat,
    dbIncrementMonthlyPracticeCount
} from './db/monthlyStats.js';

// practiceSessions
import {
    dbSavePracticeSession,
    dbFetchPracticeSessions,
    dbDeletePracticeSession
} from './db/practiceSessions.js';

// practiceList
import {
    dbFetchPracticeList,
    dbAddToPracticeList,
    dbRemoveFromPracticeList,
    dbClearPracticeList
} from './db/practiceList.js';

// ─────────────────────────────────────────────────────────────
// Tüm fonksiyonları dışa aktar
// ─────────────────────────────────────────────────────────────
export {
    // videos
    dbFetchVideos,
    dbFetchVideosPage,
    dbFetchVideosCount,
    dbDeleteVideo,
    dbSaveVideo,
    dbUpdateTagsDirectly,
    dbUpdateNote,
    dbUpdateLearningStatus,
    dbIncrementPracticeCount,
    dbResetPracticeCount,
    // instructors
    dbFetchInstructors,
    dbSaveInstructor,
    dbDeleteInstructor,
    dbUpdateInstructorProfile,
    // favorites
    dbFetchFavorites,
    dbAddFavorite,
    dbRemoveFavorite,
    dbClearAllFavorites,
    // tags
    dbMergeTags,
    dbDeleteTagFromAllVideos,
    dbRenameTag,
    dbCleanupUnusedTags,
    // playlists
    dbFetchPlaylists,
    dbCreatePlaylist,
    dbUpdatePlaylist,
    dbDeletePlaylist,
    dbFetchPlaylistVideoIds,
    dbAddVideoToPlaylist,
    dbRemoveVideoFromPlaylist,
    dbFetchAllPlaylistVideos,
    // annotations
    dbFetchAnnotations,
    dbFetchAllAnnotations,
    dbAddAnnotation,
    dbDeleteAnnotation,
    // videoLinks
    dbFetchAllVideoLinks,
    dbFetchVideoLinks,
    dbAddVideoLink,
    dbDeleteVideoLink,
    // tagColors
    dbFetchTagColors,
    dbSetTagColor,
    dbDeleteTagColor,
    // healthCheck
    dbRunTagSyncCheck,
    dbRepairTagSync,
    // monthlyStats
    dbFetchMonthlyStats,
    dbFetchCurrentMonthStat,
    dbIncrementMonthlyPracticeCount,
    // practiceSessions
    dbSavePracticeSession,
    dbFetchPracticeSessions,
    dbDeletePracticeSession,
    // practiceList
    dbFetchPracticeList,
    dbAddToPracticeList,
    dbRemoveFromPracticeList,
    dbClearPracticeList
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