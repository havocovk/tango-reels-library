// tags.js
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Global videolar referansını taşımak için yardımcı fonksiyon
let getGlobalVideosRef = () => [];
export function setGlobalVideosTagsRef(fn) {
    getGlobalVideosRef = fn;
}

export function getAllUniqueTagsPool() {
    let pool = new Set();
    const globalVideos = getGlobalVideosRef();
    globalVideos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean) pool.add(clean);
            });
        }
    });
    return Array.from(pool);
}

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

export function setupAutocomplete(inputId, listId, chipsArray, renderChipsFn, onAddCallback) {
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

export async function saveTagsToSupabaseDirectly(activeEditTagsVideoId, modalTagsArray, onSuccess) {
    if (!activeEditTagsVideoId) return;
    const cleanTags = modalTagsArray.filter(t => t !== '').join(', ');
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?id=eq.${activeEditTagsVideoId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tags: cleanTags || null })
        });

        if (response.ok && onSuccess) {
            onSuccess(cleanTags);
        }
    } catch (err) {
        console.error("Etiket anlık güncellenemedi:", err);
    }
}