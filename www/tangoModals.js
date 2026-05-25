import { translations } from './config.js';
import { dbUpdateTagsDirectly, dbUpdateNote } from './tangoVeritabani.js';
import { renderChips } from './uiRenderer.js';

export let modalTagsArray = [];
export let activeEditTagsVideoId = null;

export function convertDriveUrlToEmbed(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        const regExp = /\/file\/d\/([^/]+)/;
        const matches = url.match(regExp);
        if (matches && matches[1]) {
            return `https://drive.google.com/file/d/${matches[1]}/preview`;
        }
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('shorts/')) {
            videoId = url.split('shorts/')[1]?.split(/[?#]/)[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
        } else if (url.includes('v=')) {
            videoId = url.split('v=')[1]?.split('&')[0]?.split(/[?#]/)[0];
        } else if (url.includes('embed/')) {
            videoId = url.split('embed/')[1]?.split(/[?#]/)[0];
        }
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}`;
        }
    }
    return url;
}

export function openVideoModal(url) {
    const embedUrl = convertDriveUrlToEmbed(url);
    document.getElementById('modal-iframe').src = embedUrl;
    document.getElementById('video-modal').classList.remove('d-none');
}

export function closeVideoModal() {
    document.getElementById('video-modal').classList.add('d-none');
    document.getElementById('modal-iframe').src = '';
}

export function openTagsEditModal(video, globalVideos, applyFiltersAndSearch) {
    activeEditTagsVideoId = video.id;
    document.getElementById('tags-edit-modal').classList.remove('d-none');
    modalTagsArray.length = 0;
    if (video.tags) {
        video.tags.split(',').map(t => t.trim()).filter(t => t !== '').forEach(t => modalTagsArray.push(t));
    }
    renderModalChips(globalVideos, applyFiltersAndSearch);
}

export function closeTagsEditModal() {
    document.getElementById('tags-edit-modal').classList.add('d-none');
    activeEditTagsVideoId = null;
    modalTagsArray = [];
    document.getElementById('modal-tags-input').value = '';
}

export function renderModalChips(globalVideos, applyFiltersAndSearch) {
    renderChips('modal-chips-area', modalTagsArray, (index) => {
        modalTagsArray.splice(index, 1);
        saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch);
    });
}

export async function saveTagsToSupabaseDirectly(globalVideos, applyFiltersAndSearch) {
    if (!activeEditTagsVideoId) return;
    const cleanTags = modalTagsArray.filter(t => t !== '').join(', ');
    try {
        await dbUpdateTagsDirectly(activeEditTagsVideoId, cleanTags);
        const vid = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (vid) vid.tags = cleanTags || null;
        renderModalChips(globalVideos, applyFiltersAndSearch);
        applyFiltersAndSearch();
    } catch (err) {
        console.error("Etiket güncellenirken hata oluştu:", err);
    }
}

export function showCustomAlert(message, okText = 'Tamam') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.classList.add('d-none');
        modal.classList.remove('d-none');

        const handleOk = () => {
            modal.classList.add('d-none');
            okBtn.removeEventListener('click', handleOk);
            resolve();
        };
        okBtn.addEventListener('click', handleOk);
    });
}

export function showCustomConfirm(message, okText = 'Tamam', cancelText = 'İptal') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.innerText = cancelText;
        cancelBtn.classList.remove('d-none');
        modal.classList.remove('d-none');

        const handleOk = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve(true);
        };
        const handleCancel = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve(false);
        };
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// 2. ADIM: Not düzenleme modalı
let activeNoteVideoId = null;

export function openNoteEditModal(video, onNoteSavedCallback) {
    activeNoteVideoId = video.id;
    const currentNote = video.notes || '';
    
    const modal = document.getElementById('custom-dialog-modal');
    const msgEl = document.getElementById('custom-dialog-message');
    const okBtn = document.getElementById('custom-dialog-ok-btn');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
    
    msgEl.innerHTML = `<textarea id="note-textarea" rows="4" style="width:100%; background:#0b0813; color:#f1f5f9; border:1px solid #ff007f; border-radius:8px; padding:8px;">${escapeHtml(currentNote)}</textarea>`;
    
    okBtn.innerText = 'Kaydet';
    cancelBtn.innerText = 'İptal';
    cancelBtn.classList.remove('d-none');
    modal.classList.remove('d-none');
    
    const handleOk = async () => {
        const newNote = document.getElementById('note-textarea').value;
        try {
            await dbUpdateNote(activeNoteVideoId, newNote);
            if (onNoteSavedCallback) onNoteSavedCallback();
        } catch (err) {
            console.error(err);
            alert('Not kaydedilemedi');
        }
        modal.classList.add('d-none');
        cleanup();
    };
    
    const handleCancel = () => {
        modal.classList.add('d-none');
        cleanup();
    };
    
    const cleanup = () => {
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}