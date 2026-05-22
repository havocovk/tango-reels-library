import { translations } from './config.js';
import { dbUpdateTagsDirectly } from './tangoVeritabani.js';
import { renderChips } from './uiRenderer.js';

// Modal durum değişkenleri
export let modalTagsArray = [];
export let activeEditTagsVideoId = null;

// Drive linkini embed formata dönüştürür
export function convertDriveUrlToEmbed(url) {
    if (!url) return '';
    const regExp = /\/file\/d\/([^/]+)/;
    const matches = url.match(regExp);
    if (matches && matches[1]) {
        return `https://drive.google.com/file/d/${matches[1]}/preview`;
    }
    return url;
}

// 🎬 Video Önizleme Modalı Fonksiyonları
export function openVideoModal(url) {
    const embedUrl = convertDriveUrlToEmbed(url);
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

export function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}

// ✏️ Etiket Düzenleme Modalı Fonksiyonları
export function openTagsEditModal(video, globalVideos, applyFiltersAndSearch) {
    activeEditTagsVideoId = video.id;
    document.getElementById('tags-edit-modal').classList.remove('d-none');
    
    // Videoya ait etiketleri diziye dönüştürür
    modalTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    
    // Üstteki mükerrer liste kaldırıldığı için sadece alt kısımdaki akıllı çipleri çizdiriyoruz
    renderModalChips(globalVideos, applyFiltersAndSearch);
}

export function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
    modalTagsArray = [];
    document.getElementById('modal-tags-input').value = '';
}

// Alt alandaki dinamik etiket çiplerini (çarpı butonlu kutuları) ekrana basar
export function renderModalChips(globalVideos, applyFiltersAndSearch) {
    renderChips('modal-chips-area', modalTagsArray, (index) => {
        // Çarpıya basıldığında ilgili etiketi siler ve anında Supabase'e kaydeder
        modalTagsArray.splice(index, 1);
        saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
    });
}

// Değişiklikleri doğrudan Supabase veritabanına gönderir ve arayüzü günceller
export async function saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch) {
    if (!activeEditTagsVideoId) return;
    const cleanTags = modalTagsArray.filter(t => t !== '').join(', ');
    
    try {
        await dbUpdateTagsDirectly(activeEditTagsVideoId, cleanTags);
        
        // Yerel hafızadaki videonun etiketlerini de günceller
        const vid = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (vid) vid.tags = cleanTags || null;
        
        // Eski liste yerine artık sadece çipleri ve ana kütüphane filtrelerini yeniliyoruz
        renderModalChips(globalVideos, applyFiltersAndSearch);
        applyFiltersAndSearch();
    } catch (err) {
        console.error("Etiket güncellenirken hata oluştu:", err);
    }
}

// 🔔 Modern Özel Alert (Bilgilendirme) Pop-up'ı
export function showCustomAlert(message, okText = 'Tamam') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.classList.add('d-none'); // Alert modunda İptal butonu gizlenir
        modal.classList.remove('d-none');

        const handleOk = () => {
            modal.classList.add('d-none');
            okBtn.removeEventListener('click', handleOk);
            resolve();
        };
        okBtn.addEventListener('click', handleOk);
    });
}

// ❓ Modern Özel Confirm (Onay) Pop-up'ı
export function showCustomConfirm(message, okText = 'Tamam', cancelText = 'İptal') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.innerText = cancelText;
        cancelBtn.classList.remove('d-none'); // Confirm modunda İptal butonu gösterilir
        modal.classList.remove('d-none');

        const handleOk = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}