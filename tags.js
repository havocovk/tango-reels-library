// tags.js
import { AppState } from './state.js';
import { updateSmartFilenameAssistant } from './utils.js';
import { renderFormChips } from './handlers.js';
import { renderModalChips, saveModalTagsToDatabase } from './modals.js';

export function getAllUniqueTags() {
    const allTags = [];
    AppState.globalVideos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const clean = t.trim();
                if (clean && !allTags.includes(clean)) allTags.push(clean);
            });
        }
    });
    return allTags;
}

export function setupAutocompleteSystems() {
    const input = document.getElementById('form-tags-input');
    const list = document.getElementById('autocomplete-list');
    
    if (input && list) {
        input.addEventListener('input', () => {
            const val = input.value.trim().toLowerCase();
            list.innerHTML = '';
            if (!val) { list.classList.add('d-none'); return; }
            const matches = getAllUniqueTags().filter(t => t.toLowerCase().includes(val) && !AppState.formTagsArray.includes(t));
            if (matches.length === 0) { list.classList.add('d-none'); return; }
            list.classList.remove('d-none');
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion-item';
                div.innerText = match;
                div.addEventListener('click', () => {
                    if (!AppState.formTagsArray.includes(match)) {
                        AppState.formTagsArray.push(match);
                        renderFormChips();
                        updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray);
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
                if (val && !AppState.formTagsArray.includes(val)) {
                    AppState.formTagsArray.push(val);
                    renderFormChips();
                    updateSmartFilenameAssistant(AppState.currentLang, AppState.formTagsArray);
                }
                input.value = '';
                list.classList.add('d-none');
            }
        });
    }

    // Modal İçi Otomatik Tamamlama
    const mInput = document.getElementById('modal-tags-input');
    const mList = document.getElementById('modal-autocomplete-list');
    if (mInput && mList) {
        mInput.addEventListener('input', () => {
            const val = mInput.value.trim().toLowerCase();
            mList.innerHTML = '';
            if (!val) { mList.classList.add('d-none'); return; }
            const matches = getAllUniqueTags().filter(t => t.toLowerCase().includes(val) && !AppState.modalTagsArray.includes(t));
            if (matches.length === 0) { mList.classList.add('d-none'); return; }
            mList.classList.remove('d-none');
            matches.forEach(match => {
                const div = document.createElement('div');
                div.className = 'autocomplete-suggestion-item';
                div.innerText = match;
                div.addEventListener('click', async () => {
                    if (!AppState.modalTagsArray.includes(match)) {
                        AppState.modalTagsArray.push(match);
                        renderModalChips();
                        await saveModalTagsToDatabase();
                    }
                    mInput.value = '';
                    mList.classList.add('d-none');
                });
                mList.appendChild(div);
            });
        });

        mInput.addEventListener('keydown', async (e) => {
            if (e.key === ',' || e.key === 'Enter') {
                e.preventDefault();
                const val = mInput.value.replace(',', '').trim();
                if (val && !AppState.modalTagsArray.includes(val)) {
                    AppState.modalTagsArray.push(val);
                    renderModalChips();
                    await saveModalTagsToDatabase();
                }
                mInput.value = '';
                mList.classList.add('d-none');
            }
        });
    }
}