// storage.js - Kapak resmi yükleme (paste ve file select ortak mantık)
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { translations } from './i18n.js';
import { fetchWithRetry } from './utils.js';

let uploadedCoverUrl = null;

export function getUploadedCoverUrl() {
    return uploadedCoverUrl;
}

export function resetUploadedCoverUrl() {
    uploadedCoverUrl = null;
}

// Ortak yükleme fonksiyonu (blob veya file)
async function uploadImageToStorage(blob, currentLang) {
    const lang = translations[currentLang];
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText) dropAreaText.innerText = lang.uploading;

    const fileName = `tango_cover_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.png`;
    try {
        const uploadResponse = await fetchWithRetry(`${SUPABASE_URL}/storage/v1/object/covers/${fileName}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': blob.type
            },
            body: blob
        }, 3, 1000);
        if (!uploadResponse.ok) throw new Error("Storage upload failed");
        uploadedCoverUrl = `${SUPABASE_URL}/storage/v1/object/public/covers/${fileName}`;
        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) {
            imgPreview.src = uploadedCoverUrl;
            imgPreview.classList.remove('d-none');
        }
        if (dropAreaText) dropAreaText.classList.add('d-none');
        return uploadedCoverUrl;
    } catch (err) {
        console.error(err);
        alert(lang.uploadError);
        if (dropAreaText) dropAreaText.innerText = lang.dropText;
        return null;
    }
}

// Ctrl+V ile yapıştırma
export async function handlePasteEvent(e, currentLang) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") === 0) {
            const blob = items[i].getAsFile();
            await uploadImageToStorage(blob, currentLang);
            break;
        }
    }
}

// Dosya seçici ile seçilen dosya
export async function handleFileSelect(file, currentLang) {
    if (!file || !file.type.startsWith('image/')) {
        alert('Lütfen geçerli bir resim dosyası seçin.');
        return;
    }
    await uploadImageToStorage(file, currentLang);
}