// utils.js - Ortak yardımcı fonksiyonlar (MEVCUT + YENİ)

let currentLangForUtils = 'tr';

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

// ================= YENİ: FETCH RETRY =================
export async function fetchWithRetry(url, options = {}, retries = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            // 409 Conflict - çakışma durumunda retry yapma
            if (response.status === 409) {
                throw new Error('ÇAKIŞMA: Kaynak başka bir cihazda değiştirildi. Sayfayı yenileyin.');
            }
            // Başarılı yanıt
            if (response.ok) return response;
            // 5xx veya ağ hatası (status 0) durumunda retry dene
            if (response.status >= 500 || response.status === 0) {
                throw new Error(`HTTP ${response.status}`);
            }
            // Diğer hatalar (4xx) retry yapma, olduğu gibi döndür
            return response;
        } catch (err) {
            lastError = err;
            // Çakışma hatasını direkt fırlat
            if (err.message.includes('ÇAKIŞMA')) throw err;
            if (attempt === retries) break;
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`Fetch attempt ${attempt} failed. Retrying in ${delay}ms...`, err);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}