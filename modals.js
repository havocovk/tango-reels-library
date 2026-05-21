// modals.js
import { AppState } from './state.js';
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
    renderModalChips();
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
        console.error("Modal etiket güncelleme hatası:", err);
    }
}