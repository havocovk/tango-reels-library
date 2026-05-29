// tangoModals.js - Güncellenmiş (showCustomAlert toast olarak)
import { translations } from './config.js';
import { dbUpdateTagsDirectly, dbUpdateNote } from './tangoVeritabani.js';
import { renderChips } from './uiRenderer.js';
import { showToast } from './toast.js';   // ✅ yeni import

// Modal durum değişkenleri (aynı)
export let modalTagsArray = [];
export let activeEditTagsVideoId = null;
export let activeEditTagsVideoUpdatedAt = null;

// ... convertDriveUrlToEmbed, openVideoModal, closeVideoModal aynı kalır ...

export function openTagsEditModal(video, globalVideos, applyFiltersAndSearch) {
    activeEditTagsVideoId = video.id;
    activeEditTagsVideoUpdatedAt = video.updated_at;
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
    activeEditTagsVideoUpdatedAt = null;
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
        await dbUpdateTagsDirectly(activeEditTagsVideoId, cleanTags, activeEditTagsVideoUpdatedAt);
        const vid = globalVideos.find(v => v.id === activeEditTagsVideoId);
        if (vid) vid.tags = cleanTags || null;
        renderModalChips(globalVideos, applyFiltersAndSearch);
        applyFiltersAndSearch();
        showToast('Etiketler güncellendi', 'success');  // 🍞 toast
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

// ✅ YENİ showCustomAlert: toast olarak göster
export function showCustomAlert(message, okText = 'Tamam') {
    // okText parametresi artık kullanılmıyor, toast'lar tıklama gerektirmez
    showToast(message, 'info', 3000);
    return Promise.resolve(); // uyumluluk için
}

// ✅ showCustomConfirm aynen kalır (modal)
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

// openNoteEditModal (değişmedi)
let activeNoteVideoId = null;
let activeNoteVideoUpdatedAt = null;

export function openNoteEditModal(video, onNoteSavedCallback) {
    activeNoteVideoId = video.id;
    activeNoteVideoUpdatedAt = video.updated_at;
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
            await dbUpdateNote(activeNoteVideoId, newNote, activeNoteVideoUpdatedAt);
            if (onNoteSavedCallback) onNoteSavedCallback(newNote);
            showToast('Not kaydedildi', 'success');  // 🍞 toast
        } catch (err) {
            if (err.message.includes('ÇAKIŞMA')) {
                showToast('Bu video başka bir cihazda değiştirildi. Sayfayı yenileyin.', 'error');
                location.reload();
            } else {
                console.error(err);
                showToast('Not kaydedilemedi', 'error');
            }
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