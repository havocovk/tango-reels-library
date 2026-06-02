// supabaseClient.js - Supabase JavaScript istemcisi (Realtime için)
// ✅ YENİ (Adım 4.2)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Tüm uygulamada kullanacağımız tek Supabase bağlantısı.
// realtime ayarındaki eventsPerSecond, saniyede en fazla kaç olay
// işleneceğini sınırlar (sunucuyu yormamak için makul bir değer).
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    realtime: {
        params: { eventsPerSecond: 10 }
    }
});