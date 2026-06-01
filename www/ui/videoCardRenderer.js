// ui/videoCardRenderer.js
// ✅ GÜNCELLEME (Adım 2.4): Her karta 📋 playlist butonu eklendi.
// ✅ GÜNCELLEME (Adım 3.2): Benzer kombinasyonlar bölümü eklendi.
import { openNoteEditModal } from '../tangoModals.js';
import { store } from '../store.js'; // ✅ YENİ (Adım 3.2): Tüm video listesine erişim

// ─────────────────────────────────────────────────────────────
// getLearningStatusBadgeHtml
// Her kartın öğrenme durumu badge'ini oluşturur.
// ─────────────────────────────────────────────────────────────
export function getLearningStatusBadgeHtml(video, currentLang) {
    const learningStatus = video.learning_status || 'new';
    let learningBadgeClass = '';
    let learningText = '';
    if (currentLang === 'tr') {
        if (learningStatus === 'new')           { learningText = '🆕 Yeni';        learningBadgeClass = 'badge-learning-new'; }
        else if (learningStatus === 'learning') { learningText = '📚 Çalışıyorum'; learningBadgeClass = 'badge-learning-active'; }
        else                                    { learningText = '✅ Ustalaştım';   learningBadgeClass = 'badge-learning-mastered'; }
    } else {
        if (learningStatus === 'new')           { learningText = '🆕 New';      learningBadgeClass = 'badge-learning-new'; }
        else if (learningStatus === 'learning') { learningText = '📚 Learning'; learningBadgeClass = 'badge-learning-active'; }
        else                                    { learningText = '✅ Mastered'; learningBadgeClass = 'badge-learning-mastered'; }
    }
    return `<span class="badge learning-badge ${learningBadgeClass}" data-video-id="${video.id}" data-status="${learningStatus}" data-review-count="${video.review_count || 0}" style="cursor:pointer;" title="Öğrenme durumunu değiştirmek için tıkla">${learningText}</span>`;
}

// ─────────────────────────────────────────────────────────────
// findSimilarVideos  ✅ YENİ (Adım 3.2)
// Bir videoyla aynı etiketleri paylaşan diğer videoları bulur.
// Ortak etiket sayısına göre sıralar, en yüksek puanlı 'limit'
// kadarını döner. Hiç ortak etiket yoksa boş dizi döner.
// ─────────────────────────────────────────────────────────────
function findSimilarVideos(video, allVideos, limit = 3) {
    if (!video.tags || !video.tags.trim()) return [];

    // Mevcut videonun etiketlerini küçük harfle bir Set'e al
    const myTags = new Set(
        video.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    );
    if (myTags.size === 0) return [];

    const scored = [];
    for (const other of allVideos) {
        if (other.id === video.id) continue; // Kendini dahil etme
        if (!other.tags) continue;

        const otherTags = other.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        let overlap = 0;
        for (const tag of otherTags) {
            if (myTags.has(tag)) overlap++;
        }
        if (overlap > 0) {
            scored.push({ video: other, score: overlap });
        }
    }

    // Çok ortak etiketli videolar önce gelsin
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.video);
}

