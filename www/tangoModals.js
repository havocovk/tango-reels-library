// tangoModals.js - DÜZELTME: store'dan globalVideos, updated_at her kayıtta güncelleniyor
// ✅ GÜNCELLEME (Adım 1.1): showCustomAlert() artık persistent modal desteği yapıyor
import { translations } from './i18n.js';
import { dbUpdateTagsDirectly, dbUpdateNote } from './tangoVeritabani.js';
import { renderChips } from './uiRenderer.js';
import { showToast } from './toast.js';
import { store } from './store.js';
import { escapeHtml } from './utils.js'; // Adim 1.2

// ===================== MODAL STATE'LER =====================
export let modalTagsArray = [];
export let activeEditTagsVideoId = null;
export let activeEditTagsVideoUpdatedAt = null;

// ===================== CALLBACK BAŞLATMA =====================
let _applyFiltersAndSearch = null;

export function initModalCallbacks(applyFiltersAndSearchFn) {
    _applyFiltersAndSearch = applyFiltersAndSearchFn;
}

// ===================== VİDEO MODAL FONKSİYONLARI =====================
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
    const iframe = document.getElementById('modal-iframe');
    if (iframe) iframe.src = embedUrl;
    const modal = document.getElementById('video-modal');
    if (modal) modal.classList.remove('d-none');
}

export function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    if (modal) modal.classList.add('d-none');
    const iframe = document.getElementById('modal-iframe');
    if (iframe) iframe.src = '';
}

// ===================== ETİKET DÜZENLEME MODALI =====================
export function openTagsEditModal(video) {
    activeEditTagsVideoId = video.id;
    activeEditTagsVideoUpdatedAt = video.updated_at;
    const modal = document.getElementById('tags-edit-modal');
    if (modal) modal.classList.remove('d-none');

    modalTagsArray.length = 0;
    if (video.tags) {
        video.tags.split(',').map(t => t.trim()).filter(t => t !== '').forEach(t => modalTagsArray.push(t));
    }
    renderModalChips();
}

export function closeTagsEditModal() {
    const modal = document.getElementById('tags-edit-modal');
    if (modal) modal.classList.add('d-none');
    activeEditTagsVideoId = null;
    activeEditTagsVideoUpdatedAt = null;
    modalTagsArray.length = 0;
    const input = document.getElementById('modal-tags-input');
    if (input) input.value = '';
}

export function renderModalChips() {
    renderChips('modal-chips-area', modalTagsArray, (index) => {
        modalTagsArray.splice(index, 1);
        saveTagsToSupabaseDirectly();
    });
}

export async function saveTagsToSupabaseDirectly() {
    if (!activeEditTagsVideoId) return;
    const cleanTags = modalTagsArray.filter(t => t !== '').join(', ');
    try {
        const updatedVideo = await dbUpdateTagsDirectly(
            activeEditTagsVideoId,
            cleanTags,
            activeEditTagsVideoUpdatedAt
        );
        if (updatedVideo && updatedVideo.updated_at) {
            activeEditTagsVideoUpdatedAt = updatedVideo.updated_at;
        }
        const updated = store.updateVideoLocally(activeEditTagsVideoId, {
            tags: cleanTags || null,
            updated_at: updatedVideo?.updated_at || activeEditTagsVideoUpdatedAt
        });
        renderModalChips();
        showToast('Etiketler güncellendi', 'success');
        if (_applyFiltersAndSearch) _applyFiltersAndSearch();
    } catch (err) {
        if (err.message.includes('ÇAKIŞMA')) {
            showToast('Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.', 'error');
            location.reload();
        } else {
            console.error("Etiket güncellenirken hata oluştu:", err);
            showToast('Etiketler güncellenemedi: ' + err.message, 'error');
        }
    }
}

