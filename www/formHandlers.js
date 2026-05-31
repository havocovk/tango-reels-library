// formHandlers.js - Video ekleme ve güncelleme (YouTube thumbnail + eğitmen adı fix)
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

// ========= YOUTUBE THUMBNAIL YARDIMCISI =========
function extractYoutubeVideoId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function autoFetchThumbnail(url) {
    const videoId = extractYoutubeVideoId(url);
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (videoId && imgPreview) {
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        imgPreview.src = thumbUrl;
        imgPreview.classList.remove('d-none');
        if (dropAreaText) dropAreaText.classList.add('d-none');
        return thumbUrl;
    }
    return null;
}

// ========= FORM SUBMIT (EĞİTMEN ADI DÜZELTİLDİ) =========
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
    
    // Eğer kapak yoksa ve YouTube linki varsa otomatik al
    if (!cover_url && url && !is_downloaded) {
        const autoThumb = autoFetchThumbnail(url);
        if (autoThumb) cover_url = autoThumb;
    }
    
    if (!cover_url && editingVideoId) {
        const curr = store.get('globalVideos').find(v => v.id === editingVideoId);
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
        const updatedVideo = await dbSaveVideo(editingVideoId, payload, editingVideoUpdatedAt);
        
        // Eğitmen adını al
        const instructors = store.get('globalInstructors');
        const instructorName = instructors.find(i => i.id === (updatedVideo?.instructor_id || instructor_id))?.name || 'Bilinmeyen Eğitmen';
        
        if (editingVideoId) {
            if (updatedVideo) {
                updatedVideo.instructor_name = instructorName;
                store.updateVideoLocally(editingVideoId, updatedVideo);
                if (updatedVideo.updated_at) editingVideoUpdatedAt = updatedVideo.updated_at;
            } else {
                const newData = { ...payload, instructor_name: instructorName, updated_at: new Date().toISOString() };
                store.updateVideoLocally(editingVideoId, newData);
                editingVideoUpdatedAt = newData.updated_at;
            }
        } else {
            if (updatedVideo) {
                updatedVideo.instructor_name = instructorName;
                store.addVideoLocally(updatedVideo);
            } else {
                const newVideo = {
                    id: Date.now(),
                    ...payload,
                    instructor_name: instructorName,
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

// ========= EVENT LISTENER'LAR (app.js'de çağrılacak) =========
export function bindYouTubeThumbnailListener() {
    const urlInput = document.getElementById('form-video-url');
    if (urlInput && !urlInput.dataset.thumbListener) {
        urlInput.addEventListener('input', (e) => {
            autoFetchThumbnail(e.target.value);
        });
        urlInput.dataset.thumbListener = 'true';
    }
}