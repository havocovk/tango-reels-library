// utils.js - Ortak yardımcı fonksiyonlar (MEVCUT + YENİ)
// ✅ GÜNCELLEME (Adım 1.1): showCustomAlert() artık persistent modal desteği yapıyor

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
    // ✅ Auth token inject: giriş yapılmışsa tüm Supabase çağrılarına
    // otomatik olarak güncel JWT token'ı yaz.
    const isSupabaseApi = url.includes('supabase.co');
    if (isSupabaseApi && window.__tangoAuthToken) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${window.__tangoAuthToken}`;
    }

    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        } catch (err) {
            lastError = err;
            const delay = baseDelay * Math.pow(2, i);
            console.warn(`Fetch hatası (deneme ${i + 1}/${retries}):`, err.message, `Retrying in ${delay}ms...`, err);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

// ================= YENİ (Adım 1.1): PERSISTENT MODAL DESTEĞI =================
/**
 * showCustomAlert(message, okText, persistent)
 * 
 * @param {string} message - Gösterilecek mesaj
 * @param {string} okText - Tamam butonunun metni (default: 'Tamam' veya 'OK')
 * @param {boolean} persistent - Kalıcı modal mı? (default: false)
 *                              false → 3 saniyede kayıp olan toast
 *                              true → "Tamam" butonuyla kapanan modal
 * 
 * Örnekler:
 *   showCustomAlert('Video eklendi!', 'Tamam', false);  // Toast
 *   showCustomAlert('5 video başarıyla içe aktarıldı!', 'Tamam', true);  // Modal
 */
export function showCustomAlert(message, okText = '', persistent = false) {
    // Dil ayarı — okText boş bırakıldıysa varsayılanı kullan
    if (!okText) {
        okText = currentLangForUtils === 'tr' ? 'Tamam' : 'OK';
    }

    // DURUM 1: Toast (geçici, 3 saniye sonra kaybolur)
    if (!persistent) {
        // showToast fonksiyonunu kullan (tangoModals.js'de tanımlı)
        if (window.showToast) {
            window.showToast(message, 'info', 3000);
        } else {
            // Toast fonksiyonu yoksa konsola yaz (debug)
            console.log('[Alert]', message);
        }
        return Promise.resolve();
    }

    // DURUM 2: Persistent Modal (kalıcı, "Tamam" ile kapatılır)
    return new Promise((resolve) => {
        const modal = document.getElementById('custom-dialog-modal');
        const msgEl = document.getElementById('custom-dialog-message');
        const okBtn = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

        // Modal elemanları yoksa hata mesajı ver
        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            console.error("Modal öğeleri bulunamadı!");
            resolve();
            return;
        }

        // Modal içeriğini ayarla
        msgEl.innerText = message;
        okBtn.innerText = okText;

        // Persistent modallarda "İptal" butonunu gizle
        // (sadece "Tamam" butonu olsun)
        cancelBtn.classList.add('d-none');

        // Modali görünür yap
        modal.classList.remove('d-none');

        // "Tamam" butonuna odaklanmayı ayarla (UX için)
        setTimeout(() => okBtn.focus(), 50);

        // Buton tıklaması
        const handleOk = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve();
        };

        // Temizlik: event listener'ları kaldır
        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            document.removeEventListener('keydown', handleKeydown);
        };

        // Keyboard destek: Enter tuşu ile kapatma
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                handleOk();
            }
        };

        okBtn.addEventListener('click', handleOk);
        document.addEventListener('keydown', handleKeydown);
    });
}

// ================= ABONELIKLERI TEMIZLEME =================
let subscriptions = [];

export function addSubscription(unsubscribeFn) {
    subscriptions.push(unsubscribeFn);
}

export function cleanupSubscriptions() {
    subscriptions.forEach(u => u());
    subscriptions = [];
}