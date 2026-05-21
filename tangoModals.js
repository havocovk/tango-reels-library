import { translations } from './config.js';
import { dbUpdateTagsDirectly } from './tangoVeritabani.js';
import { renderChips } from './uiRenderer.js';

// Modal durum değişkenleri (app.js'ten buraya taşındı)
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
    modalTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    
    document.getElementById('tags-edit-modal').classList.remove('d-none');
    renderModalTagsList(globalVideos, applyFiltersAndSearch);
    renderModalChips(globalVideos, applyFiltersAndSearch);
}

export function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
}

export function renderModalTagsList(globalVideos, applyFiltersAndSearch) {
    const container = document.getElementById('modal-tags-list-container');
    container.innerHTML = '';

    if (modalTagsArray.length === 0) {
        container.innerHTML = `<div style="color:#64748b; font-size:0.9rem; text-align:center;">Henüz etiket bulunmuyor.</div>`;
        return;
    }

    modalTagsArray.forEach((tag, idx) => {
        const row = document.createElement('div');
        row.className = 'modal-tag-row';
        row.innerHTML = `
            <input type="text" value="${tag}" data-idx="${idx}" class="modal-tag-edit-input">
            <button class="modal-tag-row-delete-btn" data-idx="${idx}">&times;</button>
        `;

        row.querySelector('.modal-tag-edit-input').addEventListener('input', (e) => {
            modalTagsArray[idx] = e.target.value.trim();
        });

        row.querySelector('.modal-tag-row-delete-btn').addEventListener('click', () => {
            modalTagsArray.splice(idx, 1);
            saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
        });

        row.querySelector('.modal-tag-edit-input').addEventListener('blur', () => {
            saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
        });

        container.appendChild(row);
    });
}

export function renderModalChips(globalVideos, applyFiltersAndSearch) {
    renderChips('modal-chips-area', modalTagsArray, (index) => {
        modalTagsArray.splice(index, 1);
        saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
    });
}

export async function saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch) {
    if (!activeEditTagsVideoId) return;
    const cleanTags = modalTagsArray.filter(t => t !== '').join(', ');
    
    try {
        await dbUpdateTagsDirectly(activeEditTagsVideoId, cleanTags);
        const vid = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (vid) vid.tags = cleanTags || null;
        renderModalTagsList(globalVideos, applyFiltersAndSearch);
        renderModalChips(globalVideos, applyFiltersAndSearch);
        applyFiltersAndSearch();
    } catch (err) {
        console.error("Etiket anlık güncellenemedi:", err);
    }
}