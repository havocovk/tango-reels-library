import { translations } from './config.js';
import { dbUpdateTagsDirectly } from './tangoVeritabani.js';
import { renderChips } from './uiRenderer.js';

// Modal durum değişkenleri
export let modalTagsArray = [];
export let activeEditTagsVideoId = null;

// Drive linkini embed formata dönüştürür (Artık YouTube linklerini de dönüştürüyor!)
export function convertDriveUrlToEmbed(url) {
    if (!url) return '';
    
    // 💾 1. Durum: Eğer bu bir Google Drive linki ise
    if (url.includes('drive.google.com')) {
        const regExp = /\/file\/d\/([^/]+)/;
        const matches = url.match(regExp);
        if (matches && matches[1]) {
            return `https://drive.google.com/file/d/${matches[1]}/preview`;
        }
    }
    
    // 📺 2. Durum: Eğer bu bir YouTube linki ise (Normal, Shorts veya Mobil fark etmez)
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        
        if (url.includes('shorts/')) {
            // YouTube Shorts (Dikey kısa videolar) için özel kod parçacığını alır
            videoId = url.split('shorts/')[1]?.split(/[?#]/)[0];
        } else if (url.includes('youtu.be/')) {
            // Telefondan paylaşılan kısa YouTube linkleri için kodu alır
            videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
        } else if (url.includes('v=')) {
            // Bilgisayardan açılan normal YouTube linkleri için kodu alır
            videoId = url.split('v=')[1]?.split('&')[0]?.split(/[?#]/)[0];
        } else if (url.includes('embed/')) {
            // Zaten gömülü bir link yapıştırıldıysa kodu doğrudan alır
            videoId = url.split('embed/')[1]?.split(/[?#]/)[0];
        }
        
        // Eğer özel kod parçacığını bulabildiysek, televizyona uygun hale getirip gönderiyoruz:
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
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
    
    // 💡 KUTUYU ÇÖPE ATMIYORUZ: İçini boşaltıp yeni etiketleri içine dolduruyoruz (Referans bozulmuyor)
    modalTagsArray.length = 0;
    if (video.tags) {
        video.tags.split(',').map(t => t.trim()).filter(t => t !== '').forEach(t => modalTagsArray.push(t));
    }
    
    // Sadece alt kısımdaki akıllı çipleri çizdiriyoruz
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