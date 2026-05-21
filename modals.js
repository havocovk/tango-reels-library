// modals.js
import * as api from './api.js';
import { renderChips, getAllUniqueTags } from './tags.js';

// 1. Google Drive Video İzleme Modalı Açma
export function openVideoModal(driveUrl, videoUrl) {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    if (!modal || !iframe) return;

    let targetSrc = '';
    if (driveUrl && driveUrl.includes('drive.google.com')) {
        // Linki doğrudan gömülebilir (embed) oynatıcı formatına dönüştürüyoruz
        targetSrc = driveUrl.replace(/\/view\?usp=sharing|\/view/g, '/preview');
    } else {
        targetSrc = videoUrl; // Fallback sosyal medya linki
    }

    iframe.src = targetSrc;
    modal.classList.remove('d-none');
}

export function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    const iframe = document.getElementById('modal-iframe');
    if (iframe) iframe.src = '';
    if (modal) modal.classList.add('d-none');
}

// 2. Anlık Etiket Düzenleme Modalı Açma
export function openTagsEditModal(videoId, state) {
    state.activeEditTagsVideoId = videoId;
    const video = state.globalVideos.find(v => v.id === videoId);
    if (!video) return;

    state.modalTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    
    const modal = document.getElementById('tags-edit-modal');
    if (modal) modal.classList.remove('d-none');
    
    renderModalChips(state);
}

export function renderModalChips(state) {
    renderChips('modal-chips-area', state.modalTagsArray, async (index) => {
        state.modalTagsArray.splice(index, 1);
        renderModalChips(state);
        await saveModalTagsToDatabase(state);
    });
}

async function saveModalTagsToDatabase(state) {
    const videoId = state.activeEditTagsVideoId;
    const finalTags = state.modalTagsArray.join(', ');
    
    try {
        await api.saveVideo({
            id: videoId,
            tags: finalTags || null
        });
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error("Etiket kaydedilirken hata oluştu:", err);
    }
}

export function closeTagsEditModal(state) {
    const modal = document.getElementById('tags-edit-modal');
    if (modal) modal.classList.add('d-none');
    state.activeEditTagsVideoId = null;
    state.modalTagsArray = [];
}

// Pop-up içi otomatik etiket tamamlama yapısı
export function setupModalAutocomplete(state) {
    const input = document.getElementById('modal-tags-input');
    const list = document.getElementById('modal-autocomplete-list');
    if (!input || !list) return;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';
        if (!val) { list.classList.add('d-none'); return; }

        const allUnique = getAllUniqueTags(state.globalVideos);
        const matches = allUnique.filter(t => t.toLowerCase().includes(val) && !state.modalTagsArray.includes(t));

        if (matches.length === 0) { list.classList.add('d-none'); return; }

        list.classList.remove('d-none');
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion-item';
            div.innerText = match;
            div.addEventListener('click', async () => {
                if (!state.modalTagsArray.includes(match)) {
                    state.modalTagsArray.push(match);
                    renderModalChips(state);
                    await saveModalTagsToDatabase(state);
                }
                input.value = '';
                list.classList.add('d-none');
            });
            list.appendChild(div);
        });
    });

    input.addEventListener('keydown', async (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.replace(',', '').trim();
            if (val && !state.modalTagsArray.includes(val)) {
                state.modalTagsArray.push(val);
                renderModalChips(state);
                await saveModalTagsToDatabase(state);
            }
            input.value = '';
            list.classList.add('d-none');
        }
    });
}