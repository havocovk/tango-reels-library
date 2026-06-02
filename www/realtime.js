// realtime.js - Supabase Realtime ile cihazlar arası anlık senkronizasyon
// ✅ YENİ (Adım 4.2)
import { supabase } from './supabaseClient.js';
import { store } from './store.js';

// Açtığımız kanalı burada saklarız ki yanlışlıkla iki kere açılmasın.
let channel = null;

// Realtime'dan gelen video kaydının içinde eğitmen ADI bulunmaz;
// sadece instructor_id gelir. Bu yardımcı fonksiyon, store'daki
// eğitmen listesinden adı bulup videoya ekler (kartta "Bilinmeyen
// Eğitmen" yazmaması için).
function enrichWithInstructorName(video) {
    const instructors = store.get('globalInstructors') || [];
    const found = instructors.find(ins => ins.id === video.instructor_id);
    return {
        ...video,
        instructor_name: found ? found.name : 'Bilinmeyen Eğitmen'
    };
}

// videos tablosundaki INSERT / UPDATE / DELETE olaylarını işler
function handleVideoChange(payload) {
    const eventType = payload.eventType;

    if (eventType === 'INSERT') {
        const newVideo = enrichWithInstructorName(payload.new);
        const existing = store.get('globalVideos') || [];
        // Bu videoyu zaten bu cihaz eklediyse listede vardır → tekrar ekleme
        if (!existing.some(v => v.id === newVideo.id)) {
            store.addVideoLocally(newVideo);
        }
    } else if (eventType === 'UPDATE') {
        const updatedVideo = enrichWithInstructorName(payload.new);
        store.updateVideoLocally(updatedVideo.id, updatedVideo);
    } else if (eventType === 'DELETE') {
        const deletedId = payload.old ? payload.old.id : null;
        if (deletedId !== null && deletedId !== undefined) {
            store.removeVideoLocally(deletedId);
        }
    }
}

// favorites tablosundaki INSERT / DELETE olaylarını işler
function handleFavoriteChange(payload) {
    const eventType = payload.eventType;

    if (eventType === 'INSERT') {
        const videoId = payload.new ? payload.new.video_id : null;
        if (videoId !== null && videoId !== undefined) {
            store.updateFavoriteLocally(videoId, true);
        }
    } else if (eventType === 'DELETE') {
        const videoId = payload.old ? payload.old.video_id : null;
        if (videoId !== null && videoId !== undefined) {
            store.updateFavoriteLocally(videoId, false);
        }
    }
}

// Realtime kanalını açar ve dinlemeye başlar.
// app.js içinde, veriler yüklendikten sonra bir kez çağrılır.
export function initRealtimeSync() {
    if (channel) return; // Zaten başlatılmışsa tekrar açma

    channel = supabase
        .channel('db-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'videos' },
            handleVideoChange
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'favorites' },
            handleFavoriteChange
        )
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Realtime senkronizasyon aktif.');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('⚠️ Realtime bağlantı sorunu:', status);
            }
        });
}