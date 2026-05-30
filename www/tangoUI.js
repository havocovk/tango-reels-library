// tangoUI.js - YENİ (DÜZELTİLMİŞ IMPORTLAR)
import { switchView } from './ui/navigation.js';      // ✅ Yeni adı kullan
import { updateInterfaceLanguage } from './ui/language.js'; // Eğer adını değiştirmediyseniz aynı

// updateSmartFilenameAssistant fonksiyonu artık app.js içinde olacak
// Dış dünyaya sadece bu iki fonksiyonu gönderiyoruz
export { switchView, updateInterfaceLanguage };