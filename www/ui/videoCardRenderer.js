// ui/videoCardRenderer.js
// ✅ GÜNCELLEME (Adım 2.4): Her karta 📋 playlist butonu eklendi.
// ✅ GÜNCELLEME (Adım 3.2): Benzer kombinasyonlar bölümü eklendi.
// ✅ GÜNCELLEME (Adım 7.2): Liste görünümü (renderVideoList) eklendi.
// ✅ GÜNCELLEME (Adım 3.3): Etiket badge'lerine renk sistemi eklendi.
import { openNoteEditModal } from '../tangoModals.js';
import { store } from '../store.js';
import { getTagColor } from '../tagColorManager.js'; // ✅ YENİ (Adım 3.3)
import { openAnnotationModal } from '../annotationManager.js';
import { openLinkManager, buildChainNavHtml } from '../chainManager.js'; // ✅ YENİ (Adım 6.2)

// ─────────────────────────────────────────────────────────────
// getLearningStatusBadgeHtml
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
// getTagBadgeHtml  ✅ YENİ (Adım 3.3)
// Bir etiket için renkli veya varsayılan badge HTML'i döner.
// ─────────────────────────────────────────────────────────────
function getTagBadgeHtml(tag) {
    const customColor = getTagColor(tag);
    if (customColor) {
        // Renk atanmışsa: o rengi bg/border/text olarak kullan
        return `<span class="badge tag-colored-badge" style="
            background: ${customColor}22;
            color: ${customColor};
            border: 1px solid ${customColor}66;
            font-size: 0.7rem;
            padding: 2px 6px;
        ">#${tag}</span>`;
    }
    // Renk atanmamışsa: varsayılan stil
    return `<span class="badge" style="background:rgba(255,255,255,0.05);color:#cbd5e1;border:1px solid rgba(255,255,255,0.1);font-size:0.7rem;padding:2px 6px;">#${tag}</span>`;
}

