// tags.js
import { updateSmartFilenameAssistant } from './utils.js';

// Ortak Chips Çizici (Render) Fonksiyonu
export function renderChips(containerId, tagsArray, onDeleteCallback) {
    const area = document.getElementById(containerId);
    if (!area) return;
    area.innerHTML = '';

    tagsArray.forEach((tag, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip-item';
        chip.innerHTML = `${tag} <span class="chip-close-x">&times;</span>`;
        
        chip.querySelector('.chip-close-x').addEventListener('click', () => {
            onDeleteCallback(index);
        });
        area.appendChild(chip);
    });
}

// Benzersiz Tüm Etiketleri Veritabanından Toplama (Autocomplete Önerileri İçin)
export function getAllUniqueTags(globalVideos) {
    const allTags = [];
    globalVideos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean && !allTags.includes(clean)) allTags.push(clean);
            });
        }
    });
    return allTags;
}

// FORM İÇİN ETİKET SİSTEMİNİ KURMA
export function setupAutocomplete(state) {
    const input = document.getElementById('form-tags-input');
    const list = document.getElementById('autocomplete-list');
    if (!input || !list) return;

    input.addEventListener('input', () => {
        const val = input.value.trim().toLowerCase();
        list.innerHTML = '';
        if (!val) { list.classList.add('d-none'); return; }

        const allUnique = getAllUniqueTags(state.globalVideos);
        const matches = allUnique.filter(t => t.toLowerCase().includes(val) && !state.formTagsArray.includes(t));

        if (matches.length === 0) { list.classList.add('d-none'); return; }

        list.classList.remove('d-none');
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'autocomplete-suggestion-item';
            div.innerText = match;
            div.addEventListener('click', () => {
                if (!state.formTagsArray.includes(match)) {
                    state.formTagsArray.push(match);
                    import('./handlers.js').then(h => h.renderFormChips(state));
                    updateSmartFilenameAssistant(state.currentLang, state.formTagsArray);
                }
                input.value = '';
                list.classList.add('d-none');
            });
            list.appendChild(div);
        });
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === ',' || e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.replace(',', '').trim();
            if (val && !state.formTagsArray.includes(val)) {
                state.formTagsArray.push(val);
                import('./handlers.js').then(h => h.renderFormChips(state));
                updateSmartFilenameAssistant(state.currentLang, state.formTagsArray);
            }
            input.value = '';
            list.classList.add('d-none');
        }
    });

    // Boşluğa tıklayınca öneri listesini kapat
    document.addEventListener('click', (e) => {
        if (e.target !== input) list.classList.add('d-none');
    });
}