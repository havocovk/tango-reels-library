// ui/autocomplete.js - Otomatik tamamlama (autocomplete) input
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