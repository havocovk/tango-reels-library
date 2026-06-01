// ui/videoCardRenderer.js - Video kartları
// ✅ DÜZELTİLDİ:
// 1. getLearningStatusBadgeHtml() ayrı ve export edilmiş bir fonksiyon olarak çıkarıldı.
//    Adım 2.2 (Spaced Repetition) ve 2.3 (Practice Session) bu fonksiyonu doğrudan çağıracak.
// 2. updateLearningStatus çağrısı güncellenmiş imzaya göre düzeltildi:
//    (videoId, newStatus, currentReviewCount) — review_count doğru aktarılıyor.
import { openNoteEditModal } from '../tangoModals.js';

// ─────────────────────────────────────────────────────────────
// YENİ AYRI FONKSİYON: getLearningStatusBadgeHtml
// Adım 2.2 ve 2.3'te bu fonksiyon başka yerlerden de çağrılacak.
// video        : video nesnesi (video.learning_status gerekli)
// currentLang  : 'tr' veya 'en'
// Döndürür     : Tıklanabilir badge için tam HTML string'i
// ─────────────────────────────────────────────────────────────
export function getLearningStatusBadgeHtml(video, currentLang) {
    const learningStatus = video.learning_status || 'new';
    let learningBadgeClass = '';
    let learningText = '';

    if (currentLang === 'tr') {
        if (learningStatus === 'new') {
            learningText = '🆕 Yeni';
            learningBadgeClass = 'badge-learning-new';
        } else if (learningStatus === 'learning') {
            learningText = '📚 Çalışıyorum';
            learningBadgeClass = 'badge-learning-active';
        } else {
            learningText = '✅ Ustalaştım';
            learningBadgeClass = 'badge-learning-mastered';
        }
    } else {
        if (learningStatus === 'new') {
            learningText = '🆕 New';
            learningBadgeClass = 'badge-learning-new';
        } else if (learningStatus === 'learning') {
            learningText = '📚 Learning';
            learningBadgeClass = 'badge-learning-active';
        } else {
            learningText = '✅ Mastered';
            learningBadgeClass = 'badge-learning-mastered';
        }
    }

    return `<span
        class="badge learning-badge ${learningBadgeClass}"
        data-video-id="${video.id}"
        data-status="${learningStatus}"
        data-review-count="${video.review_count || 0}"
        style="cursor: pointer;"
        title="Öğrenme durumunu değiştirmek için tıkla"
    >${learningText}</span>`;
}

