// uiRenderer.js

// 1. CHIPS (KUTUCUK) GÖRSELLEŞTİRME SİSTEMİ
export function renderChips(containerId, chipsArray, onRemoveCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    chipsArray.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `#${tag} <span class="chip-close-x" data-idx="${index}">&times;</span>`;
        chip.querySelector('.chip-close-x').addEventListener('click', () => {
            onRemoveCallback(index);
        });
        container.appendChild(chip);
    });
}

// 2. AUTOCOMPLETE (OTOMATİK ÖNERİ) AYARLAMA FONKSİYONU
export function setupAutocomplete(inputId, listId, chipsArray, renderChipsFn, onAddCallback, getAllUniqueTagsPool) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;
    let currentFocus = -1;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';
        currentFocus = -1;
        if (!val) {
            list.classList.add('d-none');
            return;
        }

        const pool = getAllUniqueTagsPool();
        const filtered = pool.filter(tag => tag.toLowerCase().includes(val) && !chipsArray.includes(tag));

        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }

        list.classList.remove('d-none');
        filtered.forEach((tag) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-suggestion-item';
            const idx = tag.toLowerCase().indexOf(val);
            item.innerHTML = tag.substring(0, idx) + "<strong>" + tag.substring(idx, idx + val.length) + "</strong>" + tag.substring(idx + val.length);
            
            item.addEventListener('click', () => {
                onAddCallback(tag);
                input.value = '';
                list.classList.add('d-none');
            });
            list.appendChild(item);
        });
    });

    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-suggestion-item');
        if (e.key === 'ArrowDown') {
            currentFocus++;
            addActive(items);
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            addActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            } else {
                const val = input.value.replace(/,/g, '').trim();
                if (val && !chipsArray.includes(val)) {
                    onAddCallback(val);
                    input.value = '';
                    list.classList.add('d-none');
                }
            }
        } else if (e.key === 'Backspace' && input.value === '') {
            if (chipsArray.length > 0) {
                chipsArray.pop();
                renderChipsFn();
            }
        }
    });

    input.addEventListener('keyup', (e) => {
        if (e.key === ',' || e.code === 'Comma') {
            const val = input.value.replace(/,/g, '').trim();
            if (val && !chipsArray.includes(val)) {
                onAddCallback(val);
            }
            input.value = '';
            list.classList.add('d-none');
        }
    });

    function addActive(items) {
        if (!items || items.length === 0) return;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('autocomplete-active');
    }

    function removeActive(items) {
        items.forEach(item => item.classList.remove('autocomplete-active'));
    }

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.classList.add('d-none');
        }
    });
}