// ─────────────────────────────────────────────────────────────
// findSimilarVideos  (Adım 3.2)
// ─────────────────────────────────────────────────────────────
function findSimilarVideos(video, allVideos, limit = 3) {
    if (!video.tags || !video.tags.trim()) return [];
    const myTags = new Set(
        video.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    );
    if (myTags.size === 0) return [];
    const scored = [];
    for (const other of allVideos) {
        if (other.id === video.id) continue;
        if (!other.tags) continue;
        const otherTags = other.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        let overlap = 0;
        for (const tag of otherTags) { if (myTags.has(tag)) overlap++; }
        if (overlap > 0) scored.push({ video: other, score: overlap });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.video);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function convertYoutubeUrlToEmbed(url) {
    if (!url) return url;
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
    return url;
}

// ─────────────────────────────────────────────────────────────
// renderVideoList  ✅ YENİ (Adım 7.2)
// ─────────────────────────────────────────────────────────────
export function renderVideoList(videos, config) {
    const {
        currentLang, currentView, translations: langPack, favs,
        toggleFavorite, openTagsEditModal, startVideoEditFlow,
        deleteVideoFlow, openVideoModal, updateLearningStatus
    } = config;

    const videoGrid = document.getElementById('video-grid');
    const lang = langPack[currentLang];

    videoGrid.classList.add('video-list-mode');
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        const msg = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${msg}</div>`;
        return;
    }

    const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=200';

    videos.forEach(video => {
        const platform = video.platform || 'other';
        const isEmbeddable = (platform === 'drive' || platform === 'youtube');
        const coverImg = video.cover_url || defaultCover;
        const isFav = favs.includes(video.id);
        const instructorName = video.instructors ? video.instructors.name : (video.instructor_name || 'Bilinmeyen');

        // ✅ Adım 3.3: Liste görünümünde de renkli etiketler
        const tagsArray = video.tags ? video.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
        const tagsHtml = tagsArray.slice(0, 3).map(t => {
            const color = getTagColor(t);
            if (color) {
                return `<span class="vl-tag" style="color:${color};border-color:${color}44;background:${color}11;">#${escapeHtml(t)}</span>`;
            }
            return `<span class="vl-tag">#${escapeHtml(t)}</span>`;
        }).join('') + (tagsArray.length > 3 ? `<span class="vl-tag">+${tagsArray.length - 3}</span>` : '');

        let roleDisplay = video.role_type || 'Both';
        let roleBadgeClass = '';
        if (roleDisplay === 'Leader')        { roleDisplay = lang.leader;   roleBadgeClass = 'badge-leader'; }
        else if (roleDisplay === 'Follower') { roleDisplay = lang.follower; roleBadgeClass = 'badge-follower'; }
        else                                 { roleDisplay = lang.both;     roleBadgeClass = 'badge-both'; }

        const learningBadgeHtml = getLearningStatusBadgeHtml(video, currentLang);

        const row = document.createElement('div');
        row.className = 'video-list-row';

        row.innerHTML = `
            <div class="vl-thumb" style="background-image:url('${coverImg}');" title="${escapeHtml(instructorName)}"></div>
            <div class="vl-info">
                <div class="vl-instructor">${escapeHtml(instructorName)}${video.partner_name ? ` <span class="vl-partner">/ ${escapeHtml(video.partner_name)}</span>` : ''}</div>
                <div class="vl-tags">${tagsHtml || `<span style="color:#475569;font-size:0.65rem;">${currentLang === 'tr' ? 'etiket yok' : 'no tags'}</span>`}</div>
            </div>
            <div class="vl-badges">
                <span class="badge ${roleBadgeClass}" style="font-size:0.65rem;padding:2px 7px;">${roleDisplay}</span>
                ${learningBadgeHtml}
            </div>
            <div class="vl-actions">
                <button class="vl-btn vl-fav-btn ${isFav ? 'active' : ''}" title="${currentLang === 'tr' ? 'Pratik listesi' : 'Favorites'}">★</button>
                <button class="vl-btn vl-watch-btn" title="${currentLang === 'tr' ? 'İzle' : 'Watch'}">▶</button>
                <button class="vl-btn vl-chain-btn" title="${currentLang === 'tr' ? 'Kombinasyon Zinciri' : 'Combination Chain'}">🔗</button>
                <button class="vl-btn vl-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                <button class="vl-btn vl-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
            </div>`;

        row.querySelector('.vl-fav-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        row.querySelector('.vl-watch-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (isEmbeddable && openVideoModal) {
                let targetUrl = platform === 'drive' ? video.drive_url : video.url;
                if (platform === 'youtube') targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                openVideoModal(targetUrl);
            } else if (video.url) {
                window.open(video.url, '_blank');
            }
        });

        const vlChainBtn = row.querySelector('.vl-chain-btn');
        if (vlChainBtn) {
            vlChainBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openLinkManager(video);
            });
        }

        row.querySelector('.vl-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            startVideoEditFlow(video);
        });

        row.querySelector('.vl-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteVideoFlow(video.id);
        });

        const lBadge = row.querySelector('.learning-badge');
        if (lBadge) {
            lBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentStatus = lBadge.dataset.status;
                const currentReviewCount = parseInt(lBadge.dataset.reviewCount || '0', 10);
                const nextStatus = currentStatus === 'new' ? 'learning'
                                 : currentStatus === 'learning' ? 'mastered' : 'new';
                updateLearningStatus(video.id, nextStatus, currentReviewCount);
            });
        }

        videoGrid.appendChild(row);
    });
}