// ─────────────────────────────────────────────────────────────
// renderVideoCards
// Ana kart render fonksiyonu.
// ─────────────────────────────────────────────────────────────
export function renderVideoCards(videos, config) {
    const {
        currentLang, currentView, translations: langPack, favs,
        toggleFavorite, openTagsEditModal, startVideoEditFlow,
        deleteVideoFlow, openVideoModal, refreshList,
        updateLearningStatus, showPlaylistDropdown
    } = config;

    const videoGrid = document.getElementById('video-grid');
    const lang = langPack[currentLang];
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        const msg = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${msg}</div>`;
        return;
    }

    // ✅ (Adım 3.2): Tüm video listesini bir kez al — benzer video hesaplamada kullanılır
    const allVideos = store.get('globalVideos');

    videos.forEach(video => {
        const platform = video.platform || 'other';
        const platformLabel = lang.platformLabels[platform] || 'Diğer';
        const iconUrl = lang.platformIconUrls[platform] || '';
        const isEmbeddable = (platform === 'drive' || platform === 'youtube');

        let watchText = '';
        if (currentLang === 'tr') {
            const watchOn = lang.platformWatchText[platform];
            watchText = platform !== 'other' ? `Videoyu ${watchOn} İzle →` : 'Videoyu İzle →';
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

        let roleDisplay = video.role_type || 'Both';
        let roleBadgeClass = '';
        if (roleDisplay === 'Leader')        { roleDisplay = lang.leader;   roleBadgeClass = 'badge-leader'; }
        else if (roleDisplay === 'Follower') { roleDisplay = lang.follower; roleBadgeClass = 'badge-follower'; }
        else                                 { roleDisplay = lang.both;     roleBadgeClass = 'badge-both'; }

        const learningBadgeHtml = getLearningStatusBadgeHtml(video, currentLang);
        const partnerDisplay = video.partner_name
            ? `<span class="card-partner">👥 ${video.partner_name}</span>`
            : '';

        let tagsHtml = '';
        if (video.tags && video.tags.trim() !== '') {
            video.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
                tagsHtml += `<span class="badge" style="background:rgba(255,255,255,0.05);color:#cbd5e1;border:1px solid rgba(255,255,255,0.1);font-size:0.7rem;padding:2px 6px;">#${tag}</span>`;
            });
            tagsHtml += `<button class="inline-edit-tags-btn" title="${lang.editTagsTitle}">✏️</button>`;
        } else {
            tagsHtml = `<button class="inline-edit-tags-btn" title="${lang.editTagsTitle}">➕ ${lang.editTagsTitle}</button>`;
        }

        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;
        const isFav = favs.includes(video.id);
        const noteText = video.notes
            ? (video.notes.length > 60 ? video.notes.substring(0, 60) + '...' : video.notes)
            : lang.addNote;

        const noteHtml = `
            <div class="card-note-area" style="margin-top:8px;font-size:0.75rem;color:#94a3b8;display:flex;align-items:center;gap:6px;">
                <button class="note-edit-btn" style="background:transparent;border:none;color:#00f0ff;cursor:pointer;" title="${lang.editNote}">📝</button>
                <span class="note-preview">${escapeHtml(noteText)}</span>
            </div>`;

        const platformBadgeHtml = `<span class="badge" style="background:rgba(0,240,255,0.15);color:#00f0ff;display:inline-flex;align-items:center;gap:4px;"><img src="${iconUrl}" style="width:14px;height:14px;object-fit:contain;" onerror="this.onerror=null;this.style.display='none';this.nextSibling.style.display='inline';"><span style="display:inline;">${platformLabel}</span></span>`;

        // ── Benzer Kombinasyonlar Bölümü ✅ YENİ (Adım 3.2) ──────
        const similarVideos = findSimilarVideos(video, allVideos, 3);
        let similarHtml = '';
        if (similarVideos.length > 0) {
            const titleText = currentLang === 'tr' ? 'Benzer Kombinasyonlar' : 'Similar Combinations';
            const miniCards = similarVideos.map(sv => {
                const svCover = sv.cover_url || defaultCover;
                // Eğitmen adını hem flat hem nested yapıdan al
                const svName = sv.instructors ? sv.instructors.name : (sv.instructor_name || '?');
                // İlk 2 etiketi göster
                const svTagText = sv.tags
                    ? sv.tags.split(',').slice(0, 2).map(t => '#' + t.trim()).join(' ')
                    : '';
                return `<div class="similar-video-mini"
                             data-similar-id="${sv.id}"
                             data-similar-url="${escapeHtml(sv.url || '')}"
                             data-similar-platform="${sv.platform || 'other'}"
                             data-similar-drive="${escapeHtml(sv.drive_url || '')}">
                            <div class="similar-video-mini-thumb" style="background-image:url('${svCover}');"></div>
                            <div class="similar-video-mini-info">
                                <div class="similar-video-mini-instructor">${escapeHtml(svName)}</div>
                                <div class="similar-video-mini-tags">${escapeHtml(svTagText)}</div>
                            </div>
                        </div>`;
            }).join('');

            similarHtml = `
                <div class="similar-videos-section">
                    <div class="similar-videos-title">${titleText}</div>
                    <div class="similar-videos-list">${miniCards}</div>
                </div>`;
        }
        // ──────────────────────────────────────────────────────────

        card.innerHTML = `
            <div class="video-cover-link">
                <div class="video-cover-container" style="background-image:url('${coverImg}');">
                    <button class="fav-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">★</button>
                    <button class="playlist-add-btn" data-video-id="${video.id}" title="${currentLang === 'tr' ? 'Listeye Ekle' : 'Add to List'}">📋</button>
                    <a ${actionClickAttr}>
                        <div class="play-overlay"><span class="play-icon">▶</span></div>
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
                <div class="card-badges card-tags-wrapper-row" style="margin-top:2px;gap:4px;align-items:center;">${tagsHtml}</div>
                ${noteHtml}
                ${similarHtml}
                <div style="display:flex;justify-content:space-between;width:100%;align-items:center;margin-top:4px;">
                    <a ${actionLinkClickAttr}>${watchText}</a>
                    <div style="display:flex;gap:8px;">
                        <button class="card-crud-btn card-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>`;

        // ── Event Listener'lar ─────────────────────────────────────

        // Favori
        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        // Playlist butonu
        const playlistBtn = card.querySelector('.playlist-add-btn');
        if (playlistBtn && showPlaylistDropdown) {
            playlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showPlaylistDropdown(video.id, playlistBtn);
            });
        }

        // Etiket düzenleme
        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(video);
        });

        // Düzenle ve sil
        card.querySelector('.card-edit-btn').addEventListener('click', (e) => { e.stopPropagation(); startVideoEditFlow(video); });
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteVideoFlow(video.id); });

        // Not
        const noteEditBtn = card.querySelector('.note-edit-btn');
        if (noteEditBtn) {
            noteEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNoteEditModal(video, () => { if (refreshList) refreshList(); });
            });
        }

        // Öğrenme durumu badge
        const learningBadge = card.querySelector('.learning-badge');
        if (learningBadge) {
            learningBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentStatus = learningBadge.dataset.status;
                const currentReviewCount = parseInt(learningBadge.dataset.reviewCount || '0', 10);
                const nextStatus = currentStatus === 'new' ? 'learning'
                                 : currentStatus === 'learning' ? 'mastered'
                                 : 'new';
                updateLearningStatus(video.id, nextStatus, currentReviewCount);
            });
        }

        // ✅ (Adım 3.2): Benzer video mini kartlarına tıklama
        card.querySelectorAll('.similar-video-mini').forEach(miniCard => {
            miniCard.addEventListener('click', (e) => {
                e.stopPropagation();
                const svPlatform = miniCard.dataset.similarPlatform;
                const svUrl      = miniCard.dataset.similarUrl;
                const svDrive    = miniCard.dataset.similarDrive;
                const isEmb      = (svPlatform === 'drive' || svPlatform === 'youtube');
                if (isEmb && openVideoModal) {
                    let targetUrl = svPlatform === 'drive' ? svDrive : svUrl;
                    if (svPlatform === 'youtube') targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                    openVideoModal(targetUrl);
                } else if (svUrl) {
                    window.open(svUrl, '_blank');
                }
            });
        });

        // Modal açma (kapak ve izle butonu)
        if (shouldOpenInModal) {
            card.querySelectorAll('[data-modal-url]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    let targetUrl = (platform === 'drive') ? video.drive_url : video.url;
                    if (platform === 'youtube') targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                    openVideoModal(targetUrl);
                });
            });
        }

        videoGrid.appendChild(card);
    });
}

// ─────────────────────────────────────────────────────────────
// Yardımcı: YouTube URL'ini embed URL'ine çevirir
// ─────────────────────────────────────────────────────────────
function convertYoutubeUrlToEmbed(url) {
    if (!url) return '';
    if (url.includes('/shorts/')) {
        const id = url.split('/shorts/')[1]?.split(/[?#]/)[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('v=')) {
        const m = url.match(/[?&]v=([^&#]+)/);
        if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split(/[?#]/)[0];
        if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return url;
}

// ─────────────────────────────────────────────────────────────
// Yardımcı: HTML özel karakterlerini güvenli hale getirir
// ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}