// tagColorManager.js - Etiket renk yönetimi (store + DB köprüsü)
// ✅ YENİ (Adım 3.3)
import { dbFetchTagColors, dbSetTagColor, dbDeleteTagColor } from './db/tagColors.js';
import { store } from './store.js';

// Seçilebilecek 12 renk paleti — synthwave temasıyla uyumlu
const COLOR_PALETTE = [
    { color: '#00f0ff', label: 'Cyan'           },
    { color: '#ff007f', label: 'Magenta'        },
    { color: '#c084fc', label: 'Mor'            },
    { color: '#34d399', label: 'Yeşil'          },
    { color: '#facc15', label: 'Sarı'           },
    { color: '#f97316', label: 'Turuncu'        },
    { color: '#60a5fa', label: 'Mavi'           },
    { color: '#f472b6', label: 'Pembe'          },
    { color: '#a3e635', label: 'Lime'           },
    { color: '#fb7185', label: 'Gül'            },
    { color: '#38bdf8', label: 'Gökyüzü Mavisi' },
    { color: '#e879f9', label: 'Fuşya'          },
];

// ─────────────────────────────────────────────────────────────
// loadTagColors()
// Uygulama başlarken çağrılır. DB'den renkleri çekip store'a yazar.
// ─────────────────────────────────────────────────────────────
export async function loadTagColors() {
    try {
        const rows = await dbFetchTagColors();
        // { tagName: colorCode } formatında objeye çevir
        const colorMap = {};
        rows.forEach(r => { colorMap[r.tag_name] = r.color_code; });
        store.set('tagColors', colorMap);
    } catch (err) {
        // Tablo yoksa veya hata varsa boş map ile devam et — uygulama çökmez
        store.set('tagColors', {});
        console.warn('Etiket renkleri yüklenemedi:', err.message);
    }
}

// ─────────────────────────────────────────────────────────────
// getTagColor(tagName)
// Bir etiketin rengini döner. Tanımlanmamışsa null döner.
// ─────────────────────────────────────────────────────────────
export function getTagColor(tagName) {
    const colorMap = store.get('tagColors') || {};
    return colorMap[tagName] || null;
}

// ─────────────────────────────────────────────────────────────
// setTagColor(tagName, colorCode)
// DB'ye yazar ve store'u anında günceller (sayfa yenilemeye gerek kalmaz).
// ─────────────────────────────────────────────────────────────
export async function setTagColor(tagName, colorCode) {
    await dbSetTagColor(tagName, colorCode);
    const colorMap = { ...(store.get('tagColors') || {}) };
    colorMap[tagName] = colorCode;
    store.set('tagColors', colorMap);
}

// ─────────────────────────────────────────────────────────────
// removeTagColor(tagName)
// DB'den siler ve store'u günceller.
// ─────────────────────────────────────────────────────────────
export async function removeTagColor(tagName) {
    await dbDeleteTagColor(tagName);
    const colorMap = { ...(store.get('tagColors') || {}) };
    delete colorMap[tagName];
    store.set('tagColors', colorMap);
}

// ─────────────────────────────────────────────────────────────
// getColorPalette()
// Etiket yöneticisinde gösterilecek renk seçeneklerini döner.
// ─────────────────────────────────────────────────────────────
export function getColorPalette() {
    return COLOR_PALETTE;
}