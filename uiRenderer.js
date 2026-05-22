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
        const filtered = pool.filter(t => t.toLowerCase().includes(val) && !chipsArray.includes(t));
        
        if (filtered.length === 0) {
            list.classList.add('d-none');
            return;
        }
        
        list.classList.remove('d-none');
        filtered.forEach(tag => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.innerText = `#${tag}`;
            item.addEventListener('click', () => {
                chipsArray.push(tag);
                renderChipsFn();
                if (onAddCallback) onAddCallback();
                input.value = '';
                list.classList.add('d-none');
            });
            list.appendChild(item);
        });
    });

    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
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
                    chipsArray.push(val);
                    renderChipsFn();
                    if (onAddCallback) onAddCallback();
                    input.value = '';
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

// 3. 🎥 VİDEO KARTLARINI EKRANA BASAN SÜPER FONKSİYON (app.js ile %100 UYUMLU)
export function renderVideoCards(videos, config = {}) {
    // app.js'in aradığı video-grid alanını seçiyoruz
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;
    
    videoGrid.innerHTML = '';

    // app.js'den gelen ayarları (config objesini) parçalara ayırıp alıyoruz
    const {
        currentLang = 'tr',
        translations = {},
        favs = [],
        toggleFavorite,
        openTagsEditModal,
        startVideoEditFlow,
        deleteVideoFlow,
        openVideoModal
    } = config;

    const lang = translations[currentLang] || {};

    // Eğer veritabanında hiç video yoksa veya arama sonucu boşsa
    if (!videos || videos.length === 0) {
        videoGrid.innerHTML = `<div class="no-results">${lang.noVideosFound || 'Video bulunamadı.'}</div>`;
        return;
    }

    videos.forEach(video => {
        // Favori kontrolünü app.js'den gelen güncel listeden yapıyoruz
        const isFav = favs.includes(video.id);
        
        // Hem Drive linklerini hem de YouTube (Shorts dahil) linklerini modal sınıfına alıyoruz
        const hasDrive = video.drive_url && (
            video.drive_url.includes('drive.google.com') || 
            video.drive_url.includes('youtube.com') || 
            video.drive_url.includes('youtu.be')
        );

        const card = document.createElement('div');
        card.className = 'video-card-glass';
        
        const coverImg = video.cover_url || 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80';

        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${coverImg}" class="card-preview-img" alt="Tango">
                <button class="fav-star-btn ${isFav ? 'is-fav' : ''}" title="${lang.btnFav || 'Favori'}">
                    ${isFav ? '★' : '☆'}
                </button>
                <div class="card-duration">
                    ${video.duration ? video.duration : '00:00'}
                </div>
            </div>
            <div class="card-body-content">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px;">
                    <h4 class="card-title-text">${video.title || lang.untitledVideo}</h4>
                </div>
                <p class="card-instructor-text">
                    👤 ${video.instructors && video.instructors.name ? video.instructors.name : (video.instructor_name || lang.unknownInstructor)}
                </p>
                
                <div class="card-tags-row">
                    <span class="inline-edit-tags-btn" title="${lang.btnEditTags || 'Etiketleri Düzenle'}">✏️</span>
                    <div class="card-tags-inline-list">
                        ${video.tags ? video.tags.split(',').map(t => `<span class="card-tag-pill">#${t.trim()}</span>`).join('') : `<span class="card-no-tags">${lang.noTags || 'Etiket yok'}</span>`}
                    </div>
                </div>

                <div class="card-footer-actions">
                    <a href="${video.drive_url || '#'}" target="_blank" class="card-btn-primary" ${hasDrive ? 'data-drive' : ''}>
                        ${hasDrive ? (currentLang === 'tr' ? 'İzle →' : lang.watch) : lang.watch}
                    </a>
                    
                    <div style="display:flex; gap:8px;">
                        <button class="card-crud-btn card-edit-btn" title="${lang.btnCardEdit}">✏️</button>
                        <button class="card-crud-btn card-delete-btn" title="${lang.btnCardDelete}">🗑️</button>
                    </div>
                </div>
            </div>
        `;

        // Buton dinleyicilerini güvenli tetikleyicilerle bağlıyoruz
        card.querySelector('.fav-star-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (toggleFavorite) toggleFavorite(video.id);
        });

        card.querySelector('.inline-edit-tags-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (openTagsEditModal) openTagsEditModal(video);
        });

        card.querySelector('.card-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (startVideoEditFlow) startVideoEditFlow(video);
        });

        card.querySelector('.card-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (deleteVideoFlow) deleteVideoFlow(video.id);
        });

        // Link eğer Drive veya YouTube ise, dış sekmeye fırlatmak yerine sitemizdeki gömülü ekranı (modalı) açar
        if (hasDrive) {
            const triggers = card.querySelectorAll('[data-drive]');
            triggers.forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (openVideoModal) openVideoModal(video.drive_url);
                });
            });
        }

        videoGrid.appendChild(card);
    });
}