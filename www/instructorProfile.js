// instructorProfile.js - Eğitmen Profil Sayfası + Eğitmenler Listesi
// ✅ GÜNCELLEME: instagram_url, facebook_url alanları eklendi
// ✅ GÜNCELLEME: renderInstructorsList() — sol menüdeki "Eğitmenler" sayfası

import { dbUpdateInstructorProfile } from './tangoVeritabani.js';
import { uploadInstructorPhoto } from './storage.js'; // Ek ozellik
import { store } from './store.js';
import { showToast } from './toast.js';
import { openVideoModal } from './tangoModals.js';
import { icon } from './icons.js';
import { escapeHtml, convertYoutubeUrlToEmbed } from './utils.js';

// ── Modül düzeyi durum ────────────────────────────────────────
let callSwitchViewFn = null;   // app.js'ten enjekte edilir (callSwitchView)

export function initInstructorProfile(callSwitchViewCallback) {
    callSwitchViewFn = callSwitchViewCallback;
}

export function openInstructorProfile(instructorId) {
    if (!instructorId) return;
    if (callSwitchViewFn) {
        callSwitchViewFn('instructorProfile', { instructorId });
    }
}

// escapeHtml, convertYoutubeUrlToEmbed -> utils.js

function computeTagFrequency(videos, topN = 10) {
    const map = new Map();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
                map.set(tag, (map.get(tag) || 0) + 1);
            });
        }
    });
    return Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([tag, count]) => ({ tag, count }));
}

function buildInitialsAvatar(name) {
    const parts = (name || '?').trim().split(/\s+/);
    const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0][0] || '?').toUpperCase();
    return initials;
}

