// utils.js - Ortak yardımcı fonksiyonlar
// ✅ GÜNCELLEME (Adım 1.1): showCustomAlert() persistent modal desteği
// ✅ GÜNCELLEME (Backup v2.1): fetchWithRetry artık 409'u throw etmiyor,
//    yanıtı olduğu gibi döndürüyor (409 deterministiktir, retry anlamsız)

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

export function convertYoutubeUrlToEmbed(url) {
    if (!url) return url;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
    return url;
}

export function showModernPrompt(title, defaultValue = '', placeholder = '') {
    return new Promise((resolve) => {
        const modal   = document.getElementById('custom-dialog-modal');
        const msgEl   = document.getElementById('custom-dialog-message');
        const okBtn   = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        msgEl.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: 500;">${escapeHtml(title)}</div>
            <input type="text" id="modern-prompt-input"
                value="${escapeHtml(defaultValue)}"
                placeholder="${escapeHtml(placeholder)}"
                style="width:100%; padding:10px; background:#0b0813; border:1px solid #ff007f;
                       border-radius:8px; color:#f1f5f9; outline:none;">
        `;

        okBtn.innerText     = currentLangForUtils === 'tr' ? 'Tamam' : 'OK';
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
            if (e.key === 'Enter')  handleOk();
            if (e.key === 'Escape') handleCancel();
        };
        input.addEventListener('keypress', keyHandler);
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// ================================================================
// FETCH RETRY
// ✅ DÜZELTME (Backup v2.1):
//   - 409 Conflict artık throw etmiyor, yanıtı olduğu gibi döndürüyor.
//     Böylece çağıran kod res.status === 409 kontrolü yapabilir.
//   - 409 deterministik bir çakışmadır; yeniden denemek işe yaramaz.
//   - Diğer davranışlar değişmedi (5xx retry, 4xx throw).
// ================================================================
export async function fetchWithRetry(url, options = {}, retries = 3, baseDelay = 1000) {
    // Auth token inject: giriş yapılmışsa tüm Supabase çağrılarına JWT yaz
    const isSupabaseApi = url.includes('supabase.co');
    if (isSupabaseApi && window.__tangoAuthToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${window.__tangoAuthToken}`;
    }

    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);

            // ✅ 409 Conflict → throw etme, döndür (retry anlamsız)
            // Çakışma: kayıt zaten var. Çağıran kod res.status === 409
            // kontrolü yapabilsin diye yanıt objesi döndürülür.
            if (response.status === 409) {
                return response;
            }

            // Başarılı yanıt
            if (response.ok) return response;

            // 4xx hatalar (409 hariç): retry yapma, throw et
            if (response.status >= 400 && response.status < 500) {
                throw new Error(`HTTP ${response.status}`);
            }

            // 5xx ve ağ hataları: retry dene
            throw new Error(`HTTP ${response.status}`);

        } catch (err) {
            lastError = err;
            if (attempt === retries) break;
            const delay = baseDelay * Math.pow(2, i);
            console.warn(`Fetch hatası (deneme ${i + 1}/${retries}):`, err.message, `Retrying in ${delay}ms...`, err);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

// ================================================================
// PERSISTENT MODAL DESTEĞI
// ================================================================
/**
 * showCustomAlert(message, okText, persistent)
 *   persistent = false → 3 saniyede kaybolan toast
 *   persistent = true  → "Tamam" ile kapanan modal
 */
export function showCustomAlert(message, okText = '', persistent = false) {
    if (!okText) {
        okText = currentLangForUtils === 'tr' ? 'Tamam' : 'OK';
    }

    // Toast (geçici)
    if (!persistent) {
        if (window.showToast) {
            window.showToast(message, 'info', 3000);
        } else {
            console.log('[Alert]', message);
        }
        return Promise.resolve();
    }

    // Persistent Modal
    return new Promise((resolve) => {
        const modal     = document.getElementById('custom-dialog-modal');
        const msgEl     = document.getElementById('custom-dialog-message');
        const okBtn     = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            console.error('Modal öğeleri bulunamadı!');
            resolve();
            return;
        }

        msgEl.innerText = message;
        okBtn.innerText = okText;
        cancelBtn.classList.add('d-none');
        modal.classList.remove('d-none');
        setTimeout(() => okBtn.focus(), 50);

        const handleOk = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve();
        };
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            document.removeEventListener('keydown', handleKeydown);
        };
        const handleKeydown = (e) => {
            if (e.key === 'Enter') handleOk();
        };
        okBtn.addEventListener('click', handleOk);
        document.addEventListener('keydown', handleKeydown);
    });
}

// ================================================================
// ABONELİK YÖNETİMİ
// ================================================================
let subscriptions = [];

export function addSubscription(unsubscribeFn) {
    subscriptions.push(unsubscribeFn);
}

export function cleanupSubscriptions() {
    subscriptions.forEach(u => u());
    subscriptions = [];
}