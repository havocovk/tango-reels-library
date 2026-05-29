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
        case 'success': return '✅';
        case 'error':   return '❌';
        case 'warning': return '⚠️';
        default:        return 'ℹ️';
    }
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