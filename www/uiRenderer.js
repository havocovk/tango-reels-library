import { translations } from './config.js';

// 1. CHIPS (KUTUCUK) GÖRSELLEŞTİRME SİSTEMİ
export function renderChips(containerId, chipsArray, onRemoveCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    chipsArray.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `#${tag} <span class=\"chip-close-x\" data-idx=\"${index}\">&times;</span>`;
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

        const allTags = getAllUniqueTagsPool();
        const filtered = allTags.filter(t => t.toLowerCase().includes(val) && !chipsArray.includes(t));

        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }

        filtered.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'autocomplete-suggestion-item';
            item.innerText = tag;
            item.addEventListener('click', () => {
                onAddCallback(tag);
                input.value = '';
                list.innerHTML = '';
                list.classList.add('d-none');
                input.focus();
            });
            list.appendChild(item);
        });
        list.classList.remove('d-none');
    });

    input.addEventListener('keydown', (e) => {
        const items = list.getElementsByClassName('autocomplete-suggestion-item');
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
                const val = input.value.trim().replace(/,/g, '');
                if (val && !chipsArray.includes(val)) {
                    onAddCallback(val);
                    input.value = '';
                    list.innerHTML = '';
                    list.classList.add('d-none');
                }
            }
        }
    });

    function addActive(items) {
        if (!items) return false;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('autocomplete-active');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }

    function removeActive(items) {
        for (let i = 0; i < items.length; i++) {
            items[i].classList.remove('autocomplete-active');
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.innerHTML = '';
            list.classList.add('d-none');
        }
    });
}

// 3. VİDEO KARTLARINI EKRANA BASAN GÖRSEL MOTOR (DİL SÖZLÜĞÜ ENTEGRELİ)
export function renderVideoCards(videoGridId, videosArray, favoritesArray, currentLang, openVideoModal, handleToggleFavorite, openTagsEditModal, handleEditVideo, handleDeleteVideo) {
    const videoGrid = document.getElementById(videoGridId);
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    const lang = translations[currentLang] || translations['tr'];

    if (videosArray.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state-message';
        emptyDiv.style.gridColumn = '1 / -1';
        emptyDiv.style.textAlign = 'center';
        emptyDiv.style.padding = '40px';
        emptyDiv.style.color = '#64748b';
        emptyDiv.style.fontSize = '1.1rem';
        emptyDiv.style.lineHeight = '1.6';
        
        const isFavView = (document.getElementById('menu-favorites')?.classList.contains('active'));
        emptyDiv.innerHTML = isFavView ? lang.emptyFav : lang.empty;
        videoGrid.appendChild(emptyDiv);
        return;
    }

    videosArray.forEach(video => {
        const isFav = favoritesArray.some(fav => fav.video_id === video.id);
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.id = video.id;

        const instructorName = video.instructors?.name || video.instructor_name || 'Bilinmeyen Eğitmen';
        const partnerText = video.partner_name ? ` ft. ${video.partner_name}` : '';

        // Rol ve Ortam tipini sözlüğe göre çeviriyoruz
        let displayRole = video.role_type;
        if (video.role_type === 'Leader') displayRole = lang.leader;
        else if (video.role_type === 'Follower') displayRole = lang.follower;
        else if (video.role_type === 'Both') displayRole = lang.both;

        const displayLocation = video.is_downloaded ? lang.drive : lang.social;

        // Etiketleri yerleştirme
        let tagsHtml = '';
        if (video.tags) {
            tagsHtml = video.tags.split(',')
                .map(t => t.trim())
                .filter(t => t !== '')
                .map(t => `<span class="card-tag-item">#${t}</span>`)
                .join(' ');
        }

        const hasCover = video.cover_url && video.cover_url.trim() !== '';
        const coverHtml = hasCover 
            ? `<img src="${video.cover_url}" class="card-cover-img" alt="Cover">`
            : `<div class="card-no-cover">🎬 No Cover Image</div>`;

        card.innerHTML = `
            <div class="card-media-wrapper ${hasCover ? '' : 'clickable-trigger'}">
                ${coverHtml}
                <button class="fav-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            <div class="card-info-content">
                <h3 class="card-instructor-title">${instructorName}${partnerText}</h3>
                <div class="card-meta-details">
                    <p><strong>${lang.role}:</strong> ${displayRole}</p>
                    <p><strong>${lang.location}:</strong> ${displayLocation}</p>
                </div>
                <div class="card-tags-wrapper">
                    ${tagsHtml}
                    <button class="inline-edit-tags-btn" data-id="${video.id}" title="${lang.editTagsTitle}">✏️</button>
                </div>
                <div class="card-action-row">
                    <a href="#" class="video-watch-link clickable-trigger">${lang.watch}</a>
                    <div class="card-admin-buttons">
                        <button class="btn-card-edit" data-id="${video.id}" title="${lang.btnCardEdit}">✏️</button>
                        <button class="btn-card-delete" data-id="${video.id}" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        // Favori Yıldız Butonu Tetikleyicisi
        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleToggleFavorite(video.id);
        });

        // Etiket Düzenleme Butonu Tetikleyicisi
        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openTagsEditModal(video.id, video.tags || '');
        });

        // Kart Düzenleme Butonu Tetikleyicisi
        card.querySelector('.btn-card-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            handleEditVideo(video);
        });

        // Kart Silme Butonu Tetikleyicisi
        card.querySelector('.btn-card-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteVideo(video.id);
        });

        // Videoyu İzleme Pop-up Tetikleyicileri
        const hasDrive = video.drive_url && video.drive_url.trim() !== '';
        const isYouTube = (!hasDrive && video.url && (video.url.includes('youtube.com') || video.url.includes('youtu.be')));
        
        const triggers = card.querySelectorAll('.clickable-trigger');
        if (triggers.length > 0) {
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