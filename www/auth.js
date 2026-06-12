// auth.js - Kimlik doğrulama yönetimi
// ✅ GÜNCELLEME (Adım 1.3): Auth ekranı iki dil desteği eklendi

import { supabase } from './supabaseClient.js';

let _onAuthReady = null;

// ─────────────────────────────────────────────────────────
// initAuth — app.js'in DOMContentLoaded içinde çağrılır
// ─────────────────────────────────────────────────────────
export function initAuth(onReady) {
    _onAuthReady = onReady;

    // ✅ ADIM 1.3: Dil belirle ve auth ekranına uygula
    const lang = localStorage.getItem('tango_lang') ||
        (navigator.language.startsWith('en') ? 'en' : 'tr');
    _applyAuthLang(lang);

    // Sayfa yenilendiğinde mevcut oturum varsa hemen kullan
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.__tangoAuthToken = session.access_token;
            _hideLogin();
            _onAuthReady?.();
        } else {
            _showLogin();
        }
    });

    // Token otomatik yenilenince güncel token'ı al
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            window.__tangoAuthToken = session.access_token;
        } else {
            window.__tangoAuthToken = null;
        }
        if (event === 'SIGNED_OUT') {
            _showLogin();
        }
    });

    // Login formu butonlarını bağla
    document.getElementById('login-btn')
        ?.addEventListener('click', _handleLogin);
    document.getElementById('login-password')
        ?.addEventListener('keypress', (e) => { if (e.key === 'Enter') _handleLogin(); });

    // Adim 2.2: Sifremi unuttum
    document.getElementById('forgot-password-link')
        ?.addEventListener('click', (e) => {
            e.preventDefault();
            const resetForm = document.getElementById('reset-form');
            if (resetForm) resetForm.style.display = 'block';
            document.getElementById('reset-email')?.focus();
        });

    document.getElementById('reset-btn')
        ?.addEventListener('click', _handlePasswordReset);
}

// ─────────────────────────────────────────────────────────
// signOut — sidebar'daki çıkış butonundan çağrılır
// ─────────────────────────────────────────────────────────
export async function signOut() {
    await supabase.auth.signOut();
    window.__tangoAuthToken = null;
}

// ─────────────────────────────────────────────────────────
// _handlePasswordReset — şifre sıfırlama e-postası gönderir (Adim 2.2)
// ─────────────────────────────────────────────────────────
async function _handlePasswordReset() {
    const emailEl   = document.getElementById('reset-email');
    const msgEl     = document.getElementById('reset-message');
    const btnEl     = document.getElementById('reset-btn');
    const lang      = localStorage.getItem('tango_lang') ||
        (navigator.language.startsWith('en') ? 'en' : 'tr');

    const email = emailEl?.value?.trim();
    if (!email) {
        if (msgEl) {
            msgEl.style.color = '#ff6b6b';
            msgEl.textContent = lang === 'en'
                ? 'Please enter your email address.'
                : 'Lütfen e-posta adresinizi girin.';
        }
        return;
    }

    if (btnEl) { btnEl.disabled = true; }
    if (msgEl) { msgEl.textContent = ''; }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/'
    });

    if (btnEl) { btnEl.disabled = false; }

    if (error) {
        if (msgEl) {
            msgEl.style.color = '#ff6b6b';
            msgEl.textContent = (lang === 'en' ? 'Failed: ' : 'Gönderilemedi: ') + error.message;
        }
    } else {
        if (msgEl) {
            msgEl.style.color = '#4ade80';
            msgEl.textContent = lang === 'en'
                ? '✅ Link sent! Please check your email.'
                : '✅ Bağlantı gönderildi! E-postanızı kontrol edin.';
        }
        if (btnEl) { btnEl.disabled = true; } // Tekrar gönderimi engelle
    }
}

