// storage.js
import { SUPABASE_URL, SUPABASE_KEY, translations } from './config.js';

let uploadedCoverUrl = null;

export function getUploadedCoverUrl() {
    return uploadedCoverUrl;
}

export function resetUploadedCoverUrl() {
    uploadedCoverUrl = null;
}

export async function handlePasteEvent(e, currentLang) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const lang = translations[currentLang];
    
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") === 0) {
            const blob = items[i].getAsFile();
            
            const dropAreaText = document.getElementById('drop-area-text');
            if (dropAreaText) dropAreaText.innerText = lang.uploading;

            const fileName = `tango_cover_${Date.now()}.png`;

            try {
                const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/covers/${fileName}`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': blob.type
                    },
                    body: blob
                });

                if (!uploadResponse.ok) {
                    throw new Error("Storage upload failed");
                }

                uploadedCoverUrl = `${SUPABASE_URL}/storage/v1/object/public/covers/${fileName}`;
                
                const imgPreview = document.getElementById('image-preview');
                if (imgPreview) {
                    imgPreview.src = uploadedCoverUrl;
                    imgPreview.classList.remove('d-none');
                }
                if (dropAreaText) dropAreaText.classList.add('d-none');

            } catch (err) {
                console.error(err);
                if (dropAreaText) dropAreaText.innerText = lang.dropText;
            }
        }
    }
}