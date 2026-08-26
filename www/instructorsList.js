// instructorsList.js - Eğitmenler listesi sayfası
// instructorProfile.js'den bölündü.

import { store } from './store.js';
import { escapeHtml } from './utils.js';

// ── Modül düzeyi durum ────────────────────────────────────────
let callSwitchViewFn = null;

export function initInstructorsList(callSwitchViewCallback) {
    callSwitchViewFn = callSwitchViewCallback;
}

// ─────────────────────────────────────────────────────────────
// buildInitialsAvatar — ortak yardımcı
// ─────────────────────────────────────────────────────────────
function buildInitialsAvatar(name) {
    const parts = (name || '?').trim().split(/\s+/);
    const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0][0] || '?').toUpperCase();
    return initials;
}

// ─────────────────────────────────────────────────────────────
// renderInstructorsList
// ─────────────────────────────────────────────────────────────
export function renderInstructorsList() {
    const container = document.getElementById('instructor-profile-content');
    if (!container) return;

    const lang        = store.get('currentLang');
    const instructors = store.get('globalInstructors') || [];
    const allVideos   = store.get('globalVideos')      || [];

    const title      = lang === 'tr' ? 'Eğitmenler' : 'Instructors';
    const noIns      = lang === 'tr' ? 'Henüz eğitmen eklenmemiş.' : 'No instructors added yet.';
    const videoLabel = lang === 'tr' ? 'video' : 'video';
    const viewLabel  = lang === 'tr' ? 'Profili Görüntüle' : 'View Profile';

    const cardsHtml = instructors.length === 0
        ? `<div style="text-align:center;color:#475569;padding:48px;font-size:0.9rem;">${noIns}</div>`
        : instructors.map(ins => {
            const videoCount = allVideos.filter(v => v.instructor_id === ins.id).length;
            const avatarHtml = ins.photo_url
                ? `<img src="${escapeHtml(ins.photo_url)}"
                        alt="${escapeHtml(ins.name)}"
                        style="width:80px;height:80px;border-radius:50%;object-fit:cover;
                               border:2px solid rgba(255,0,127,0.5);
                               box-shadow:0 0 16px rgba(255,0,127,0.25);"
                        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                   <div class="ins-list-avatar-fallback" style="display:none;">${escapeHtml(buildInitialsAvatar(ins.name))}</div>`
                : `<div class="ins-list-avatar-fallback">${escapeHtml(buildInitialsAvatar(ins.name))}</div>`;

            const igIcon = ins.instagram_url
                ? `<a href="${escapeHtml(ins.instagram_url)}" target="_blank" rel="noopener"
                      style="color:#e1306c;opacity:0.85;transition:opacity 0.15s;"
                      onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"
                      title="Instagram">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                   </a>` : '';
            const fbIcon = ins.facebook_url
                ? `<a href="${escapeHtml(ins.facebook_url)}" target="_blank" rel="noopener"
                      style="color:#1877f2;opacity:0.85;transition:opacity 0.15s;"
                      onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"
                      title="Facebook">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                   </a>` : '';
            const ytIcon = ins.youtube_url
                ? `<a href="${escapeHtml(ins.youtube_url)}" target="_blank" rel="noopener"
                      style="color:#ff0000;opacity:0.85;transition:opacity 0.15s;"
                      onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"
                      title="YouTube">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                   </a>` : '';

            return `
                <div class="ins-list-card" data-ins-id="${ins.id}">
                    <div class="ins-list-avatar-wrap">${avatarHtml}</div>
                    <div class="ins-list-name">${escapeHtml(ins.name)}</div>
                    <div class="ins-list-count">${videoCount} ${videoLabel}</div>
                    ${(igIcon || fbIcon || ytIcon) ? `<div class="ins-list-socials">${igIcon}${fbIcon}${ytIcon}</div>` : ''}
                    <button class="ins-list-view-btn" data-ins-id="${ins.id}">${viewLabel}</button>
                </div>`;
        }).join('');

    container.innerHTML = `
        <style>
            .ins-list-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:20px; padding:8px 0 48px; }
            .ins-list-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:24px 16px 20px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; transition:border-color 0.2s,box-shadow 0.2s,transform 0.15s; }
            .ins-list-card:hover { border-color:rgba(255,0,127,0.4); box-shadow:0 0 24px rgba(255,0,127,0.12); transform:translateY(-2px); }
            .ins-list-avatar-wrap { flex-shrink:0; }
            .ins-list-avatar-fallback { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#ff007f,#00f0ff); display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:700; color:#0b0813; border:2px solid rgba(255,0,127,0.5); box-shadow:0 0 16px rgba(255,0,127,0.25); }
            .ins-list-name { font-size:0.9rem; font-weight:700; color:#e2e8f0; text-align:center; line-height:1.3; word-break:break-word; }
            .ins-list-count { font-size:0.72rem; color:#64748b; }
            .ins-list-socials { display:flex; gap:10px; align-items:center; }
            .ins-list-view-btn { margin-top:4px; padding:6px 16px; background:rgba(255,0,127,0.1); border:1px solid rgba(255,0,127,0.35); border-radius:999px; color:#ff6fae; font-size:0.75rem; font-weight:600; cursor:pointer; font-family: var(--font-body); transition:background 0.15s; width:100%; }
            .ins-list-view-btn:hover { background:rgba(255,0,127,0.22); }
        </style>
        <h2 style="font-size:1.3rem;font-weight:700;margin:0 0 24px;background:linear-gradient(135deg,#ff007f,#00f0ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${title}</h2>
        <div class="ins-list-grid">${cardsHtml}</div>
    `;

    container.querySelectorAll('.ins-list-card, .ins-list-view-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const insId = parseInt(el.dataset.insId, 10);
            if (insId && callSwitchViewFn) {
                callSwitchViewFn('instructorProfile', { instructorId: insId });
            }
        });
    });
}