// ===================== TOAST ALERT — ADIM 1.1 GÜNCELLEMESİ =====================
// persistent = false (varsayılan) → 3 saniyelik toast (eski davranış korunur)
// persistent = true              → "Tamam" butonuyla kapanan kalıcı modal
export function showCustomAlert(message, okText = 'Tamam', persistent = false) {
    // DURUM 1: Toast (geçici)
    if (!persistent) {
        showToast(message, 'info', 3000);
        return Promise.resolve();
    }

    // DURUM 2: Kalıcı Modal
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            console.error("Modal öğeleri bulunamadı!");
            resolve();
            return;
        }

        msgEl.innerText = message;
        okBtn.innerText = okText;
        // Persistent modallarda sadece "Tamam" butonu görünür
        cancelBtn.classList.add('d-none');
        modal.classList.remove('d-none');

        setTimeout(() => okBtn.focus(), 50);

        const handleOk = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve();
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') handleOk();
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            document.removeEventListener('keydown', handleKeydown);
        };

        okBtn.addEventListener('click', handleOk);
        document.addEventListener('keydown', handleKeydown);
    });
}

// ===================== ONAY MODALI =====================
export function showCustomConfirm(message, okText = 'Tamam', cancelText = 'İptal') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            console.error("Modal öğeleri bulunamadı!");
            resolve(false);
            return;
        }

        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.innerText = cancelText;
        cancelBtn.classList.remove('d-none');
        modal.classList.remove('d-none');

        setTimeout(() => okBtn.focus(), 50);

        const handleOk = () => { modal.classList.add('d-none'); cleanup(); resolve(true); };
        const handleCancel = () => { modal.classList.add('d-none'); cleanup(); resolve(false); };

        const handleKeydown = (e) => {
            if (e.key === 'Escape') { handleCancel(); }
            if (e.key === 'Tab') {
                e.preventDefault();
                if (document.activeElement === okBtn) cancelBtn.focus();
                else okBtn.focus();
            }
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
    });
}

// ===================== NOT DÜZENLEME MODALI =====================
let activeNoteVideoId = null;
let activeNoteVideoUpdatedAt = null;

export function openNoteEditModal(video, onNoteSavedCallback) {
    const globalVideos = store.get('globalVideos');
    const currentVideo = globalVideos.find(v => v.id === video.id) || video;
    
    activeNoteVideoId = currentVideo.id;
    activeNoteVideoUpdatedAt = currentVideo.updated_at;
    const currentNote = currentVideo.notes || '';

    const modal = document.getElementById('custom-dialog-modal');
    const msgEl = document.getElementById('custom-dialog-message');
    const okBtn = document.getElementById('custom-dialog-ok-btn');
    const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

    if (!modal || !msgEl || !okBtn || !cancelBtn) {
        console.error("Modal öğeleri bulunamadı!");
        return;
    }

    msgEl.innerHTML = `<textarea id="note-textarea" rows="4" style="width:100%; background:#0b0813; color:#f1f5f9; border:1px solid #ff007f; border-radius:8px; padding:8px;">${escapeHtml(currentNote)}</textarea>`;

    okBtn.innerText = 'Kaydet';
    cancelBtn.innerText = 'İptal';
    cancelBtn.classList.remove('d-none');
    modal.classList.remove('d-none');

    const handleOk = async () => {
        const newNote = document.getElementById('note-textarea').value;
        try {
            const updatedVideo = await dbUpdateNote(activeNoteVideoId, newNote, activeNoteVideoUpdatedAt);
            
            if (updatedVideo && updatedVideo.updated_at) {
                activeNoteVideoUpdatedAt = updatedVideo.updated_at;
            }

            if (onNoteSavedCallback) onNoteSavedCallback(newNote);

            if (window.applyFiltersAndSearch) window.applyFiltersAndSearch();

            showToast('Not kaydedildi', 'success');
        } catch (err) {
            if (err.message.includes('ÇAKIŞMA')) {
                showToast('Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.', 'error');
                location.reload();
            } else {
                console.error(err);
                showToast('Not kaydedilemedi: ' + err.message, 'error');
            }
        }
        modal.classList.add('d-none');
        cleanup();
    };

    const handleCancel = () => { modal.classList.add('d-none'); cleanup(); };

    const handleKeydown = (e) => {
        if (e.key === 'Escape') handleCancel();
    };

    const cleanup = () => {
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        document.removeEventListener('keydown', handleKeydown);
    };

    setTimeout(() => okBtn.focus(), 50);
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeydown);
}

// escapeHtml -> utils.js (Adim 1.2)