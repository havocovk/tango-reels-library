// modalLoader.js — Adim 3.4 (Seçenek B)
// Modal HTML'lerini lazy olarak DOM'a ekler.
// app.js'e bağımlılık yok — döngüsel import sorunu çözülür.
// Event listener bağlama app.js tarafından callback ile yapılır.

const _loadedTemplates = new Set();
const _onLoadCallbacks  = {};  // { 'video-modal': [fn, fn, ...] }

// Dahili: HTML yükle ve DOM'a ekle (bir kez)
async function _loadTemplate(key, url, container) {
    if (_loadedTemplates.has(key)) return;
    const html = await fetch(url).then(r => r.text());
    container.insertAdjacentHTML('beforeend', html);
    _loadedTemplates.add(key);
}

// Dışarıdan çağrılabilir — modal açılmadan önce lazy yükleme için
export async function ensureModalLoaded(modalKey) {
    let container = document.getElementById('modals-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'modals-container';
        document.body.appendChild(container);
    }
    const modalMap = {
        'video-modal':        'modals/video-modal.html',
        'tags-edit-modal':    'modals/tags-edit-modal.html',
        'annotation-modal':   'modals/annotation-modal.html',
        'link-manager-modal': 'modals/link-manager-modal.html',
    };
    const url = modalMap[modalKey];
    if (!url) return;

    const isNew = !_loadedTemplates.has(modalKey);
    await _loadTemplate(modalKey, url, container);

    // İlk yüklemede kayıtlı callback'leri çalıştır
    if (isNew && _onLoadCallbacks[modalKey]) {
        for (const cb of _onLoadCallbacks[modalKey]) cb();
    }
}

// app.js bu fonksiyonla event listener bağlama callback'lerini kaydeder
export function onModalLoaded(modalKey, callback) {
    if (!_onLoadCallbacks[modalKey]) _onLoadCallbacks[modalKey] = [];
    _onLoadCallbacks[modalKey].push(callback);
}

// Geriye dönük uyumluluk — view'lar baştan DOM'da, no-op
export async function ensureViewLoaded(_viewName) {}