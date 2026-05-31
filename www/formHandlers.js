// formHandlers.js - Video ekleme ve güncelleme (optimize: fetchVideos yok, hata düzeltildi)
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
        // dbSaveVideo artık doğrudan güncellenmiş video nesnesini döndürüyor
        const updatedVideo = await dbSaveVideo(editingVideoId, payload, editingVideoUpdatedAt);
        
        if (editingVideoId) {
            // Video güncellendi: mevcut videoyu güncelle
            if (updatedVideo) {
                // instructor_name'i de ekleyelim (store'daki videolarda instructor_name var)
                const instructor = store.get('globalInstructors').find(i => i.id === updatedVideo.instructor_id);
                updatedVideo.instructor_name = instructor?.name || 'Bilinmeyen';
                store.updateVideoLocally(editingVideoId, updatedVideo);
                // editingVideoUpdatedAt'ı yeni değerle güncelle (çakışma önleme)
                if (updatedVideo.updated_at) {
                    editingVideoUpdatedAt = updatedVideo.updated_at;
                }
            } else {
                // Fallback: payload ile güncelle
                const instructor = store.get('globalInstructors').find(i => i.id === instructor_id);
                store.updateVideoLocally(editingVideoId, {
                    ...payload,
                    instructor_name: instructor?.name || 'Bilinmeyen',
                    updated_at: new Date().toISOString()
                });
            }
        } else {
            // Yeni video eklendi
            if (updatedVideo) {
                const instructor = store.get('globalInstructors').find(i => i.id === updatedVideo.instructor_id);
                updatedVideo.instructor_name = instructor?.name || 'Bilinmeyen';
                store.addVideoLocally(updatedVideo);
            } else {
                // Fallback
                const instructor = store.get('globalInstructors').find(i => i.id === instructor_id);
                const newVideo = {
                    id: Date.now(),
                    ...payload,
                    instructor_name: instructor?.name || 'Bilinmeyen',
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
        // 🔥 fetchVideosCallback çağrılmıyor!
    } catch (err) {
        let hataMesaji = err.message;
        if (hataMesaji.includes('ÇAKIŞMA')) {
            await showCustomAlert(hataMesaji, okText);
            // Çakışma durumunda verileri yenilemek güvenli olur (kullanıcıya sayfa yenileme önerisi)
            if (callSwitchViewCallback) callSwitchViewCallback('library');
            if (fetchVideosCallback) await fetchVideosCallback();
            location.reload(); // En temizi
        } else {
            let hata = `${currentLang === 'tr' ? 'İşlem hatası:' : 'Operation error:'} ${err.message}`;
            await showCustomAlert(hata, okText);
        }
    }
}