// handlers.js
import { AppState } from './state.js';
import { translations } from './config.js';
import * as api from './api.js';
import { getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { updateSmartFilenameAssistant } from './utils.js';

export function renderFormChips() {
    const area = document.getElementById('chips-area');
    if (!area) return;
    area.innerHTML = '';
    AppState.formTagsArray.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `${tag} <span class="chip-close-x">&times;</span>`;
        chip.querySelector('.chip-close-x').addEventListener('click', () => {
            AppState.formTagsArray.splice(index, 1);
            renderFormChips();
            updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray);
        });
        area.appendChild(chip);
    });
}

export async function handleFormSubmit(e, switchViewCallback) {
    e.preventDefault();
    const lang = translations[AppState.currentLang];
    const instructor_id = document.getElementById('form-instructor-select').value;
    if (!instructor_id) return alert("Lütfen bir eğitmen seçin!");

    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && AppState.editingVideoId) {
        const currentVid = AppState.globalVideos.find(v => v.id === AppState.editingVideoId);
        if (currentVid) cover_url = currentVid.cover_url;
    }

    const videoData = {
        instructor_id: parseInt(instructor_id),
        url: document.getElementById('form-video-url').value.trim(),
        role_type: document.getElementById('form-role-select').value,
        partner_name: document.getElementById('form-partner-name').value.trim() || null,
        tags: AppState.formTagsArray.join(', ') || null,
        is_downloaded,
        drive_url: is_downloaded ? document.getElementById('form-drive-url').value.trim() : null,
        cover_url
    };

    if (AppState.editingVideoId) videoData.id = AppState.editingVideoId;

    try {
        await api.saveVideo(videoData);
        alert(AppState.editingVideoId ? lang.successUpdate : lang.successSave);
        AppState.editingVideoId = null;
        AppState.formTagsArray = [];
        document.getElementById('add-video-form').reset();
        resetUploadedCoverUrl();
        switchViewCallback('library');
        if (AppState.onRefreshUI) await AppState.onRefreshUI();
    } catch (err) {
        console.error(err);
        alert("Kayıt sırasında hata oluştu!");
    }
}