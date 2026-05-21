// modals.js
import { AppState } from './state.js';
import { translations } from './config.js';
import * as api from './api.js';

export function openVideoModal(driveUrl, videoUrl) {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    if (!modal || !iframe) return;

    let targetSrc = (driveUrl && driveUrl.includes('drive.google.com'))
        ? driveUrl.replace(/\/view\?usp=sharing|\/view/g, '/preview')
        : videoUrl;

    iframe.src = targetSrc;
    modal.classList.remove('d-none');
}

export function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    if (iframe) iframe.src = '';
    if (modal) modal.classList.add('d-none');
}

export function openTagsEditModal(video) {
    AppState.activeEditTagsVideoId = video.id;
    AppState.modalTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    document.getElementById('tags-edit-modal').classList.remove('d-none');
    renderModalListRows(video);
    renderModalChips();
}

export function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
}

// Orijinal kodunuzda modal-tags-list-container içine basılan satırlar
export function renderModalListRows(video) {
    const container = document.getElementById('modal-tags-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!video.tags) return;
    const tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
    
    tags.forEach((tag, index) => {
        const row = document.createElement('div');
        row.className = 'modal-tag-row';
        row.innerHTML = `
            <input type="text" class="modal-tag-edit-input" value="${tag}">
            <button class="modal-tag-row-delete-btn">&times;</button>
        `;
        
        row.querySelector('.modal-tag-row-delete-btn').addEventListener('click', async () => {
            AppState.modalTagsArray.splice(index, 1);
            renderModalChips();
            await saveModalTagsToDatabase();
            renderModalListRows({ id: video.id, tags: AppState.modalTagsArray.join(', ') });
        });
        
        row.querySelector('.modal-tag-edit-input').addEventListener('change', async (e) => {
            const newVal = e.target.value.trim();
            if (newVal) AppState.modalTagsArray[index] = newVal;
            await saveModalTagsToDatabase();
        });
        
        container.appendChild(row);
    });
}

export function renderModalChips() {
    const area = document.getElementById('modal-chips-area');
    if (!area) return;
    area.innerHTML = '';
    AppState.modalTagsArray.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `${tag} <span class="chip-close-x">&times;</span>`;
        chip.querySelector('.chip-close-x').addEventListener('click', async () => {
            AppState.modalTagsArray.splice(index, 1);
            renderModalChips();
            await saveModalTagsToDatabase();
            renderModalListRows({ id: AppState.activeEditTagsVideoId, tags: AppState.modalTagsArray.join(', ') });
        });
        area.appendChild(chip);
    });
}

export async function saveModalTagsToDatabase() {
    const finalTags = AppState.modalTagsArray.join(', ');
    try {
        await api.saveVideo({ id: AppState.activeEditTagsVideoId, tags: finalTags || null });
        if (AppState.onRefreshUI) await AppState.onRefreshUI();
    } catch (err) {
        console.error("Modal etiket kayıt hatası:", err);
    }
}