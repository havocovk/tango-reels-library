// modals.js
import { translations } from './config.js';
import { convertDriveUrlToEmbed } from './utils.js';
import { renderChips, saveTagsToSupabaseDirectly } from './tags.js';

export function openVideoModal(url) {
    const embedUrl = convertDriveUrlToEmbed(url);
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

export function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}

export function closeTagsEditModal(state) {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    state.activeEditTagsVideoId = null;
}

export function renderModalChips(state) {
    renderChips('modal-chips-area', state.modalTagsArray, (index) => {
        state.modalTagsArray.splice(index, 1);
        saveModalTags(state);
    });
}

export function renderModalTagsList(state) {
    const container = document.getElementById('modal-tags-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (state.modalTagsArray.length === 0) {
        container.innerHTML = `<div style="color:#64748b; font-size:0.9rem; text-align:center;">Henüz etiket bulunmuyor.</div>`;
        return;
    }

    state.modalTagsArray.forEach((tag, idx) => {
        const row = document.createElement('div');
        row.className = 'modal-tag-row';
        row.innerHTML = `
            <input type="text" value="${tag}" data-idx="${idx}" class="modal-tag-edit-input">
            <button class="modal-tag-row-delete-btn" data-idx="${idx}">&times;</button>
        `;

        row.querySelector('.modal-tag-edit-input').addEventListener('input', (e) => {
            state.modalTagsArray[idx] = e.target.value.trim();
        });

        row.querySelector('.modal-tag-row-delete-btn').addEventListener('click', () => {
            state.modalTagsArray.splice(idx, 1);
            saveModalTags(state);
        });

        row.querySelector('.modal-tag-edit-input').addEventListener('blur', () => {
            saveModalTags(state);
        });

        container.appendChild(row);
    });
}

export async function saveModalTags(state) {
    await saveTagsToSupabaseDirectly(state.activeEditTagsVideoId, state.modalTagsArray, (cleanTags) => {
        const vid = state.globalVideos.find(v => v.id === state.activeEditTagsVideoId);
        if (vid) vid.tags = cleanTags || null;
        renderModalTagsList(state);
        renderModalChips(state);
        if (state.onRefreshUI) state.onRefreshUI();
    });
}

export function openTagsEditModal(video, state) {
    state.activeEditTagsVideoId = video.id;
    state.modalTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    document.getElementById('tags-edit-modal').classList.remove('d-none');
    renderModalTagsList(state);
    renderModalChips(state);
}