import { escapeHtml } from './utils.js'; // Adim 1.2
import { icon } from './icons.js';
// ✅ GÜNCELLEME: Emoji ikonlar Lucide SVG ikonlarına çevrildi

// toast.js - Otomatik kaybolan bildirimler
let activeToasts = [];

export function showToast(message, type = 'info', duration = 3000) {
    // Mevcut en yaşlı tostu kaldır (max 3 toast aynı anda)
    if (activeToasts.length >= 3) {
        const oldest = activeToasts.shift();
        oldest.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${getIconForType(type)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
        <button class="toast-close">&times;</button>
    `;
    
    document.body.appendChild(toast);
    activeToasts.push(toast);
    
    // Animasyon ile görünür yap
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Kapatma butonu
    toast.querySelector('.toast-close').onclick = () => {
        removeToast(toast);
    };
    
    // Otomatik kapatma
    const timeout = setTimeout(() => {
        removeToast(toast);
    }, duration);
    
    toast._timeout = timeout;
    
    function removeToast(t) {
        clearTimeout(t._timeout);
        t.classList.remove('show');
        setTimeout(() => {
            if (t.parentNode) t.parentNode.removeChild(t);
            const index = activeToasts.indexOf(t);
            if (index !== -1) activeToasts.splice(index, 1);
        }, 300);
    }
}

function getIconForType(type) {
    switch(type) {
        case 'success': return icon('check-circle',   { size: 18, color: '#4ade80' });
        case 'error':   return icon('x-circle',       { size: 18, color: '#ef4444' });
        case 'warning': return icon('alert-triangle', { size: 18, color: '#f59e0b' });
        default:        return icon('lightbulb',      { size: 18, color: '#00f0ff' });
    }
}

// escapeHtml -> utils.js (Adim 1.2)