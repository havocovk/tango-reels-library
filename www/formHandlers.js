// formHandlers.js - Video ekleme ve güncelleme
// ✅ GÜNCELLEME (Adım 6.1): URL olmadan Drive linki yeterli
// ✅ GÜNCELLEME (Adım 4.1): YouTube metadata bilgi kutusu (başlık + süre)
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

// ─────────────────────────────────────────────────────────────
// YouTube video ID çıkarma
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// YouTube thumbnail + metadata otomatik çekme
// ✅ GÜNCELLEME (Adım 4.1): Başlık ve süre bilgi kutusunda gösteriliyor
// ─────────────────────────────────────────────────────────────
export async function autoFetchThumbnail(url) {
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
        // YouTube değilse bilgi kutusunu gizle
        _hideMetaBox();
        return null;
    }

    // 1. Thumbnail — API key gerekmez
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const imgPreview = document.getElementById('image-preview');
    const dropAreaText = document.getElementById('drop-area-text');
    if (imgPreview) {
        imgPreview.src = thumbnailUrl;
        imgPreview.classList.remove('d-none');
        if (dropAreaText) dropAreaText.classList.add('d-none');
    }

    // 2. Metadata — yükleniyor göster
    _showMetaBox('⏳ Video bilgileri yükleniyor...', '');

    try {
        const metaRes = await fetch(`/api/youtube-metadata?videoId=${encodeURIComponent(videoId)}`);
        if (metaRes.ok) {
            const meta = await metaRes.json();

            // Bilgi kutusunu doldur
            if (meta.title) {
                _showMetaBox(meta.title, meta.duration || '');
            }

            // Store'a geçici kaydet (Adım 4.2 AI etiket önerisi için)
            store.set('pendingDuration', meta.duration || null);
            store.set('pendingDescription', meta.description || null);
            store.set('pendingTitle', meta.title || null);
        } else {
            _hideMetaBox();
        }
    } catch (err) {
        console.warn('[Adım 4.1] YouTube metadata çekilemedi:', err.message);
        _hideMetaBox();
    }

    return thumbnailUrl;
}

// Metadata bilgi kutusunu göster
function _showMetaBox(title, duration) {
    const box = document.getElementById('yt-meta-box');
    if (!box) return;
    box.classList.remove('d-none');
    const titleEl = document.getElementById('yt-meta-title');
    const durEl = document.getElementById('yt-meta-duration');
    if (titleEl) titleEl.textContent = title;
    if (durEl) durEl.textContent = duration ? `⏱ ${duration}` : '';
}

// Metadata bilgi kutusunu gizle
function _hideMetaBox() {
    const box = document.getElementById('yt-meta-box');
    if (box) box.classList.add('d-none');
}

// ─────────────────────────────────────────────────────────────
// handleFormSubmit — Video kaydetme / güncelleme
// ─────────────────────────────────────────────────────────────
export async function handleFormSubmit(e) {
    e.preventDefault();
    const currentLang = store.get('currentLang');
    const lang = translations[currentLang];
    const okText = currentLang === 'tr' ? 'Tamam' : 'OK';

    const instructor_id = document.getElementById('form-instructor-select').value;
    let url = document.getElementById('form-video-url').value.trim();
    const role_type    = document.getElementById('form-role-select').value;
    const content_type = document.querySelector('input[name="content_type"]:checked')?.value || 'combination';
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
    if (!cover_url && url && extractYoutubeVideoId(url)) {
        cover_url = await autoFetchThumbnail(url);
    }

    // ── Doğrulama ──
    if (!instructor_id) {
        return showCustomAlert(
            currentLang === 'tr' ? 'Lütfen eğitmen seçin!' : 'Please select instructor!', okText
        );
    }
    if (is_downloaded && !drive_url) {
        return showCustomAlert(
            currentLang === 'tr' ? 'Drive linki zorunludur!' : 'Drive link is required!', okText
        );
    }
    if (!url && !drive_url) {
        return showCustomAlert(
            currentLang === 'tr'
                ? 'Video URL veya Drive linki zorunludur!'
                : 'Video URL or Drive link is required!',
            okText
        );
    }

    let platform = (is_downloaded || (!url && drive_url)) ? 'drive' : detectPlatform(url, false);
    let finalUrl = url;
    if (!finalUrl || finalUrl === '') {
        finalUrl = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }

    // Adım 4.1: duration store'dan al
    const duration = store.get('pendingDuration') || null;

    const payload = {
        instructor_id: parseInt(instructor_id),
        url: finalUrl,
        role_type,
        partner_name: partner_name || null,
        tags: tags || null,
        is_downloaded,
        drive_url: drive_url || null,
        cover_url,
        platform,
        duration: duration,
        content_type: content_type
    };

    try {
        const updatedVideo = await dbSaveVideo(editingVideoId, payload, editingVideoUpdatedAt);
        const instructors = store.get('globalInstructors');
        const instructor = instructors.find(i => i.id === parseInt(instructor_id));

        if (editingVideoId) {
            if (updatedVideo) {
                updatedVideo.instructors = { name: instructor?.name || 'Bilinmeyen' };
                store.updateVideoLocally(editingVideoId, updatedVideo);
                if (updatedVideo.updated_at) editingVideoUpdatedAt = updatedVideo.updated_at;
            } else {
                const newData = {
                    ...payload,
                    instructors: { name: instructor?.name || 'Bilinmeyen' },
                    updated_at: new Date().toISOString()
                };
                store.updateVideoLocally(editingVideoId, newData);
                editingVideoUpdatedAt = newData.updated_at;
            }
        } else {
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

        await showCustomAlert(
            editingVideoId
                ? (currentLang === 'tr' ? '✅ Video güncellendi!' : '✅ Video updated!')
                : (currentLang === 'tr' ? '✅ Video eklendi!' : '✅ Video added!'),
            okText
        );

        // Formu sıfırla
        _resetForm();

        // Store temizle
        store.set('pendingDuration', null);
        store.set('pendingDescription', null);
        store.set('pendingTitle', null);

        if (callSwitchViewCallback) callSwitchViewCallback('library');

    } catch (err) {
        console.error('Form kayıt hatası:', err);
        await showCustomAlert(
            currentLang === 'tr' ? `Hata: ${err.message}` : `Error: ${err.message}`,
            okText
        );
    }
}

function _resetForm() {
    ['form-video-url', 'form-partner-name', 'form-drive-url'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    formTagsArray.length = 0;
    renderFormChips();

    resetUploadedCoverUrl();
    const imgPreview = document.getElementById('image-preview');
    if (imgPreview) { imgPreview.src = ''; imgPreview.classList.add('d-none'); }
    const dropAreaText = document.getElementById('drop-area-text');
    if (dropAreaText) dropAreaText.classList.remove('d-none');

    const driveContainer = document.getElementById('drive-url-container');
    if (driveContainer) driveContainer.classList.add('d-none');

    const isDownloaded = document.getElementById('form-is-downloaded');
    if (isDownloaded) isDownloaded.checked = false;

    store.set('editingVideoId', null);
    editingVideoUpdatedAt = null;

    _hideMetaBox();

    const currentLang = store.get('currentLang');
    updateSmartFilenameAssistant(currentLang, []);
}