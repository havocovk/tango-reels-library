// ui/chips.js - Etiket kutucuklarını (chip) render etme
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