// handlers.js
import * as api from './api.js';
import { translations } from './config.js';
import { getFavorites } from './favorites.js';
import { getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { updateSmartFilenameAssistant } from './utils.js';
import { renderChips } from './tags.js';

export function renderFormChips(state) {
    renderChips('chips-area', state.formTagsArray, (index) => {
        state.formTagsArray.splice(index, 1);
        renderFormChips(state);
        updateSmartFilenameAssistant(state.currentLang, state.formTagsArray);
    });
}

export function startVideoEditFlow(video, state, switchViewCallback) {
    state.editingVideoId = video.id;
    switchViewCallback('add');

    const lang = translations[state.currentLang];
    document.getElementById('form-title').innerText = lang.formTitleEdit;
    document.getElementById('btn-submit-video').innerText = lang.btnUpdateVideo;

    document.getElementById('form-instructor-select').value = video.instructor_id;
    document.getElementById('form-video-url').value = video.url;
    document.getElementById('form-role-select').value = video.role_type || 'Both';
    document.getElementById('form-partner-name').value = video.partner_name || '';
    
    state.formTagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    renderFormChips(state);

    document.getElementById('form-is-downloaded').checked = video.is_downloaded;
    const driveUrlContainer = document.getElementById('drive-url-container');
    if (video.is_downloaded) {
        driveUrlContainer.classList.remove('d-none');
        document.getElementById('form-drive-url').value = video.drive_url || '';
        document.getElementById('form-drive-url').required = true;
    } else {
        driveUrlContainer.classList.add('d-none');
        document.getElementById('form-drive-url').value = '';
        document.getElementById('form-drive-url').required = false;
    }

    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (video.cover_url) {
        imgPreview.src = video.cover_url;
        imgPreview.classList.remove('d-none');
        if (dropAreaText) dropAreaText.classList.add('d-none');
    } else {
        imgPreview.classList.add('d-none');
        if (dropAreaText) {
            dropAreaText.innerText = lang.dropText;
            dropAreaText.classList.remove('d-none');
        }
    }
    updateSmartFilenameAssistant(state.currentLang, state.formTagsArray);
}

export async function deleteVideoFlow(videoId, state) {
    const lang = translations[state.currentLang];
    if (!confirm(lang.confirmDeleteVideo)) return;

    try {
        await api.deleteVideo(videoId);
        alert(lang.successDeleteVideo);
        
        let favs = getFavorites();
        if (favs.includes(videoId)) {
            localStorage.setItem('atkk_favorites', JSON.stringify(favs.filter(id => id !== videoId)));
        }
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error(err);
        alert("Silme işlemi sırasında hata oluştu!");
    }
}

export async function handleFormSubmit(e, state, switchViewCallback) {
    e.preventDefault();
    const lang = translations[state.currentLang];

    const instructor_id = document.getElementById('form-instructor-select').value;
    const url = document.getElementById('form-video-url').value.trim();
    const role_type = document.getElementById('form-role-select').value;
    const partner_name = document.getElementById('form-partner-name').value.trim();
    const tags = state.formTagsArray.join(', ');
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && state.editingVideoId) {
        const currentVid = state.globalVideos.find(v => v.id === state.editingVideoId);
        if (currentVid) cover_url = currentVid.cover_url;
    }

    if (!instructor_id) {
        alert("Lütfen önce bir eğitmen seçin veya ekleyin!");
        return;
    }

    const payload = {
        instructor_id: parseInt(instructor_id),
        url,
        role_type,
        partner_name: partner_name || null,
        tags: tags || null,
        is_downloaded,
        drive_url: is_downloaded && drive_url ? drive_url : null,
        cover_url
    };

    try {
        await api.saveVideo({ id: state.editingVideoId, payload });
        alert(state.editingVideoId ? lang.successUpdate : lang.successSave);
        
        state.editingVideoId = null;
        state.formTagsArray = [];
        renderFormChips(state);
        document.getElementById('add-video-form').reset();
        
        if (document.getElementById('image-preview')) document.getElementById('image-preview').classList.add('d-none');
        document.getElementById('drive-url-container').classList.add('d-none');
        resetUploadedCoverUrl();
        
        switchViewCallback('library');
        if (state.onRefreshUI) state.onRefreshUI();
    } catch (err) {
        console.error(err);
        alert("İşlem sırasında bir hata oluştu!");
    }
}