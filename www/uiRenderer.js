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

export function renderVideoCards(videos, config) {
    const { currentLang, currentView, translations, favs, toggleFavorite, openTagsEditModal, startVideoEditFlow, deleteVideoFlow, openVideoModal } = config;
    const videoGrid = document.getElementById('video-grid');
    const lang = translations[currentLang];
    videoGrid.innerHTML = '';

    if (videos.length === 0) {
        videoGrid.innerHTML = `<div class="info-msg">${currentView === 'favorites' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    videos.forEach(video => {
        if (currentView === 'favorites' && !favs.includes(video.id)) return;

        const isFav = favs.includes(video.id);
        const card = document.createElement('div');
        card.className = 'video-card';

        const hasDrive = !!video.drive_url;
        const isYouTube = video.url?.includes('youtube.com') || video.url?.includes('youtu.be');

        let tagsHtml = '';
        if (video.tags) {
            video.tags.split(',').forEach(t => {
                const temiz = t.trim();
                if (temiz) tagsHtml += `<span class="tag-chip">#${temiz}</span>`;
            });
        }

        let roleDisplay = lang.couple;
        if (video.role_type === 'Leader') roleDisplay = lang.leader;
        if (video.role_type === 'Follower') roleDisplay = lang.follower;

        card.innerHTML = `
            <div class="card-banner">
                <img src="${video.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500'}" class="card-img" alt="Cover">
                <button class="fav-star-btn ${isFav ? 'active' : ''}" data-id="${video.id}">★</button>
                <span class="badge badge-location">${hasDrive ? lang.drive : lang.social}</span>
            </div>
            <div class="card-body">
                <h3 class="instructor-title">${video.instructor_name || 'Bilinmeyen Eğitmen'}</h3>
                ${video.partner_name ? `<p class="partner-text"><b>Partner:</b> ${video.partner_name}</p>` : ''}
                <p class="role-text"><b>${lang.role}:</b> ${roleDisplay}</p>
                <div class="card-tags-wrapper">${tagsHtml}</div>
                <div class="card-actions-row">
                    <a href="#" class="video-watch-link watch-btn" data-id="${video.id}">${lang.watch}</a>
                    <div class="admin-buttons">
                        <button class="inline-edit-tags-btn" data-id="${video.id}">🏷️</button>
                        <button class="btn-card-edit" data-id="${video.id}">✏️</button>
                        <button class="btn-card-delete" data-id="${video.id}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        card.querySelector('.fav-star-btn').addEventListener('click', () => toggleFavorite(video.id));
        card.querySelector('.btn-card-edit').addEventListener('click', () => startVideoEditFlow(video));
        card.querySelector('.btn-card-delete').addEventListener('click', () => deleteVideoFlow(video.id));
        card.querySelector('.inline-edit-tags-btn').addEventListener('click', () => openTagsEditModal(video.id, video.tags || ''));

        const watchTriggers = card.querySelectorAll('.watch-btn, .card-banner');
        watchTriggers.forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('fav-star-btn')) return;
                e.preventDefault();
                let targetUrl = hasDrive ? video.drive_url : video.url;
                if (isYouTube) {
                    targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                }
                openVideoModal(targetUrl);
            });
        });

        videoGrid.appendChild(card);
    });
}

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