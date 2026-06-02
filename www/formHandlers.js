// formHandlers.js - Video ekleme ve güncelleme (thumbnail otomatik, instructor hatası düzeltildi)
import { getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { dbSaveVideo, detectPlatform } from './tangoVeritabani.js';
import { showCustomAlert } from './tangoModals.js';
import { renderChips } from './uiRenderer.js';
import { translations } from './i18n.js';
import { updateSmartFilenameAssistant } from './tangoUI.js';
import { store } from './store.js';

export let formTagsArray = [];
let editingVideoUpdatedAt = null;
let globalVideos = [];
let fetchVideosCallback = null;
let callSwitchViewCallback = null;

export function setFormHandlersGlobalData(lang, tagsArray, videos) {
    store.set('currentLang', lang);
    formTagsArray = tagsArray;
    globalVideos = videos;
}

export function initFormHandlers(tagsArray, videos, fetchCb, switchCb) {
    formTagsArray = tagsArray;
    globalVideos = videos;
    fetchVideosCallback = fetchCb;
    callSwitchViewCallback = switchCb;
}

export function setEditingVideoId(id) {
    store.set('editingVideoId', id);
}

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
    const currentLang = store.get('currentLang');
    renderChips('chips-area', formTagsArray, (index) => {
        formTagsArray.splice(index, 1);
        renderFormChips();
        updateSmartFilenameAssistant(currentLang, formTagsArray);
    });
}

// ========= YOUTUBE THUMBNAIL OTOMATİK =========
export function extractYoutubeVideoId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?#]+)/,
        /youtube\.com\/embed\/([^&?#]+)/
    ];
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

export async function autoFetchThumbnail(url) {
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) return null;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (imgPreview) {
        imgPreview.src = thumbnailUrl;
        imgPreview.classList.remove('d-none');
        if (dropAreaText) dropAreaText.classList.add('d-none');
    }
    return thumbnailUrl;
}

// ========= FORM KAYIT (düzeltilmiş instructor bilgisi) =========
export async function handleFormSubmit(e) {
    e.preventDefault();
    const currentLang = store.get('currentLang');
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
    
    const editingVideoId = store.get('editingVideoId');
    if (!cover_url && editingVideoId) {
        const curr = store.get('globalVideos').find(v => v.id === editingVideoId);
        if (curr) cover_url = curr.cover_url;
    }
    // Eğer kapak yoksa ve URL YouTube ise otomatik çek
    if (!cover_url && url && extractYoutubeVideoId(url)) {
        cover_url = await autoFetchThumbnail(url);
    }
    
    if (!instructor_id) return showCustomAlert(currentLang === 'tr' ? 'Lütfen eğitmen seçin!' : 'Please select instructor!', okText);
    if (is_downloaded && !drive_url) return showCustomAlert(currentLang === 'tr' ? 'Drive linki zorunludur!' : 'Drive link is required!', okText);
    if (!url && !drive_url) return showCustomAlert(currentLang === 'tr' ? 'Video URL veya Drive linki zorunludur!' : 'Video URL or Drive link is required!', okText);
    
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
        const updatedVideo = await dbSaveVideo(editingVideoId, payload, editingVideoUpdatedAt);
        const instructors = store.get('globalInstructors');
        const instructor = instructors.find(i => i.id === parseInt(instructor_id));
        
        if (editingVideoId) {
            // Güncelleme
            if (updatedVideo) {
                // instructors objesini ekle (render için)
                updatedVideo.instructors = { name: instructor?.name || 'Bilinmeyen' };
                store.updateVideoLocally(editingVideoId, updatedVideo);
                if (updatedVideo.updated_at) editingVideoUpdatedAt = updatedVideo.updated_at;
            } else {
                const newData = { ...payload, instructors: { name: instructor?.name || 'Bilinmeyen' }, updated_at: new Date().toISOString() };
                store.updateVideoLocally(editingVideoId, newData);
                editingVideoUpdatedAt = newData.updated_at;
            }
        } else {
            // Yeni video
            if (updatedVideo) {
                updatedVideo.instructors = { name: instructor?.name || 'Bilinmeyen' };
                store.addVideoLocally(updatedVideo);
            } else {
                const newVideo = {
                    id: Date.now(),
                    ...payload,
                    instructors: { name: instructor?.name || 'Bilinmeyen' },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                store.addVideoLocally(newVideo);
            }
        }
        
        await showCustomAlert(editingVideoId ? lang.successUpdate : lang.successSave, okText);
        store.set('editingVideoId', null);
        editingVideoUpdatedAt = null;
        setFormTagsArray([]);
        renderFormChips();
        document.getElementById('add-video-form').reset();
        const imgPreview = document.getElementById('image-preview');
        if (imgPreview) imgPreview.classList.add('d-none');
        const dropAreaText = document.getElementById('drop-area-text');
        if (dropAreaText) dropAreaText.innerText = lang.dropText;
        const driveUrlContainer = document.getElementById('drive-url-container');
        if (driveUrlContainer) driveUrlContainer.classList.add('d-none');
        resetUploadedCoverUrl();
        if (callSwitchViewCallback) callSwitchViewCallback('library');
    } catch (err) {
        let hataMesaji = err.message;
        if (hataMesaji.includes('ÇAKIŞMA')) {
            await showCustomAlert(hataMesaji, okText);
            if (callSwitchViewCallback) callSwitchViewCallback('library');
            if (fetchVideosCallback) await fetchVideosCallback();
            location.reload();
        } else {
            let hata = `${currentLang === 'tr' ? 'İşlem hatası:' : 'Operation error:'} ${err.message}`;
            await showCustomAlert(hata, okText);
        }
    }
}