import { getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { dbSaveVideo, detectPlatform } from './tangoVeritabani.js';
import { showCustomAlert } from './tangoModals.js';
import { renderChips } from './uiRenderer.js';
import { translations } from './config.js';
import { updateSmartFilenameAssistant } from './tangoUI.js';

let currentLang = 'tr';
let editingVideoId = null;
export let formTagsArray = [];
let editingVideoUpdatedAt = null;   // ★ YENİ: updated_at saklamak için
let globalVideos = [];
let fetchVideosCallback = null;
let callSwitchViewCallback = null;

export function setFormHandlersGlobalData(lang, editId, tagsArray, videos) {
    currentLang = lang;
    editingVideoId = editId;
    formTagsArray = tagsArray;
    globalVideos = videos;
}

export function initFormHandlers(editId, tagsArray, videos, fetchCb, switchCb) {
    editingVideoId = editId;
    formTagsArray = tagsArray;
    globalVideos = videos;
    fetchVideosCallback = fetchCb;
    callSwitchViewCallback = switchCb;
}

export function setEditingVideoId(id) {
    editingVideoId = id;
}

// ★ YENİ: updated_at değerini dışarıdan almak için
export function setEditingVideoUpdatedAt(updatedAt) {
    editingVideoUpdatedAt = updatedAt;
}

export function setFormTagsArray(tags) {
    formTagsArray.length = 0;
    tags.forEach(t => formTagsArray.push(t));
}

export function getFormTagsArray() {
    return formTagsArray;
}

export function renderFormChips() {
    renderChips('chips-area', formTagsArray, (index) => {
        formTagsArray.splice(index, 1);
        renderFormChips();
        updateSmartFilenameAssistant(currentLang, formTagsArray);
    });
}

export async function handleFormSubmit(e) {
    e.preventDefault();
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
    const instructor_id = document.getElementById('form-instructor-select').value;
    let url = document.getElementById('form-video-url').value.trim();
    const role_type = document.getElementById('form-role-select').value;
    const partner_name = document.getElementById('form-partner-name').value.trim();
    const tags = formTagsArray.join(', ');
    const is_downloaded = document.getElementById('form-is-downloaded').checked;
    const drive_url = document.getElementById('form-drive-url').value.trim();
    let cover_url = getUploadedCoverUrl();
    if (!cover_url && editingVideoId) {
        const curr = globalVideos.find(v => v.id === editingVideoId);
        if (curr) cover_url = curr.cover_url;
    }
    if (!instructor_id) return showCustomAlert(currentLang === 'tr' ? 'Lütfen eğitmen seçin!' : 'Please select instructor!', okText);
    if (is_downloaded && !drive_url) return showCustomAlert(currentLang === 'tr' ? 'Drive linki zorunludur!' : 'Drive link is required!', okText);
    if (!is_downloaded && !url) return showCustomAlert(currentLang === 'tr' ? 'Video URL zorunludur!' : 'Video URL is required!', okText);
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
        // ★ updated_at değerini üçüncü parametre olarak gönder
        await dbSaveVideo(editingVideoId, payload, editingVideoUpdatedAt);
        await showCustomAlert(editingVideoId ? lang.successUpdate : lang.successSave, okText);
        editingVideoId = null;
        editingVideoUpdatedAt = null;   // ★ temizle
        setFormTagsArray([]);
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
            let hata = `${currentLang === 'tr' ? 'İşlem hatası:' : 'Operation error:'} ${err.message}`;
            await showCustomAlert(hata, okText);
        }
    }
}