// ─────────────────────────────────────────────────────────────
// renderInstructorsList — Sol menüden "Eğitmenler" tıklanınca açılan
// Facebook arkadaşlar stili eğitmen kartları sayfası.
// ─────────────────────────────────────────────────────────────
export function renderInstructorsList() {
    const container = document.getElementById('instructor-profile-content');
    if (!container) return;

    const lang        = store.get('currentLang');
    const instructors = store.get('globalInstructors') || [];
    const allVideos   = store.get('globalVideos')    || [];

    const title       = lang === 'tr' ? 'Eğitmenler' : 'Instructors';
    const noIns       = lang === 'tr' ? 'Henüz eğitmen eklenmemiş.' : 'No instructors added yet.';
    const videoLabel  = lang === 'tr' ? 'video' : 'video';
    const viewLabel   = lang === 'tr' ? 'Profili Görüntüle' : 'View Profile';

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

            // Sosyal medya ikonları
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
            .ins-list-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 20px;
                padding: 8px 0 48px;
            }
            .ins-list-card {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 18px;
                padding: 24px 16px 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
            }
            .ins-list-card:hover {
                border-color: rgba(255,0,127,0.4);
                box-shadow: 0 0 24px rgba(255,0,127,0.12);
                transform: translateY(-2px);
            }
            .ins-list-avatar-wrap { flex-shrink: 0; }
            .ins-list-avatar-fallback {
                width: 80px; height: 80px; border-radius: 50%;
                background: linear-gradient(135deg, #ff007f, #00f0ff);
                display: flex; align-items: center; justify-content: center;
                font-size: 1.6rem; font-weight: 700; color: #0b0813;
                border: 2px solid rgba(255,0,127,0.5);
                box-shadow: 0 0 16px rgba(255,0,127,0.25);
            }
            .ins-list-name {
                font-size: 0.9rem; font-weight: 700; color: #e2e8f0;
                text-align: center; line-height: 1.3; word-break: break-word;
            }
            .ins-list-count {
                font-size: 0.72rem; color: #64748b;
            }
            .ins-list-socials {
                display: flex; gap: 10px; align-items: center;
            }
            .ins-list-view-btn {
                margin-top: 4px;
                padding: 6px 16px;
                background: rgba(255,0,127,0.1);
                border: 1px solid rgba(255,0,127,0.35);
                border-radius: 999px;
                color: #ff6fae;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Poppins', sans-serif;
                transition: background 0.15s;
                width: 100%;
            }
            .ins-list-view-btn:hover {
                background: rgba(255,0,127,0.22);
            }
        </style>

        <h2 style="
            font-size: 1.3rem; font-weight: 700; margin: 0 0 24px;
            background: linear-gradient(135deg, #ff007f, #00f0ff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        ">${title}</h2>

        <div class="ins-list-grid">${cardsHtml}</div>
    `;

    // Kart tıklamaları — tüm kart alanına ve butona
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

// ─────────────────────────────────────────────────────────────
// renderInstructorProfile — profilin tüm HTML'ini üretip ekrana yazar.
// ─────────────────────────────────────────────────────────────
export function renderInstructorProfile(instructorId) {
    const container = document.getElementById('instructor-profile-content');
    if (!container) return;

    const lang = store.get('currentLang');
    const instructors = store.get('globalInstructors') || [];
    const allVideos   = store.get('globalVideos')    || [];

    const instructor = instructors.find(i => i.id === instructorId);
    if (!instructor) {
        container.innerHTML = `<div style="color:#ef4444;padding:32px;text-align:center;">
            ${lang === 'tr' ? 'Eğitmen bulunamadı.' : 'Instructor not found.'}
        </div>`;
        return;
    }

    const videos = allVideos.filter(v => v.instructor_id === instructorId);
    const leaderCount   = videos.filter(v => v.role_type === 'Leader').length;
    const followerCount = videos.filter(v => v.role_type === 'Follower').length;
    const bothCount     = videos.filter(v => v.role_type === 'Both' || !v.role_type).length;

    const platformCounts = { drive: 0, youtube: 0, instagram: 0, facebook: 0, other: 0 };
    videos.forEach(v => {
        const p = v.platform || 'other';
        if (platformCounts[p] !== undefined) platformCounts[p]++;
        else platformCounts.other++;
    });

    const topTags      = computeTagFrequency(videos, 12);
    const masteredCount = videos.filter(v => v.learning_status === 'mastered').length; // Adim 4.5

    // ── Metinler ──────────────────────────────────────────────
    const T = {
        backBtn:              lang === 'tr' ? '← Eğitmenlere Dön' : '← Back to Instructors',
        editBtn:              lang === 'tr' ? `${icon('pencil', { size: 14, color: '#c026d3' })} Düzenle` : `${icon('pencil', { size: 14, color: '#c026d3' })} Edit`,
        saveBtn:              lang === 'tr' ? `${icon('save', { size: 14, color: '#4ade80' })} Kaydet` : `${icon('save', { size: 14, color: '#4ade80' })} Save`,
        cancelBtn:            lang === 'tr' ? 'İptal' : 'Cancel',
        photoUrlLabel:        lang === 'tr' ? 'Fotoğraf URL veya Yükle:' : 'Photo URL or Upload:',
        photoUploadBtn:       lang === 'tr' ? '📁 Dosya Seç' : '📁 Choose File',
        photoUploading:       lang === 'tr' ? 'Yükleniyor...' : 'Uploading...',
        instagramLabel:       lang === 'tr' ? 'Instagram Profil URL:' : 'Instagram Profile URL:',
        facebookLabel:        lang === 'tr' ? 'Facebook Profil URL:' : 'Facebook Profile URL:',
        youtubeLabel:         lang === 'tr' ? 'YouTube Kanal URL:' : 'YouTube Channel URL:',
        bioLabel:             lang === 'tr' ? 'Biyografi:' : 'Biography:',
        bioPlaceholder:       lang === 'tr' ? 'Eğitmen hakkında kısa bir not...' : 'A short note about the instructor...',
        photoPlaceholder:     lang === 'tr' ? 'https://... fotoğraf linki' : 'https://... photo link',
        igPlaceholder:        'https://www.instagram.com/kullaniciadi',
        fbPlaceholder:        'https://www.facebook.com/kullaniciadi',
        ytPlaceholder:        'https://www.youtube.com/@kullaniciadi',
        totalVideos:          lang === 'tr' ? 'Toplam Video' : 'Total Videos',
        roleTitle:            lang === 'tr' ? 'Rol Dağılımı' : 'Role Distribution',
        leader:               lang === 'tr' ? 'Lider' : 'Leader',
        follower:             lang === 'tr' ? 'Takipçi' : 'Follower',
        both:                 lang === 'tr' ? 'Çift' : 'Both',
        topTagsTitle:         lang === 'tr' ? 'Sık Kullanılan Etiketler' : 'Top Tags',
        videosTitle:          lang === 'tr' ? `${icon('video', { size: 18, color: '#ff007f' })} Videolar` : `${icon('video', { size: 18, color: '#ff007f' })} Videos`,
        noVideos:             lang === 'tr' ? 'Bu eğitmene ait henüz video yok.' : 'No videos for this instructor yet.',
        noBio:                lang === 'tr' ? 'Biyografi eklenmemiş.' : 'No biography added.',
        platformLabels:       { drive: 'Google Drive', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', other: lang === 'tr' ? 'Diğer' : 'Other' },
        watchBtn:             lang === 'tr' ? 'İzle' : 'Watch',
    };

    // ── Fotoğraf / Avatar ─────────────────────────────────────
    const photoHtml = instructor.photo_url
        ? `<img src="${escapeHtml(instructor.photo_url)}" alt="${escapeHtml(instructor.name)}" style="
                width:100px;height:100px;border-radius:50%;object-fit:cover;
                border:3px solid rgba(255,0,127,0.5);
                box-shadow:0 0 20px rgba(255,0,127,0.3);
            " onerror="this.style.display='none';this.nextSibling.style.display='flex';">
           <div class="prof-avatar-fallback" style="display:none;">${escapeHtml(buildInitialsAvatar(instructor.name))}</div>`
        : `<div class="prof-avatar-fallback">${escapeHtml(buildInitialsAvatar(instructor.name))}</div>`;

    // ── İstatistik kutuları ───────────────────────────────────
    const statBox = (value, label, color) => `
        <div class="prof-stat-box">
            <div class="prof-stat-value" style="color:${color};">${value}</div>
            <div class="prof-stat-label">${label}</div>
        </div>`;

    const activePlatforms = Object.entries(platformCounts)
        .filter(([, c]) => c > 0)
        .map(([p, c]) => `<span class="prof-platform-chip">${T.platformLabels[p]}: <b>${c}</b></span>`)
        .join('');

    // ── Etiket bulutu ─────────────────────────────────────────
    const tagsHtml = topTags.length > 0
        ? topTags.map(({ tag, count }) =>
            `<span class="prof-tag-chip" title="${count} video">#${escapeHtml(tag)}<sup>${count}</sup></span>`
          ).join('')
        : `<span style="color:#475569;font-size:0.8rem;font-style:italic;">${lang === 'tr' ? 'Etiket yok' : 'No tags'}</span>`;

    // ── Video listesi ─────────────────────────────────────────
    const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=200';
    const noTagsHtml = `<span style="color:#475569;font-size:0.7rem;">${lang === 'tr' ? 'etiket yok' : 'no tags'}</span>`;
    const videosHtml = videos.length === 0
        ? `<div class="prof-empty">${T.noVideos}</div>`
        : videos.map(v => {
            const cover  = v.cover_url || defaultCover;
            const tags   = v.tags ? v.tags.split(',').slice(0,3).map(t => `<span class="prof-vl-tag">#${escapeHtml(t.trim())}</span>`).join('') : '';
            let roleLbl = T.both; let roleColor = '#64748b';
            if (v.role_type === 'Leader')   { roleLbl = T.leader;   roleColor = '#00f0ff'; }
            if (v.role_type === 'Follower') { roleLbl = T.follower; roleColor = '#ff007f'; }
            const platform = v.platform || 'other';
            const isEmbeddable = (platform === 'drive' || platform === 'youtube');
            return `<div class="prof-video-row"
                         data-vid-id="${v.id}"
                         data-vid-platform="${platform}"
                         data-vid-url="${escapeHtml(v.url || '')}"
                         data-vid-drive="${escapeHtml(v.drive_url || '')}">
                <div class="prof-video-thumb" style="background-image:url('${cover}');"></div>
                <div class="prof-video-info">
                    <div class="prof-video-role" style="color:${roleColor};">${roleLbl}</div>
                    <div class="prof-video-tags">${tags || noTagsHtml}</div>
                </div>
                ${isEmbeddable ? `<button class="prof-watch-btn" data-watch="${v.id}" title="${T.watchBtn}">▶</button>` : (v.url ? `<a href="${escapeHtml(v.url)}" target="_blank" class="prof-watch-btn" title="${T.watchBtn}">↗</a>` : '')}
            </div>`;
        }).join('');

    // ── Sosyal medya ikonları (profil başlığında görünür) ──────
    const igLink = instructor.instagram_url
        ? `<a href="${escapeHtml(instructor.instagram_url)}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;color:#e1306c;
                     opacity:0.85;transition:opacity 0.15s;text-decoration:none;"
              onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"
              title="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
           </a>` : '';
    const fbLink = instructor.facebook_url
        ? `<a href="${escapeHtml(instructor.facebook_url)}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;color:#1877f2;
                     opacity:0.85;transition:opacity 0.15s;text-decoration:none;"
              onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"
              title="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
           </a>` : '';
    const ytLink = instructor.youtube_url
        ? `<a href="${escapeHtml(instructor.youtube_url)}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;color:#ff0000;
                     opacity:0.85;transition:opacity 0.15s;text-decoration:none;"
              onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'"
              title="YouTube">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
           </a>` : '';
    const socialLinksHtml = (igLink || fbLink || ytLink)
        ? `<div style="display:flex;align-items:center;gap:10px;margin-top:8px;">${igLink}${fbLink}${ytLink}</div>`
        : '';

    // ── Ana HTML ─────────────────────────────────────────────
    container.innerHTML = `
        <style>
            /* ─────── Eğitmen Profil Stilleri ─────── */
            .prof-avatar-fallback {
                width:100px;height:100px;border-radius:50%;
                background:linear-gradient(135deg,#ff007f,#00f0ff);
                display:flex;align-items:center;justify-content:center;
                font-size:2rem;font-weight:700;color:#0b0813;
                border:3px solid rgba(255,0,127,0.5);
                box-shadow:0 0 20px rgba(255,0,127,0.3);
                flex-shrink:0;
            }
            .prof-stat-box {
                background:rgba(255,255,255,0.04);
                border:1px solid rgba(255,255,255,0.09);
                border-radius:14px;padding:14px 18px;text-align:center;
                min-width:80px;flex:1;
            }
            .prof-stat-value { font-size:1.6rem;font-weight:700;line-height:1.1; }
            .prof-stat-label { font-size:0.7rem;color:#64748b;margin-top:4px; }
            .prof-platform-chip {
                display:inline-block;padding:3px 9px;
                background:rgba(0,240,255,0.08);border:1px solid rgba(0,240,255,0.2);
                border-radius:999px;font-size:0.72rem;color:#94a3b8;margin:3px 2px;
            }
            .prof-tag-chip {
                display:inline-block;padding:4px 10px;
                background:rgba(255,0,127,0.08);border:1px solid rgba(255,0,127,0.2);
                border-radius:999px;font-size:0.76rem;color:#f1a1c0;margin:3px 2px;
                cursor:default;
            }
            .prof-tag-chip sup { font-size:0.6rem;opacity:0.6; }
            .prof-video-row {
                display:flex;align-items:center;gap:12px;
                background:rgba(255,255,255,0.03);
                border:1px solid rgba(255,255,255,0.07);
                border-radius:12px;padding:9px 12px;
                margin-bottom:8px;
                transition:border-color 0.2s;cursor:default;
            }
            .prof-video-row:hover { border-color:rgba(255,0,127,0.25); }
            .prof-video-thumb {
                flex-shrink:0;width:48px;height:48px;
                border-radius:10px;background-size:cover;background-position:center;
                background-color:#1e293b;
            }
            .prof-video-info { flex:1;min-width:0; }
            .prof-video-role { font-size:0.72rem;font-weight:700;letter-spacing:0.3px; }
            .prof-video-tags { margin-top:3px;display:flex;flex-wrap:wrap;gap:3px; }
            .prof-vl-tag {
                font-size:0.68rem;color:#94a3b8;
                background:rgba(255,255,255,0.05);
                border:1px solid rgba(255,255,255,0.08);
                border-radius:6px;padding:1px 5px;
            }
            .prof-watch-btn {
                flex-shrink:0;padding:6px 12px;
                background:rgba(0,240,255,0.1);border:1px solid rgba(0,240,255,0.3);
                border-radius:8px;color:#00f0ff;font-size:0.85rem;cursor:pointer;
                text-decoration:none;display:inline-flex;align-items:center;justify-content:center;
                transition:background 0.15s;font-family:'Poppins',sans-serif;
            }
            .prof-watch-btn:hover { background:rgba(0,240,255,0.22); }
            .prof-empty { text-align:center;padding:32px;color:#475569;font-size:0.88rem; }
            .prof-section-title {
                font-size:0.82rem;font-weight:700;color:#64748b;
                text-transform:uppercase;letter-spacing:0.8px;
                margin-bottom:12px;
            }
            .prof-edit-field {
                width:100%;padding:9px 12px;
                background:rgba(11,8,19,0.9);
                border:1px solid rgba(255,0,127,0.35);
                border-radius:9px;color:#f1f5f9;font-size:0.88rem;
                outline:none;font-family:'Poppins',sans-serif;
                box-sizing:border-box;
            }
            .prof-edit-field:focus { border-color:rgba(0,240,255,0.6); }
            .prof-edit-btn {
                padding:6px 14px;border-radius:8px;font-size:0.82rem;
                font-weight:600;cursor:pointer;font-family:'Poppins',sans-serif;
                display:inline-flex;align-items:center;gap:6px;
                transition:opacity 0.15s;
            }
        </style>

        <!-- Geri butonu -->
        <button id="prof-back-btn" class="prof-edit-btn" style="
            background:transparent;border:1px solid rgba(255,255,255,0.12);
            color:#94a3b8;margin-bottom:24px;
        ">${T.backBtn}</button>

        <!-- Profil başlığı -->
        <div style="
            display:flex;align-items:center;gap:22px;flex-wrap:wrap;
            background:rgba(255,255,255,0.03);border:1px solid rgba(255,0,127,0.2);
            border-radius:20px;padding:24px;margin-bottom:20px;
            box-shadow:0 0 30px rgba(255,0,127,0.08);
        ">
            <div id="prof-photo-area" style="flex-shrink:0;">
                ${photoHtml}
            </div>
            <div style="flex:1;min-width:180px;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <h2 style="
                        font-size:1.4rem;font-weight:700;margin:0 0 6px;
                        background:linear-gradient(135deg,#ff007f,#00f0ff);
                        -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                    ">${escapeHtml(instructor.name)}</h2>
                    ${masteredCount > 0 ? `<span title="${lang === 'tr' ? masteredCount + ' video ustalaşıldı' : masteredCount + ' videos mastered'}" style="
                        display:inline-flex;align-items:center;gap:4px;
                        background:rgba(245,158,11,0.15);
                        border:1px solid rgba(245,158,11,0.35);
                        border-radius:20px;padding:2px 10px;
                        font-size:0.75rem;color:#f59e0b;font-weight:600;margin-bottom:6px;">
                        ⭐ ${masteredCount}
                    </span>` : ''}
                </div>
                ${socialLinksHtml}
                <p id="prof-bio-display" style="
                    font-size:0.85rem;color:#94a3b8;margin:${socialLinksHtml ? '8px' : '0'} 0 0;line-height:1.6;
                    ${!instructor.bio ? 'font-style:italic;color:#475569;' : ''}
                ">${escapeHtml(instructor.bio) || T.noBio}</p>
            </div>
            <div style="flex-shrink:0;align-self:flex-start;">
                <button id="prof-edit-toggle-btn" class="prof-edit-btn" style="
                    background:rgba(255,0,127,0.12);border:1px solid rgba(255,0,127,0.4);
                    color:#ff6fae;
                ">${T.editBtn}</button>
            </div>
        </div>

        <!-- Satır içi düzenleme formu (başlangıçta gizli) -->
        <div id="prof-edit-form" style="
            display:none;
            background:rgba(0,240,255,0.04);border:1px solid rgba(0,240,255,0.2);
            border-radius:16px;padding:20px;margin-bottom:20px;
        ">
            <div style="margin-bottom:14px;">
                <label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:6px;">${T.photoUrlLabel}</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <input id="prof-photo-input" type="url" class="prof-edit-field" style="flex:1;"
                        placeholder="${T.photoPlaceholder}"
                        value="${escapeHtml(instructor.photo_url || '')}">
                    <button id="prof-photo-upload-btn" type="button" style="
                        padding:8px 12px; background:rgba(0,240,255,0.1);
                        border:1px solid rgba(0,240,255,0.35); border-radius:8px;
                        color:#00f0ff; font-size:0.75rem; font-weight:600;
                        font-family:'Plus Jakarta Sans',sans-serif;
                        cursor:pointer; white-space:nowrap; flex-shrink:0;
                        transition:background 0.2s;
                    ">${icon('upload', { size: 14, color: '#00f0ff' })} ${lang === 'tr' ? 'Fotoğraf Yükle' : 'Upload Photo'}</button>
                </div>
                <input id="prof-photo-file-input" type="file" accept="image/*" style="display:none;">
                <div id="prof-photo-upload-status" style="font-size:0.72rem;color:#94a3b8;margin-top:4px;"></div>
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-size:0.75rem;color:#e1306c;display:block;margin-bottom:6px;">
                    <svg style="vertical-align:middle;margin-right:4px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                    ${T.instagramLabel}
                </label>
                <input id="prof-instagram-input" type="url" class="prof-edit-field"
                    placeholder="${T.igPlaceholder}"
                    value="${escapeHtml(instructor.instagram_url || '')}">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-size:0.75rem;color:#1877f2;display:block;margin-bottom:6px;">
                    <svg style="vertical-align:middle;margin-right:4px;" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    ${T.facebookLabel}
                </label>
                <input id="prof-facebook-input" type="url" class="prof-edit-field"
                    placeholder="${T.fbPlaceholder}"
                    value="${escapeHtml(instructor.facebook_url || '')}">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-size:0.75rem;color:#ff0000;display:block;margin-bottom:6px;">
                    <svg style="vertical-align:middle;margin-right:4px;" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    ${T.youtubeLabel}
                </label>
                <input id="prof-youtube-input" type="url" class="prof-edit-field"
                    placeholder="${T.ytPlaceholder}"
                    value="${escapeHtml(instructor.youtube_url || '')}">
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:0.75rem;color:#94a3b8;display:block;margin-bottom:6px;">${T.bioLabel}</label>
                <textarea id="prof-bio-input" class="prof-edit-field"
                    rows="3"
                    placeholder="${T.bioPlaceholder}"
                    style="resize:vertical;">${escapeHtml(instructor.bio || '')}</textarea>
            </div>
            <div style="display:flex;gap:10px;">
                <button id="prof-save-btn" class="prof-edit-btn" style="
                    background:linear-gradient(135deg,#ff007f,#c026d3);
                    border:none;color:#fff;
                ">${T.saveBtn}</button>
                <button id="prof-cancel-btn" class="prof-edit-btn" style="
                    background:transparent;border:1px solid rgba(255,255,255,0.12);
                    color:#94a3b8;
                ">${T.cancelBtn}</button>
            </div>
            <p id="prof-edit-error" style="color:#ef4444;font-size:0.8rem;margin-top:8px;display:none;"></p>
        </div>

        <!-- İstatistikler -->
        <div style="
            display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;
        ">
            ${statBox(videos.length, T.totalVideos, '#00f0ff')}
            ${leaderCount > 0   ? statBox(leaderCount,   T.leader,   '#00f0ff') : ''}
            ${followerCount > 0 ? statBox(followerCount, T.follower, '#ff007f') : ''}
            ${bothCount > 0     ? statBox(bothCount,     T.both,     '#a78bfa') : ''}
        </div>

        <!-- Platform dağılımı -->
        ${activePlatforms ? `<div style="margin-bottom:20px;">
            <div class="prof-section-title">${lang === 'tr' ? 'Platform' : 'Platform'}</div>
            <div>${activePlatforms}</div>
        </div>` : ''}

        <!-- Etiket bulutu -->
        ${topTags.length > 0 ? `<div style="margin-bottom:24px;">
            <div class="prof-section-title">${T.topTagsTitle}</div>
            <div>${tagsHtml}</div>
        </div>` : ''}

        <!-- Video listesi -->
        <div>
            <div class="prof-section-title">${T.videosTitle}</div>
            <div id="prof-videos-list">${videosHtml}</div>
        </div>
    `;

    // ── Olay bağlayıcıları ────────────────────────────────────

    // Geri butonu → Eğitmenler listesine dön
    document.getElementById('prof-back-btn')?.addEventListener('click', () => {
        if (callSwitchViewFn) callSwitchViewFn('instructorsList');
    });

    // Düzenle / İptal toggle
    const editToggleBtn = document.getElementById('prof-edit-toggle-btn');
    const editForm      = document.getElementById('prof-edit-form');
    editToggleBtn?.addEventListener('click', () => {
        const isOpen = editForm.style.display !== 'none';
        editForm.style.display = isOpen ? 'none' : 'block';
        editToggleBtn.innerHTML = isOpen ? T.editBtn : T.cancelBtn;
    });

    document.getElementById('prof-cancel-btn')?.addEventListener('click', () => {
        editForm.style.display = 'none';
        editToggleBtn.innerHTML = T.editBtn;
    });

    // Kaydet
    // Eğitmen fotoğrafı yükleme butonu
    const photoUploadBtn   = document.getElementById('prof-photo-upload-btn');
    const photoFileInput   = document.getElementById('prof-photo-file-input');
    const photoStatusEl    = document.getElementById('prof-photo-upload-status');

    if (photoUploadBtn && photoFileInput) {
        photoUploadBtn.addEventListener('click', () => photoFileInput.click());

        photoFileInput.addEventListener('change', async () => {
            const file = photoFileInput.files?.[0];
            if (!file) return;

            const lang = store.get('currentLang');
            photoUploadBtn.disabled = true;
            photoUploadBtn.style.opacity = '0.5';
            if (photoStatusEl) photoStatusEl.textContent = lang === 'tr' ? 'Yükleniyor...' : 'Uploading...';

            try {
                const url = await uploadInstructorPhoto(file);
                const photoInput = document.getElementById('prof-photo-input');
                if (photoInput) photoInput.value = url;
                if (photoStatusEl) {
                    photoStatusEl.style.color = '#4ade80';
                    photoStatusEl.textContent = lang === 'tr' ? '✅ Fotoğraf yüklendi.' : '✅ Photo uploaded.';
                }
            } catch (err) {
                console.error('[InstructorPhoto]', err);
                if (photoStatusEl) {
                    photoStatusEl.style.color = '#ef4444';
                    photoStatusEl.textContent = lang === 'tr' ? '❌ Yükleme başarısız.' : '❌ Upload failed.';
                }
            } finally {
                photoUploadBtn.disabled = false;
                photoUploadBtn.style.opacity = '1';
                photoFileInput.value = '';
            }
        });
    }

    document.getElementById('prof-save-btn')?.addEventListener('click', async () => {
        const photoVal     = (document.getElementById('prof-photo-input')?.value     || '').trim();
        const igVal        = (document.getElementById('prof-instagram-input')?.value  || '').trim();
        const fbVal        = (document.getElementById('prof-facebook-input')?.value   || '').trim();
        const ytVal        = (document.getElementById('prof-youtube-input')?.value    || '').trim();
        const bioVal       = (document.getElementById('prof-bio-input')?.value        || '').trim();
        const saveBtn      = document.getElementById('prof-save-btn');
        const errEl        = document.getElementById('prof-edit-error');
        if (errEl) errEl.style.display = 'none';
        if (saveBtn) { saveBtn.disabled = true; saveBtn.style.opacity = '0.5'; }
        try {
            await dbUpdateInstructorProfile(instructorId, photoVal, bioVal, igVal, fbVal, ytVal);
            // Store'u local olarak güncelle
            const instructors = store.get('globalInstructors');
            const idx = instructors.findIndex(i => i.id === instructorId);
            if (idx !== -1) {
                instructors[idx] = {
                    ...instructors[idx],
                    photo_url:     photoVal || null,
                    bio:           bioVal   || null,
                    instagram_url: igVal    || null,
                    facebook_url:  fbVal    || null,
                    youtube_url:   ytVal    || null
                };
                store.set('globalInstructors', [...instructors]);
            }
            showToast(lang === 'tr' ? 'Profil kaydedildi' : 'Profile saved', 'success');
            renderInstructorProfile(instructorId);
        } catch (err) {
            if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
        } finally {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.style.opacity = '1'; }
        }
    });

    // Video satırlarına tıklama (play)
    document.querySelectorAll('.prof-watch-btn[data-watch]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const vidId    = parseInt(btn.dataset.watch, 10);
            const vid      = allVideos.find(v => v.id === vidId);
            if (!vid) return;
            const platform = vid.platform || 'other';
            if (platform === 'drive') {
                openVideoModal(vid.drive_url || vid.url);
            } else if (platform === 'youtube') {
                openVideoModal(convertYoutubeUrlToEmbed(vid.url));
            } else if (vid.url) {
                window.open(vid.url, '_blank');
            }
        });
    });
}