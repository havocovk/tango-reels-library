// auth.js - Kimlik doğrulama yönetimi
// ✅ YENİ: Supabase Auth ile e-posta + şifre girişi.
// Giriş sonrası token window.__tangoAuthToken'a yazılır.
// fetchWithRetry bu token'ı okuyarak tüm API çağrılarını otomatik yetkilendirir.

import { supabase } from './supabaseClient.js';

// Giriş başarılı olunca çağrılacak callback (app.js'ten verilir)
let _onAuthReady = null;

// ─────────────────────────────────────────────────────────
// initAuth — app.js'in DOMContentLoaded içinde çağrılır
// onReady: giriş başarılı → uygulamayı yükle (loadTemplates)
// ─────────────────────────────────────────────────────────
export function initAuth(onReady) {
    _onAuthReady = onReady;

    // Sayfa yenilendiğinde localStorage'daki oturum varsa hemen kullan
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.__tangoAuthToken = session.access_token;
            _hideLogin();
            _onAuthReady?.();
        } else {
            _showLogin();
        }
    });

    // Token otomatik yenilenince (her saat) güncel token'ı al
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
    // onAuthStateChange SIGNED_OUT eventi showLogin'i otomatik tetikler
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

    if (!email || !password) {
        if (errorEl) errorEl.textContent = 'E-posta ve şifre gereklidir.';
        return;
    }

    // Butonu devre dışı bırak, yükleniyor mesajı göster
    if (btnEl)   { btnEl.disabled = true; btnEl.textContent = 'Giriş yapılıyor...'; }
    if (errorEl) { errorEl.textContent = ''; }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Butonu geri aç
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Giriş Yap'; }

    if (error) {
        const msg = error.message.includes('Invalid login credentials')
            ? 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.'
            : 'Giriş hatası: ' + error.message;
        if (errorEl) errorEl.textContent = msg;
        return;
    }

    // Başarılı giriş
    window.__tangoAuthToken = data.session.access_token;
    _hideLogin();
    _onAuthReady?.();
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