// ─────────────────────────────────────────────────────────────
// renderVideoCards  (Grid görünümü — ana fonksiyon)
// ─────────────────────────────────────────────────────────────
export function renderVideoCards(videos, config) {
    if (store.get('viewMode') === 'list') {
        renderVideoList(videos, config);
        return;
    }

    const {
        currentLang, currentView, translations: langPack, favs,
        toggleFavorite, openTagsEditModal, startVideoEditFlow,
        deleteVideoFlow, openVideoModal, refreshList,
        updateLearningStatus, showPlaylistDropdown
    } = config;

    const videoGrid = document.getElementById('video-grid');
    const lang = langPack[currentLang];

    videoGrid.classList.remove('video-list-mode');
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        const msg = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${msg}</div>`;
        return;
    }

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

        // ✅ Adım 3.3: getTagBadgeHtml ile renkli etiket badge'leri
        let tagsHtml = '';
        if (video.tags && video.tags.trim() !== '') {
            video.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(tag => {
                tagsHtml += getTagBadgeHtml(tag);
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

        const similarVideos = findSimilarVideos(video, allVideos, 3);
        let similarHtml = '';
        if (similarVideos.length > 0) {
            const titleText = currentLang === 'tr' ? 'Benzer Kombinasyonlar' : 'Similar Combinations';
            const miniCards = similarVideos.map(sv => {
                const svCover = sv.cover_url || defaultCover;
                const svName = sv.instructors ? sv.instructors.name : (sv.instructor_name || '?');
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

        // ✅ YENİ (Adım 6.2): Kombinasyon zinciri navigasyon şeridi
        const chainNavHtml = buildChainNavHtml(video, currentLang);

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
                ${chainNavHtml}
                <div style="display:flex;justify-content:space-between;width:100%;align-items:center;margin-top:4px;">
                    <a ${actionLinkClickAttr}>${watchText}</a>
                    <div style="display:flex;gap:8px;">
                        <button class="card-crud-btn card-annotate-btn" title="${currentLang === 'tr' ? 'Zaman Notları' : 'Time Notes'}">📍</button>
                        <button class="card-crud-btn card-chain-btn" title="${currentLang === 'tr' ? 'Kombinasyon Zinciri' : 'Combination Chain'}">🔗</button>
                        <button class="card-crud-btn card-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>`;

        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        const playlistBtn = card.querySelector('.playlist-add-btn');
        if (playlistBtn && showPlaylistDropdown) {
            playlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showPlaylistDropdown(video.id, playlistBtn);
            });
        }

        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(video);
        });

        const annotateBtn = card.querySelector('.card-annotate-btn');
        if (annotateBtn) {
            annotateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAnnotationModal(video);
            });
        }

        // ✅ YENİ (Adım 6.2): Zincir yönetim butonu
        const chainBtn = card.querySelector('.card-chain-btn');
        if (chainBtn) {
            chainBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openLinkManager(video);
            });
        }

        // ✅ YENİ (Adım 6.2): Zincir chip'lerine tıklayınca bağlı videoyu aç
        card.querySelectorAll('.chain-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const p = chip.dataset.chainPlatform;
                const u = chip.dataset.chainUrl;
                const d = chip.dataset.chainDrive;
                const embeddable = (p === 'drive' || p === 'youtube');
                if (embeddable && openVideoModal) {
                    let targetUrl = p === 'drive' ? d : u;
                    if (p === 'youtube') targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                    openVideoModal(targetUrl);
                } else if (u) {
                    window.open(u, '_blank');
                }
            });
        });

        card.querySelector('.card-edit-btn').addEventListener('click', (e) => { e.stopPropagation(); startVideoEditFlow(video); });
        card.querySelector('.card-delete-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteVideoFlow(video.id); });

        const noteEditBtn = card.querySelector('.note-edit-btn');
        if (noteEditBtn) {
            noteEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openNoteEditModal(video, () => { if (refreshList) refreshList(); });
            });
        }

        const learningBadge = card.querySelector('.learning-badge');
        if (learningBadge) {
            learningBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                const currentStatus = learningBadge.dataset.status;
                const currentReviewCount = parseInt(learningBadge.dataset.reviewCount || '0', 10);
                const nextStatus = currentStatus === 'new' ? 'learning'
                                 : currentStatus === 'learning' ? 'mastered' : 'new';
                updateLearningStatus(video.id, nextStatus, currentReviewCount);
            });
        }

        // Benzer video tıklama
        card.querySelectorAll('.similar-video-mini').forEach(mini => {
            mini.addEventListener('click', (e) => {
                e.stopPropagation();
                const miniPlatform = mini.dataset.similarPlatform;
                const miniUrl = mini.dataset.similarUrl;
                const miniDrive = mini.dataset.similarDrive;
                const isEmbeddableMini = (miniPlatform === 'drive' || miniPlatform === 'youtube');
                if (isEmbeddableMini && openVideoModal) {
                    let targetUrl = miniPlatform === 'drive' ? miniDrive : miniUrl;
                    if (miniPlatform === 'youtube') targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                    openVideoModal(targetUrl);
                } else if (miniUrl) {
                    window.open(miniUrl, '_blank');
                }
            });
        });

        videoGrid.appendChild(card);
    });

    // Play overlay tıklama
    videoGrid.querySelectorAll('.play-trigger-btn, .drive-trigger').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const card = btn.closest('.video-card');
            if (!card) return;
            const videoId = parseInt(card.querySelector('.fav-star-btn')?.dataset.id);
            const vid = allVideos.find(v => v.id === videoId);
            if (!vid) return;
            const pl = vid.platform || 'other';
            if (pl === 'drive') { openVideoModal(vid.drive_url || vid.url); }
            else if (pl === 'youtube') { openVideoModal(convertYoutubeUrlToEmbed(vid.url)); }
        });
    });
}