// 3. VİDEO KARTLARINI EKRANA ÇİZME FONKSİYONU (ORİJİNAL CSS VE TASARIM KORUNDU)
export function renderVideoCards(videos, config) {
    const { 
        currentLang, 
        currentView, 
        translations, 
        favs, 
        toggleFavorite, 
        openTagsEditModal, 
        startVideoEditFlow, 
        deleteVideoFlow, 
        openVideoModal 
    } = config;

    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        const msg = currentView === 'favorites' ? lang.emptyFav : lang.empty;
        videoGrid.innerHTML = `<div class="info-msg" id="loading-msg">${msg}</div>`;
        return;
    }

    videos.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        
        let roleDisplay = video.role_type || 'Both';
        let roleBadgeClass = '';
        if (roleDisplay === 'Leader') {
            roleDisplay = currentLang === 'tr' ? 'Lider' : 'Leader';
            roleBadgeClass = 'badge-leader';
        } else if (roleDisplay === 'Follower') {
            roleDisplay = currentLang === 'tr' ? 'Takipçi' : 'Follower';
            roleBadgeClass = 'badge-follower';
        } else {
            roleDisplay = currentLang === 'tr' ? 'İkisi de' : 'Both';
            roleBadgeClass = 'badge-both';
        }

        const storageText = video.is_downloaded ? '💾 Drive' : '🌐 Sosyal Medya';
        const storageClass = video.is_downloaded ? 'badge-drive' : 'badge-social';
        
        const partnerDisplay = video.partner_name 
            ? `<span class="card-partner">👥 ${video.partner_name}</span>` 
            : '';
        
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
        
        const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600';
        const coverImg = video.cover_url || defaultCover;
        const isFav = favs.includes(video.id);

        // Hem yedeklenmiş Drive videolarını hem de YouTube (Shorts/Normal) linklerini yakalıyoruz
        const hasDrive = video.is_downloaded && video.drive_url;
        const isYouTube = video.url && (video.url.includes('youtube.com') || video.url.includes('youtu.be'));
        const shouldOpenInModal = hasDrive || isYouTube;

        // Modal tetikleyiciler için dinamik nitelik ayarları
        const actionClickAttr = shouldOpenInModal ? `data-modal-url="true" class="play-trigger-btn"` : `href="${video.url}" target="_blank"`;
        const actionLinkClickAttr = shouldOpenInModal ? `data-modal-url="true" class="card-action-link drive-trigger"` : `href="${video.url}" target="_blank" class="card-action-link"`;

        // Eğitmen adının app.js üzerindeki map ile veya doğrudan ilişkisel nesneyle doğru beslenmesi sağlandı
        const displayInstructorName = video.instructor_name || (video.instructors ? video.instructors.name : 'Bilinmeyen Eğitmen');

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
                <strong class="card-instructor">👤 ${displayInstructorName}</strong>
                ${partnerDisplay}
                
                <div class="card-badges">
                    <span class="badge ${roleBadgeClass}">${roleDisplay}</span>
                    <span class="badge ${storageClass}">${storageText}</span>
                </div>

                <div class="card-badges card-tags-wrapper-row" style="margin-top: 2px; gap: 4px; align-items:center;">${tagsHtml}</div>

                <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-top:4px;">
                    <a ${actionLinkClickAttr}>
                        ${shouldOpenInModal ? (currentLang === 'tr' ? '🎬 Kütüphanede İzle →' : '🎬 Watch in Library →') : lang.watch}
                    </a>
                    
                    <div style="display:flex; gap:8px;">
                        <button class="card-crud-btn card-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        // Orijinal buton olay dinleyicileri
        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(video.id);
        });

        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(video);
        });

        card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            startVideoEditFlow(video);
        });

        card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteVideoFlow(video.id);
        });

        // Tıklama durumunda modalı güvenli link formatıyla tetikler
        if (shouldOpenInModal) {
            const triggers = card.querySelectorAll('[data-modal-url]');
            triggers.forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    let targetUrl = hasDrive ? video.drive_url : video.url;
                    
                    if (isYouTube) {
                        targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                    }
                    openVideoModal(targetUrl);
                });
            });
        }

        videoGrid.appendChild(card);
    });
}

// YouTube linklerini iframe uyumlu embed yapısına çeviren güvenli fonksiyon
function convertYoutubeUrlToEmbed(url) {
    if (!url) return '';
    // YouTube Shorts kontrolü
    if (url.includes('/shorts/')) {
        const parts = url.split('/shorts/');
        if (parts[1]) {
            const id = parts[1].split(/[?#]/)[0];
            return `https://www.youtube.com/embed/${id}`;
        }
    }
    // Standart YouTube videoları (?v=...)
    if (url.includes('v=')) {
        const regExp = /[?&]v=([^&#]+)/;
        const matches = url.match(regExp);
        if (matches && matches[1]) {
            return `https://www.youtube.com/embed/${matches[1]}`;
        }
    }
    // Kısaltılmış linkler (youtu.be/...)
    if (url.includes('youtu.be/')) {
        const parts = url.split('youtu.be/');
        if (parts[1]) {
            const id = parts[1].split(/[?#]/)[0];
            return `https://www.youtube.com/embed/${id}`;
        }
    }
    return url;
}