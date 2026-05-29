// i18n.js - Dil yönetimi
import { tr } from './locales/tr.js';
import { en } from './locales/en.js';

export const translations = {
    tr,
    en
};

// İsteğe bağlı: aktif dili almak için bir yardımcı (şimdilik kullanılmayacak)
// export let currentLanguage = 'tr';
// export function setLanguage(lang) { currentLanguage = lang; }
// export function t(key) { return translations[currentLanguage][key] || key; }