// ─────────────────────────────────────────────────────────────
// ANA FONKSİYON: renderVideoCards
// ─────────────────────────────────────────────────────────────
export function renderVideoCards(videos, config) {
    const {
        currentLang,
        currentView,
        translations: langPack,
        favs,
        toggleFavorite,
        openTagsEditModal,
        startVideoEditFlow,
        deleteVideoFlow,
        openVideoModal,
        refreshList,
        updateLearningStatus
    } = config;

    const videoGrid = document.getElementById('video-grid');
    const lang = langPack[currentLang];
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        const msg = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${msg}</div>`;
        return;
    }

    videos.forEach(video => {
        const platform = video.platform || 'other';
        const platformLabel = lang.platformLabels[platform] || 'Diğer';
        const iconUrl = lang.platformIconUrls[platform] || '';
        const isEmbeddable = (platform === 'drive' || platform === 'youtube');

        let watchText = '';
        if (currentLang === 'tr') {
            const watchOn = lang.platformWatchText[platform];
            if (platform === 'drive') watchText = `Videoyu ${watchOn} İzle →`;
            else if (platform === 'youtube') watchText = `Videoyu ${watchOn} İzle →`;
            else if (platform === 'instagram') watchText = `Videoyu ${watchOn} İzle →`;
            else if (platform === 'facebook') watchText = `Videoyu ${watchOn} İzle →`;
            else watchText = `Videoyu İzle →`;
        } else {
            watchText = lang.watchOnPlatform.replace('{platform}', platformLabel);
        }

        const shouldOpenInModal = isEmbeddable;
        const actionClickAttr = shouldOpenInModal
            ? `data-modal-url="true" class="play-trigger-btn"`
            : `href="${video.url}" target="_blank"`;
        const actionLinkClickAttr = shouldOpenInModal
            ? `data-modal-url="true" class="card-action-link drive-trigger"`
            : `href="${video.url}" target="_blank" class="card-action-link"`;

        const card = document.createElement('div');
        card.className = 'video-card';

        // Rol badge
        let roleDisplay = video.role_type || 'Both';
        let roleBadgeClass = '';
        if (roleDisplay === 'Leader') {
            roleDisplay = lang.leader;
            roleBadgeClass = 'badge-leader';
        } else if (roleDisplay === 'Follower') {
            roleDisplay = lang.follower;
            roleBadgeClass = 'badge-follower';
        } else {
            roleDisplay = lang.both;
            roleBadgeClass = 'badge-both';
        }

        // ✅ Öğrenme durumu badge'ini ayrı fonksiyondan al
        const learningBadgeHtml = getLearningStatusBadgeHtml(video, currentLang);

        // Partner
        const partnerDisplay = video.partner_name
            ? `<span class="card-partner">👥 ${video.partner_name}</span>`
            : '';

        // Etiketler
        let tagsHtml = '';
        if (video.tags && video.tags.trim() !== '') {
            const tagsArray = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
            tagsArray.forEach(tag => {
                tagsHtml += `<span class="badge" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); font-size: 0.7rem; padding: 2px 6px;">#${tag}</span>`;
            });
            tagsHtml += `<button class="inline-edit-tags-btn" title="${lang.editTagsTitle}">✏️</button>`;
        } else {
            tagsHtml = `<button class="inline-edit-tags-btn" title="${lang.editTagsTitle}">➕ ${lang.editTagsTitle}</button>`;
        }

        // Kapak ve favori
        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;
        const isFav = favs.includes(video.id);

        // Not alanı
        const noteText = video.notes
            ? (video.notes.length > 60 ? video.notes.substring(0, 60) + '...' : video.notes)
            : lang.addNote;
        const noteHtml = `
            <div class="card-note-area" style="margin-top: 8px; font-size:0.75rem; color:#94a3b8; display:flex; align-items:center; gap:6px;">
                <button class="note-edit-btn" style="background:transparent; border:none; color:#00f0ff; cursor:pointer;" title="${lang.editNote}">📝</button>
                <span class="note-preview">${escapeHtml(noteText)}</span>
            </div>
        `;

        // Platform badge
        const platformBadgeHtml = `<span class="badge" style="background: rgba(0,240,255,0.15); color: #00f0ff; display: inline-flex; align-items: center; gap: 4px;"><img src="${iconUrl}" style="width: 14px; height: 14px; object-fit: contain;" onerror="this.onerror=null; this.style.display='none'; this.nextSibling.style.display='inline';"> <span style="display: inline;">${platformLabel}</span></span>`;

        card.innerHTML = `
            <div class="video-cover-link">
                <div class="video-cover-container" style="background-image: url('${coverImg}');">
                    <button class="fav-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">★</button>
                    <a ${actionClickAttr}>
                        <div class="play-overlay">
                            <span class="play-icon">▶</span>
                        </div>
                    </a>
                </div>
            </div>
            <div class="card-info-content">
                <strong class="card-instructor">👤 ${video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen'}</strong>
                ${partnerDisplay}
                <div class="card-badges">
                    <span class="badge ${roleBadgeClass}">${roleDisplay}</span>
                    ${platformBadgeHtml}
                    ${learningBadgeHtml}
                </div>
                <div class="card-badges card-tags-wrapper-row" style="margin-top: 2px; gap: 4px; align-items:center;">${tagsHtml}</div>
                ${noteHtml}
                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:4px;">
                    <a ${actionLinkClickAttr}>${watchText}</a>
                    <div style="display:flex; gap:8px;">
                        <button class="card-crud-btn card-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        // Favori yıldızı
        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        // Etiket düzenleme
        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(video);
        });

        // Düzenle ve sil
        card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            startVideoEditFlow(video);
        });
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteVideoFlow(video.id);
        });

        // Not düzenleme
        const noteEditBtn = card.querySelector('.note-edit-btn');
        if (noteEditBtn) {
            noteEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNoteEditModal(video, () => {
                    if (refreshList) refreshList();
                });
            });
        }

        // ✅ ÖĞRENME DURUMU TIKLAMA
        // Düzeltme: updateLearningStatus artık 3 parametre alıyor:
        // (videoId, nextStatus, currentReviewCount)
        // currentReviewCount badge'den okunuyor → +1 işlemi db/videos.js'de yapılıyor.
        const learningBadge = card.querySelector('.learning-badge');
        if (learningBadge) {
            learningBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentStatus = learningBadge.dataset.status;
                const currentReviewCount = parseInt(learningBadge.dataset.reviewCount || '0', 10);

                let nextStatus = '';
                if (currentStatus === 'new') nextStatus = 'learning';
                else if (currentStatus === 'learning') nextStatus = 'mastered';
                else nextStatus = 'new';

                // ✅ currentReviewCount iletiliyor — artık +1 doğru çalışacak
                updateLearningStatus(video.id, nextStatus, currentReviewCount);
            });
        }

        // Modal video açma
        if (shouldOpenInModal) {
            const triggers = card.querySelectorAll('[data-modal-url]');
            triggers.forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    let targetUrl = (platform === 'drive') ? video.drive_url : video.url;
                    if (platform === 'youtube') {
                        targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                    }
                    openVideoModal(targetUrl);
                });
            });
        }

        videoGrid.appendChild(card);
    });
}

// ─────────────────────────────────────────────────────────────
// YARDIMCI FONKSİYONLAR
// ─────────────────────────────────────────────────────────────
function convertYoutubeUrlToEmbed(url) {
    if (!url) return '';
    if (url.includes('/shorts/')) {
        const parts = url.split('/shorts/');
        if (parts[1]) {
            const id = parts[1].split(/[?#]/)[0];
            return `https://www.youtube.com/embed/${id}`;
        }
    }
    if (url.includes('v=')) {
        const regExp = /[?&]v=([^&#]+)/;
        const matches = url.match(regExp);
        if (matches && matches[1]) {
            return `https://www.youtube.com/embed/${matches[1]}`;
        }
    }
    if (url.includes('youtu.be/')) {
        const parts = url.split('youtu.be/');
        if (parts[1]) {
            const id = parts[1].split(/[?#]/)[0];
            return `https://www.youtube.com/embed/${id}`;
        }
    }
    return url;
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