// ─────────────────────────────────────────────────────────
// _handleLogin — giriş butonuna basılınca çalışır
// ─────────────────────────────────────────────────────────
async function _handleLogin() {
    const emailEl    = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-password');
    const errorEl    = document.getElementById('login-error');
    const btnEl      = document.getElementById('login-btn');

    const email    = emailEl?.value?.trim();
    const password = passwordEl?.value;

    // Dili al (buton metnini güncel tutmak için)
    const lang = localStorage.getItem('tango_lang') ||
        (navigator.language.startsWith('en') ? 'en' : 'tr');

    if (!email || !password) {
        if (errorEl) {
            errorEl.textContent = lang === 'en'
                ? 'Email and password are required.'
                : 'E-posta ve şifre gereklidir.';
        }
        return;
    }

    // Butonu devre dışı bırak
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.textContent = lang === 'en' ? 'Signing in...' : 'Giriş yapılıyor...';
    }
    if (errorEl) errorEl.textContent = '';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Butonu geri aç
    if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = lang === 'en' ? 'Sign In' : 'Giriş Yap';
    }

    if (error) {
        const isWrongCredentials = error.message.includes('Invalid login credentials');
        if (errorEl) {
            errorEl.textContent = isWrongCredentials
                ? (lang === 'en'
                    ? 'Incorrect email or password. Please try again.'
                    : 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.')
                : (lang === 'en'
                    ? 'Login error: ' + error.message
                    : 'Giriş hatası: ' + error.message);
        }
        return;
    }

    // Başarılı giriş
    window.__tangoAuthToken = data.session.access_token;
    _hideLogin();
    _onAuthReady?.();
}

// ─────────────────────────────────────────────────────────
// ✅ YENİ (Adım 1.3): _applyAuthLang — login ekranı metinlerini dile göre güncelle
// ─────────────────────────────────────────────────────────
function _applyAuthLang(lang) {
    const texts = {
        tr: {
            title:       'Hoş Geldiniz',
            subtitle:    'Koleksiyonunuza erişmek için giriş yapın',
            emailLabel:  'E-posta',
            emailPh:     'ornek@email.com',
            passLabel:   'Şifre',
            passPh:      '••••••••',
            btnText:     'Giriş Yap',
            forgotLink:  'Şifremi unuttum',
            resetInfo:   'E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.',
            resetBtn:    'Sıfırlama Bağlantısı Gönder',
            resetOk:     '✅ Bağlantı gönderildi! E-postanızı kontrol edin.',
            resetErr:    'Gönderilemedi: '
        },
        en: {
            title:       'Welcome Back',
            subtitle:    'Sign in to access your collection',
            emailLabel:  'Email',
            emailPh:     'example@email.com',
            passLabel:   'Password',
            passPh:      '••••••••',
            btnText:     'Sign In',
            forgotLink:  'Forgot password',
            resetInfo:   'Enter your email and we will send a password reset link.',
            resetBtn:    'Send Reset Link',
            resetOk:     '✅ Link sent! Please check your email.',
            resetErr:    'Failed: '
        }
    };

    const t = texts[lang] || texts.tr;

    // data-auth-i18n özelliğine göre elementleri güncelle
    const set = (attr, value) => {
        const el = document.querySelector(`[data-auth-i18n="${attr}"]`);
        if (!el) return;
        if (el.tagName === 'INPUT') {
            el.placeholder = value;
        } else {
            el.textContent = value;
        }
    };

    set('title',      t.title);
    set('subtitle',   t.subtitle);
    set('email-label', t.emailLabel);
    set('email-input', t.emailPh);
    set('pass-label',  t.passLabel);
    set('pass-input',  t.passPh);
    set('login-btn',   t.btnText);
    set('forgot-link', t.forgotLink);
    set('reset-info',  t.resetInfo);
    set('reset-btn',   t.resetBtn);

    // Buton element ID'si farklı olabilir — doğrudan da set et
    const btn = document.getElementById('login-btn');
    if (btn) btn.textContent = t.btnText;
}

// ─────────────────────────────────────────────────────────
// Yardımcı: ekranı göster / gizle
// ─────────────────────────────────────────────────────────
function _showLogin() {
    document.getElementById('login-overlay')?.classList.remove('d-none');
}

function _hideLogin() {
    document.getElementById('login-overlay')?.classList.add('d-none');
}