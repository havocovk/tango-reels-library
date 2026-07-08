// tagColorManager.js - Etiket renk yönetimi (otomatik atama sistemi)
// ✅ GÜNCELLEME (Adım 3.3 v2): Manuel seçim → otomatik benzersiz renk atama
import { dbFetchTagColors, dbSetTagColor, dbDeleteTagColor } from './tangoVeritabani.js';
import { store } from './store.js';

// ─────────────────────────────────────────────────────────────
// Synthwave temasıyla uyumlu geniş renk havuzu (30 renk)
// Yeterince farklı tonlar — art arda gelen etiketler birbirine karışmaz
// ─────────────────────────────────────────────────────────────
const COLOR_POOL = [
    '#00f0ff', // cyan
    '#ff007f', // magenta
    '#c084fc', // mor
    '#34d399', // yeşil
    '#facc15', // sarı
    '#f97316', // turuncu
    '#60a5fa', // mavi
    '#f472b6', // pembe
    '#a3e635', // lime
    '#fb7185', // gül
    '#38bdf8', // gökyüzü mavisi
    '#e879f9', // fuşya
    '#4ade80', // açık yeşil
    '#fbbf24', // amber
    '#818cf8', // indigo
    '#2dd4bf', // teal
    '#f87171', // kırmızı
    '#a78bfa', // lavanta
    '#86efac', // mint
    '#fcd34d', // altın
    '#67e8f9', // buz mavisi
    '#f9a8d4', // şeker pembesi
    '#6ee7b7', // jade
    '#fca5a5', // somon
    '#93c5fd', // periwinkle
    '#d8b4fe', // lila
    '#bbf7d0', // açık nane
    '#fed7aa', // şeftali
    '#bfdbfe', // bebek mavisi
    '#e9d5ff', // lavanta açık
];

// ─────────────────────────────────────────────────────────────
// loadTagColors()
// Uygulama başlarken çağrılır. DB'den renkleri çekip store'a yazar.
// ─────────────────────────────────────────────────────────────
export async function loadTagColors() {
    try {
        const rows = await dbFetchTagColors();
        const colorMap = {};
        rows.forEach(r => { colorMap[r.tag_name] = r.color_code; });
        store.set('tagColors', colorMap);
    } catch (err) {
        store.set('tagColors', {});
        console.warn('Etiket renkleri yüklenemedi:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// getTagColor(tagName)
// Bir etiketin rengini döner.
// Renk yoksa otomatik atar, DB'ye kaydeder ve döner.
// ─────────────────────────────────────────────────────────────
export function getTagColor(tagName) {
    const colorMap = store.get('tagColors') || {};
    if (colorMap[tagName]) return colorMap[tagName];

    // Renk atanmamış — otomatik ata
    const assignedColor = _assignColorToTag(tagName);
    return assignedColor;
}

// ─────────────────────────────────────────────────────────────
// _assignColorToTag(tagName)  — iç fonksiyon
// Kullanılmamış bir rengi seçer, store ve DB'ye kaydeder.
// ─────────────────────────────────────────────────────────────
function _assignColorToTag(tagName) {
    const colorMap = store.get('tagColors') || {};
    const usedColors = new Set(Object.values(colorMap));

    // Havuzdan henüz kullanılmamış ilk rengi bul
    let chosenColor = null;
    for (const color of COLOR_POOL) {
        if (!usedColors.has(color)) {
            chosenColor = color;
            break;
        }
    }

    // Tüm havuz doluysa — en az kullanılan rengi bul (renk sayısı mod havuz boyutu)
    if (!chosenColor) {
        const tagCount = Object.keys(colorMap).length;
        chosenColor = COLOR_POOL[tagCount % COLOR_POOL.length];
    }

    // Store'a hemen yaz (senkron — UI beklemeden rengi görsün)
    const newMap = { ...colorMap, [tagName]: chosenColor };
    store.set('tagColors', newMap);

    // DB'ye arka planda kaydet (async — UI'ı bloklamaz)
    dbSetTagColor(tagName, chosenColor).catch(err => {
        console.warn(`"${tagName}" rengi DB'ye kaydedilemedi:`, err.message);
    });

    return chosenColor;
}

// ─────────────────────────────────────────────────────────────
// ensureAllTagsHaveColors(videos)
// Uygulama açılışında tüm etiketlerin rengini garanti eder.
// Renksiz etiketlere toplu otomatik renk atar.
// ─────────────────────────────────────────────────────────────
export async function ensureAllTagsHaveColors(videos) {
    const colorMap = store.get('tagColors') || {};

    // Koleksiyondaki tüm benzersiz etiketleri topla
    const allTags = new Set();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) allTags.add(tag);
            });
        }
    });

    // Rengi olmayan etiketleri bul
    const uncolored = Array.from(allTags).filter(tag => !colorMap[tag]);
    if (uncolored.length === 0) return; // Hepsi zaten renkli

    // Her renksiz etikete sırayla renk ata
    const usedColors = new Set(Object.values(colorMap));
    const newEntries = [];

    uncolored.forEach(tag => {
        let chosenColor = null;
        for (const color of COLOR_POOL) {
            if (!usedColors.has(color)) {
                chosenColor = color;
                usedColors.add(color); // Bir sonraki etiket bu rengi kullanmasın
                break;
            }
        }
        if (!chosenColor) {
            // Havuz doluysa döngüsel seçim
            chosenColor = COLOR_POOL[(Object.keys(colorMap).length + newEntries.length) % COLOR_POOL.length];
        }
        colorMap[tag] = chosenColor;
        newEntries.push({ tag_name: tag, color_code: chosenColor });
    });

    // Store'u güncelle
    store.set('tagColors', { ...colorMap });

    // DB'ye toplu kaydet (her biri ayrı istek — basit ve güvenli)
    for (const entry of newEntries) {
        try {
            await dbSetTagColor(entry.tag_name, entry.color_code);
        } catch (err) {
            console.warn(`"${entry.tag_name}" rengi DB'ye kaydedilemedi:`, err.message);
        }
    }
}

// ─────────────────────────────────────────────────────────────
// removeTagColor(tagName)
// DB'den siler ve store'u günceller.
// (Etiket yönetiminden manuel sıfırlama için — artık UI'da gösterilmiyor
//  ama ihtiyaç halinde import edip kullanılabilir)
// ─────────────────────────────────────────────────────────────
export async function removeTagColor(tagName) {
    try {
        await dbDeleteTagColor(tagName);
        const colorMap = { ...(store.get('tagColors') || {}) };
        delete colorMap[tagName];
        store.set('tagColors', colorMap);
    } catch (err) {
        console.warn('Renk silinemedi:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// getColorPalette() — artık kullanılmıyor ama import uyumluluğu için kalıyor
// ─────────────────────────────────────────────────────────────
export function getColorPalette() {
    return COLOR_POOL.map(color => ({ color, label: color }));
}