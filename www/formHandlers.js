// www/formHandlers.js
import { getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { dbSaveVideo, detectPlatform } from './tangoVeritabani.js';
import { showCustomAlert } from './tangoModals.js';
import { renderChips } from './uiRenderer.js';
import { translations } from './config.js';
import { updateSmartFilenameAssistant } from './tangoUI.js';
import { store } from './store.js';

let fetchVideosCallback = null;
let callSwitchViewCallback = null;

export function setFormHandlersGlobalData(lang, editId, tagsArray, videos) {
    // Artık store kullanıldığı için bu fonksiyon boş olabilir
}

export function initFormHandlers(editId, tagsArray, videos, fetchCb, switchCb) {
    fetchVideosCallback = fetchCb;
    callSwitchViewCallback = switchCb;
}

export function setEditingVideoId(id) {
    store.set('editingVideoId', id);
}

export function setEditingVideoUpdatedAt(updatedAt) {
    // Store'da bu değişken yok, geçici olarak ayrı bir değişken tutabiliriz.
    // Şimdilik boş bırak, sonra store'a eklenebilir.
}

export function setFormTagsArray(tags) {
    store.set('formTagsArray', [...tags]);
}

export function getFormTagsArray() {
    return store.get('formTagsArray');
}

export function renderFormChips() {
    const tags = store.get('formTagsArray');
    renderChips('chips-area', tags, (index) => {
        const newTags = [...tags];
        newTags.splice(index, 1);
        store.set('formTagsArray', newTags);
        renderFormChips();
        updateSmartFilenameAssistant(store.get('currentLang'), newTags);
    });
}

export async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[store.get('currentLang')];
    const okText = store.get('currentLang') === 'tr' ? 'Tamam' : 'OK';
    const instructor_id = document.getElementById('form-instructor-select').value;
    let url = document.getElementById('form-video-url').value.trim();
    const role_type = document.getElementById('form-role-select').value;
    const partner_name = document.getElementById('form-partner-name').value.trim();
    const tags = store.get('formTagsArray').join(', ');
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    let cover_url = getUploadedCoverUrl();
    const editingVideoId = store.get('editingVideoId');
    if (!cover_url && editingVideoId) {
        const curr = store.get('globalVideos').find(v => v.id === editingVideoId);
        if (curr) cover_url = curr.cover_url;
    }
    if (!instructor_id) return showCustomAlert(store.get('currentLang') === 'tr' ? 'Lütfen eğitmen seçin!' : 'Please select instructor!', okText);
    if (is_downloaded && !drive_url) return showCustomAlert(store.get('currentLang') === 'tr' ? 'Drive linki zorunludur!' : 'Drive link is required!', okText);
    if (!is_downloaded && !url) return showCustomAlert(store.get('currentLang') === 'tr' ? 'Video URL zorunludur!' : 'Video URL is required!', okText);
    let platform = is_downloaded ? 'drive' : detectPlatform(url, false);
    let finalUrl = url;
    if (is_downloaded && (!finalUrl || finalUrl === '')) {
        finalUrl = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
    const payload = {
        instructor_id: parseInt(instructor_id),
        url: finalUrl,
        role_type, partner_name: partner_name || null,
        tags: tags || null, is_downloaded,
        drive_url: is_downloaded ? drive_url : null,
        cover_url, platform
    };
    try {
        await dbSaveVideo(editingVideoId, payload, null); // updated_at geçici olarak null
        await showCustomAlert(editingVideoId ? lang.successUpdate : lang.successSave, okText);
        store.set('editingVideoId', null);
        store.set('formTagsArray', []);
        renderFormChips();
        document.getElementById('add-video-form').reset();
        document.getElementById('image-preview').classList.add('d-none');
        document.getElementById('drop-area-text').innerText = lang.dropText;
        document.getElementById('drive-url-container').classList.add('d-none');
        resetUploadedCoverUrl();
        if (callSwitchViewCallback) callSwitchViewCallback('library');
        if (fetchVideosCallback) await fetchVideosCallback();
    } catch (err) {
        let hataMesaji = err.message;
        if (hataMesaji.includes('ÇAKIŞMA')) {
            await showCustomAlert(hataMesaji, okText);
            if (callSwitchViewCallback) callSwitchViewCallback('library');
            if (fetchVideosCallback) await fetchVideosCallback();
        } else {
            let hata = `${store.get('currentLang') === 'tr' ? 'İşlem hatası:' : 'Operation error:'} ${err.message}`;
            await showCustomAlert(hata, okText);
        }
    }
}