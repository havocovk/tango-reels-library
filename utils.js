// utils.js
export function updateSmartFilenameAssistant(langKey, tags) {
    const el = document.getElementById('smart-filename-preview');
    if (!el) return;
    if (!tags || tags.length === 0) {
        el.innerText = langKey === 'tr' ? 'Henüz etiket eklenmedi...' : 'No tags added yet...';
        return;
    }
    const clean = tags.map(t => t.toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '_')).join('-');
    el.innerText = `tango_${clean}.mp4`;
}