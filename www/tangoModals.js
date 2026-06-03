// tangoModals.js - Modal yönetim modülü
// ✅ GÜNCELLEME (Adım 1.1): önemli mesajlar persistent: true ile gösteriliyor

import { showCustomAlert as showCustomAlertFromUtils } from './utils.js';
import { store } from './store.js';

// Toast fonksiyonunu dışa aktar (utils.js'deki showToast çağrısı için)
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container bulunamadı');
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        z-index: 9999;
        max-width: 300px;
        word-wrap: break-word;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInUp 0.3s ease-out;
    `;
    toast.innerText = message;
    container.appendChild(toast);

    const timeout = setTimeout(() => {
        toast.style.animation = 'slideOutDown 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, duration);

    return () => {
        clearTimeout(timeout);
        toast.remove();
    };
}

// Kontrol: window.showToast'ı şimdi export et
if (typeof window !== 'undefined') {
    window.showToast = showToast;
}

// ================= PERSISTENT MODAL WRAPPER =================
/**
 * showCustomAlert — yeni wrapper (Adım 1.1)
 * 
 * Kendi showCustomAlert fonksiyonumuz olacak; utils.js'deki fonksiyonun
 * hemen üstünde (çünkü showToast'ı buradan tanımlıyoruz).
 * 
 * Eğer persistent=true verilirse → utils'teki persistent modal kullan
 * Eğer persistent=false verilirse → buradaki showToast kullan
 */
export function showCustomAlert(message, okText = '', persistent = false) {
    // Dil ayarı
    const lang = store.get ? store.get('currentLang') : 'tr';
    if (!okText) {
        okText = lang === 'tr' ? 'Tamam' : 'OK';
    }

    // utils.js'deki fonksiyonun yerini işgal etsin (persistent desteğiyle)
    return showCustomAlertFromUtils(message, okText, persistent);
}

// ================= ONAY MODALI (değişmedi) =================
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

// ================= NOT DÜZENLEME MODALI =================
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
            // Bu satırda dbUpdateNote fonksiyonunu çağırıyoruz
            // (tanımı proje içinde başka dosyada)
            if (window.dbUpdateNote) {
                const updatedVideo = await window.dbUpdateNote(activeNoteVideoId, newNote, activeNoteVideoUpdatedAt);
                
                const globalVideosNow = store.get('globalVideos');
                const videoIndex = globalVideosNow.findIndex(v => v.id === activeNoteVideoId);
                if (videoIndex !== -1) {
                    if (updatedVideo && updatedVideo.updated_at) {
                        globalVideosNow[videoIndex].updated_at = updatedVideo.updated_at;
                    }
                    globalVideosNow[videoIndex].notes = newNote || null;
                    store.set('globalVideos', [...globalVideosNow]);
                }
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

// ================= VİDEO AÇILIŞ MODALI =================
let activeEditVideoId = null;
let activeEditVideoUpdatedAt = null;

export function openVideoModal(video) {
    const globalVideos = store.get('globalVideos');
    const fullVideo = globalVideos.find(v => v.id === video.id) || video;
    
    activeEditVideoId = fullVideo.id;
    activeEditVideoUpdatedAt = fullVideo.updated_at;

    const modal = document.getElementById('video-modal');
    if (!modal) return;

    modal.classList.remove('d-none');
    // Video detayları modal içinde gösterilir
    if (window.renderVideoDetails) {
        window.renderVideoDetails(fullVideo);
    }
}

export function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    if (modal) modal.classList.add('d-none');
}