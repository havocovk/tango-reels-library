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
}

// ─────────────────────────────────────────────────────────
// signOut — sidebar'daki çıkış butonundan çağrılır
// ─────────────────────────────────────────────────────────
export async function signOut() {
    await supabase.auth.signOut();
    window.__tangoAuthToken = null;
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
            btnText:     'Giriş Yap'
        },
        en: {
            title:       'Welcome Back',
            subtitle:    'Sign in to access your collection',
            emailLabel:  'Email',
            emailPh:     'example@email.com',
            passLabel:   'Password',
            passPh:      '••••••••',
            btnText:     'Sign In'
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