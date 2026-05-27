// Ortak yardımcı fonksiyonlar

let currentLangForUtils = 'tr'; // app.js'den set edilecek

export function setCurrentLangForUtils(lang) {
    currentLangForUtils = lang;
}

export function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        if (show) overlay.classList.remove('d-none');
        else overlay.classList.add('d-none');
    }
}

export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

export function showModernPrompt(title, defaultValue = '', placeholder = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
        
        msgEl.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: 500;">${escapeHtml(title)}</div>
            <input type="text" id="modern-prompt-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" style="width:100%; padding:10px; background:#0b0813; border:1px solid #ff007f; border-radius:8px; color:#f1f5f9; outline:none;">
        `;
        
        okBtn.innerText = currentLangForUtils === 'tr' ? 'Tamam' : 'OK';
        cancelBtn.innerText = currentLangForUtils === 'tr' ? 'İptal' : 'Cancel';
        cancelBtn.classList.remove('d-none');
        modal.classList.remove('d-none');
        
        const input = document.getElementById('modern-prompt-input');
        input.focus();
        
        const handleOk = () => {
            const value = input.value.trim();
            modal.classList.add('d-none');
            cleanup();
            resolve(value || null);
        };
        const handleCancel = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve(null);
        };
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keypress', keyHandler);
        };
        const keyHandler = (e) => {
            if (e.key === 'Enter') handleOk();
            if (e.key === 'Escape') handleCancel();
        };
        input.addEventListener('keypress', keyHandler);
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}