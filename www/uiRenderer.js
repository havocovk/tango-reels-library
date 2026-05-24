// uiRenderer.js
import { translations } from './config.js';

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
        const filtered = pool.filter(item => item.toLowerCase().includes(val) && !chipsArray.includes(item));

        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }

        list.classList.remove('d-none');
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion-item';
            div.innerText = `#${item}`;
            div.addEventListener('click', () => {
                onAddCallback(item);
                input.value = '';
                list.innerHTML = '';
                list.classList.add('d-none');
                input.focus();
            });
            list.appendChild(div);
        });
    });

    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-suggestion-item');
        if (e.keyCode === 40) { // Aşağı Ok
            currentFocus++;
            addActive(items);
        } else if (e.keyCode === 38) { // Yukarı Ok
            currentFocus--;
            addActive(items);
        } else if (e.keyCode === 13) { // Enter
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
        if (!items || items.length === 0) return;
        removeActive(items);
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('autocomplete-active');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }

    function removeActive(items) {
        items.forEach(item => item.classList.remove('autocomplete-active'));
    }

    document.addEventListener('click', (e) => {
        if (e.target !== input && e.target !== list) {
            list.innerHTML = '';
            list.classList.add('d-none');
        }
    });
}

// 3. VİDEO KARTLARINI EKRANA BASAN ANA MOTOR
export function renderVideoCards(containerId, videos, favorites, currentLang = 'tr') {
    const videoGrid = document.getElementById(containerId);
    if (!videoGrid) return;
    videoGrid.innerHTML = '';

    const lang = translations[currentLang];

    if (videos.length === 0) {
        videoGrid.innerHTML = `<div class="empty-message" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8; font-size: 1.1rem; line-height: 1.6;">${containerId === 'favorites-grid' ? lang.emptyFav : lang.empty}</div>`;
        return;
    }

    videos.forEach(video => {
        const isFav = favorites.some(fav => fav.video_id === video.id);
        const starIcon = isFav ? '★' : '☆';
        const starClass = isFav ? 'fav-star-btn active' : 'fav-star-btn';

        const card = document.createElement('div');
        card.className = 'video-card';

        const hasDrive = !!video.drive_url;
        const hasUrl = !!video.url;
        const isYouTube = video.url && (video.url.includes('youtube.com') || video.url.includes('youtu.be'));

        // 🎬 Rol Tipi Çevirisi (Lider, Takipçi, Çift / Couple)
        let roleText = lang.both;
        if (video.role_type === 'leader') roleText = lang.leader;
        if (video.role_type === 'follower') roleText = lang.follower;

        // 📍 Ortam / Platform Çevirisi (Google Drive, Sosyal Medya)
        const locationText = video.is_downloaded ? lang.drive : lang.social;

        // Etiketleri Hazırla
        const tagsHTML = video.tags 
            ? video.tags.split(',').map(t => `<span class="card-chip-item">#${t.trim()}</span>`).join(' ')
            : '';

        card.innerHTML = `
            <div class="card-cover-container">
                <img src="${video.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500'}" class="card-cover" alt="Tango">
                <button class="${starClass}" data-id="${video.id}">${starIcon}</button>
            </div>
            <div class="card-content">
                <h3 class="card-instructors">${video.instructor_name}${video.partner_name ? ` & ${video.partner_name}` : ''}</h3>
                <div class="card-info-row">
                    <span><strong>${lang.role}:</strong> ${roleText}</span>
                    <span><strong>${lang.platform}:</strong> ${locationText}</span>
                </div>
                <div class="card-tags-container">${tagsHTML}</div>
                <div class="card-actions">
                    <button class="inline-edit-tags-btn" data-id="${video.id}">✏️ <span style="font-size:0.85rem; margin-left:2px;">${lang.editTagsInline}</span></button>
                    <div class="card-management-btns">
                        <button class="btn-card-edit" data-id="${video.id}">✏️</button>
                        <button class="btn-card-delete" data-id="${video.id}">🗑️</button>
                    </div>
                </div>
                <div class="card-links" style="display:flex; gap:10px; margin-top:10px;">
                    ${hasUrl ? `<a href="${video.url}" class="video-watch-link watch-btn" data-type="url" style="flex:1; text-align:center;">${lang.watch}</a>` : ''}
                    ${hasDrive ? `<a href="${video.drive_url}" class="video-watch-link watch-cloud-btn" data-type="drive" style="flex:1; text-align:center;">${lang.watchCloud}</a>` : ''}
                </div>
            </div>
        `;

        // Video izleme tetikleyicileri
        const watchTriggers = card.querySelectorAll('.video-watch-link');
        watchTriggers.forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                let targetUrl = el.getAttribute('data-type') === 'drive' ? video.drive_url : video.url;
                
                if (el.getAttribute('data-type') === 'url' && isYouTube) {
                    targetUrl = convertYoutubeUrlToEmbed(targetUrl);
                }
                
                if (el.getAttribute('data-type') === 'drive' && targetUrl.includes('drive.google.com') && !targetUrl.includes('/preview')) {
                    const regExp = /\/file\/d\/([^/]+)/;
                    const matches = targetUrl.match(regExp);
                    if (matches && matches[1]) {
                        targetUrl = `https://drive.google.com/file/d/${matches[1]}/preview`;
                    }
                }
                
                // tangoModals içerisindeki openVideoModal fonksiyonunu tetikler
                window.openVideoModal ? window.openVideoModal(targetUrl) : console.log("Modal target:", targetUrl);
            });
        });

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