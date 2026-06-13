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

// ─────────────────────────────────────────────────────────────
// compressImage — Adim 5.3
// Canvas API ile resmi sıkıştırır.
// Maksimum genişlik/yükseklik: 800px
// Çıktı: JPEG blob, kalite 0.80
// 8MB → ~150-300KB arası sonuç
// ─────────────────────────────────────────────────────────────
async function compressImage(blob, maxSize = 800, quality = 0.80) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;

            // En büyük kenarı maxSize'a indir, oranı koru
            if (width > maxSize || height > maxSize) {
                if (width >= height) {
                    height = Math.round((height / width) * maxSize);
                    width  = maxSize;
                } else {
                    width  = Math.round((width / height) * maxSize);
                    height = maxSize;
                }
            }

            const canvas  = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (compressedBlob) => resolve(compressedBlob || blob),
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(blob); // Hata olursa orijinal blob ile devam et
        };

        img.src = url;
    });
}

// Ortak yükleme fonksiyonu (blob veya file)
async function uploadImageToStorage(blob, currentLang) {
    const lang = translations[currentLang];
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText) dropAreaText.innerText = lang.uploading;

    // Adim 5.3: Yüklemeden önce sıkıştır
    const originalSizeKB = Math.round(blob.size / 1024);
    blob = await compressImage(blob);
    const compressedSizeKB = Math.round(blob.size / 1024);
    console.log(`[Storage] Resim sıkıştırıldı: ${originalSizeKB}KB → ${compressedSizeKB}KB`);

    const fileName = `tango_cover_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`;
    try {
        const uploadResponse = await fetchWithRetry(`${SUPABASE_URL}/storage/v1/object/covers/${fileName}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'image/jpeg'
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

// ─────────────────────────────────────────────────────────────
// uploadInstructorPhoto — Eğitmen fotoğrafı yükleme (Ek özellik)
// Resmi sıkıştırıp Supabase Storage'daki 'instructors' bucket'ına yükler.
// Yüklenen fotoğrafın public URL'ini döner.
// ─────────────────────────────────────────────────────────────
export async function uploadInstructorPhoto(file) {
    if (!file || !file.type.startsWith('image/')) {
        throw new Error('Geçerli bir resim dosyası seçin.');
    }

    // Eğitmen fotoğrafları için daha küçük boyut: 400px, kalite 0.85
    const originalSizeKB  = Math.round(file.size / 1024);
    const compressed      = await compressImage(file, 400, 0.85);
    const compressedSizeKB = Math.round(compressed.size / 1024);
    console.log(`[Storage] Eğitmen fotoğrafı sıkıştırıldı: ${originalSizeKB}KB → ${compressedSizeKB}KB`);

    const fileName = `instructor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;

    const res = await fetchWithRetry(
        `${SUPABASE_URL}/storage/v1/object/instructors/${fileName}`,
        {
            method: 'POST',
            headers: {
                'apikey':        SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type':  'image/jpeg'
            },
            body: compressed
        },
        3, 1000
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Fotoğraf yüklenemedi: ${err}`);
    }

    return `${SUPABASE_URL}/storage/v1/object/public/instructors/${fileName}`;
}