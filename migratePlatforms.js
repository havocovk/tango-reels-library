import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { detectPlatform } from './tangoVeritabani.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
    console.log('Mevcut videoların platform bilgileri güncelleniyor...');
    const { data: videos, error } = await supabase.from('videos').select('id, url, is_downloaded');
    if (error) {
        console.error('Videolar alınamadı:', error);
        return;
    }
    for (const video of videos) {
        const platform = detectPlatform(video.url, video.is_downloaded);
        const { error: updateError } = await supabase
            .from('videos')
            .update({ platform })
            .eq('id', video.id);
        if (updateError) {
            console.error(`Video ${video.id} güncellenemedi:`, updateError);
        } else {
            console.log(`Video ${video.id} platformu: ${platform}`);
        }
    }
    console.log('Migrasyon tamamlandı.');
}
migrate();