// tagManager.js - Toplu etiket işlemleri + renk yönetimi
// ✅ GÜNCELLEME (Adım 3.3): Her etiket satırına renk seçici eklendi
// ✅ DÜZELTME: deleteSingleTag ve promptRenameTagModern export'ları eklendi
import { translations } from './i18n.js';
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, showModernPrompt } from './utils.js';
import { store } from './store.js';
import { getTagColor, setTagColor, removeTagColor, getColorPalette } from './tagColorManager.js';

let currentLang = 'tr';
let globalVideos = [];
let fetchVideosCallback = null;
let renderTagManagerUICallback = null;
let selectedTagsForMerge = [];

export function initTagManager(lang, videos, fetchVideosFn, renderUIFn) {
    currentLang = lang;
    globalVideos = videos;
    fetchVideosCallback = fetchVideosFn;
    renderTagManagerUICallback = renderUIFn;
}

export function updateTagManagerSelection() {
    const checked = Array.from(
        document.querySelectorAll('#tag-manager-tbody .tag-checkbox:checked')
    ).map(cb => cb.dataset.tag);
    selectedTagsForMerge = checked;
    const mergeBtn = document.getElementById('tag-manager-merge-btn');
    const deleteBtn = document.getElementById('tag-manager-delete-btn');
    if (mergeBtn) mergeBtn.disabled = checked.length < 2;
    if (deleteBtn) deleteBtn.disabled = checked.length === 0;
    const mergePanel = document.getElementById('tag-merge-panel');
    if (mergePanel) {
        if (checked.length >= 2) mergePanel.classList.remove('d-none');
        else mergePanel.classList.add('d-none');
    }
}

function updateAllVideosTagsLocally(updateFunction) {
    let videos = store.get('globalVideos');
    let changed = false;
    const newVideos = videos.map(video => {
        const newVideo = updateFunction(video);
        if (newVideo !== video) changed = true;
        return newVideo;
    });
    if (changed) store.set('globalVideos', newVideos);
    return changed;
}

function renameTagLocally(oldTag, newTag) {
    updateAllVideosTagsLocally(video => {
        if (!video.tags) return video;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        if (tags.includes(oldTag)) {
            const newTags = tags.map(t => t === oldTag ? newTag : t);
            return { ...video, tags: newTags.join(', ') };
        }
        return video;
    });
}

function deleteTagsLocally(tagsArray) {
    updateAllVideosTagsLocally(video => {
        if (!video.tags) return video;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        let changed = false;
        tagsArray.forEach(tag => {
            if (tags.includes(tag)) { tags = tags.filter(t => t !== tag); changed = true; }
        });
        if (changed) return { ...video, tags: tags.length ? tags.join(', ') : '' };
        return video;
    });
}

// ─────────────────────────────────────────────────────────────
// promptRenameTagModern  ✅ export edildi (dataManager.js uyumluluğu için)
// ─────────────────────────────────────────────────────────────
export async function promptRenameTagModern(tag) {
    const lang = store.get('currentLang');
    const newName = await showModernPrompt(
        lang === 'tr' ? `"${tag}" etiketini yeniden adlandır:` : `Rename tag "${tag}":`,
        tag
    );
    if (!newName || newName.trim() === tag) return;
    try {
        showLoading(true);
        await dbRenameTag(tag, newName.trim());
        renameTagLocally(tag, newName.trim());
        renderTagManagerUICallback?.();
        showLoading(false);
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// deleteSingleTag  ✅ export edildi (dataManager.js uyumluluğu için)
// ─────────────────────────────────────────────────────────────
export async function deleteSingleTag(tag) {
    const lang = store.get('currentLang');
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `"${tag}" etiketini TÜM videolardan silmek istediğinize emin misiniz?`
            : `Are you sure you want to delete "${tag}" from ALL videos?`,
        lang === 'tr' ? 'Evet' : 'Yes',
        lang === 'tr' ? 'Hayır' : 'No'
    );
    if (!ok) return;
    showLoading(true);
    try {
        await dbDeleteTagFromAllVideos([tag]);
        deleteTagsLocally([tag]);
        showLoading(false);
        await showCustomAlert(
            lang === 'tr' ? `"${tag}" etiketi kaldırıldı.` : `"${tag}" removed.`,
            lang === 'tr' ? 'Tamam' : 'OK'
        );
        renderTagManagerUICallback?.();
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// renderTagManagerUI  ✅ GÜNCELLEME (Adım 3.3) — renk seçici eklendi
// ─────────────────────────────────────────────────────────────
export function renderTagManagerUI() {
    const tbody = document.getElementById('tag-manager-tbody');
    if (!tbody) return;

    const videos = store.get('globalVideos');
    const palette = getColorPalette();

    const tagMap = new Map();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });

    const sortedTags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);
    tbody.innerHTML = '';

    sortedTags.forEach(([tag, count]) => {
        const currentColor = getTagColor(tag);

        const paletteHtml = palette.map(p => `
            <button
                class="tm-color-dot ${currentColor === p.color ? 'tm-color-dot-active' : ''}"
                data-color="${p.color}"
                title="${p.label}"
                style="background:${p.color}; border: 2px solid ${currentColor === p.color ? '#fff' : 'transparent'};"
            ></button>
        `).join('');

        const clearBtn = currentColor
            ? `<button class="tm-color-clear tag-action-btn tag-danger-btn" data-tag="${tag}" title="${currentLang === 'tr' ? 'Rengi kaldır' : 'Remove color'}" style="font-size:0.65rem;padding:2px 6px;">✕</button>`
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="tag-checkbox" data-tag="${tag}"></td>
            <td>
                <span class="tm-tag-preview" style="
                    display:inline-block;
                    background: ${currentColor ? currentColor + '22' : 'rgba(255,255,255,0.05)'};
                    color: ${currentColor || '#cbd5e1'};
                    border: 1px solid ${currentColor ? currentColor + '66' : 'rgba(255,255,255,0.1)'};
                    font-size:0.78rem; padding:2px 8px; border-radius:8px;
                ">#${tag}</span>
            </td>
            <td style="text-align:center;">${count}</td>
            <td>
                <div class="tm-color-picker" data-tag="${tag}" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
                    ${paletteHtml}
                    ${clearBtn}
                </div>
            </td>
            <td>
                <button class="tag-action-btn tag-rename-btn" data-tag="${tag}">✏️ ${currentLang === 'tr' ? 'Yeniden Adlandır' : 'Rename'}</button>
                <button class="tag-action-btn tag-danger-btn tag-delete-btn" data-tag="${tag}">🗑️ ${currentLang === 'tr' ? 'Sil' : 'Delete'}</button>
            </td>`;

        // Renk dot tıklama
        tr.querySelectorAll('.tm-color-dot').forEach(dot => {
            dot.addEventListener('click', async () => {
                try {
                    await setTagColor(tag, dot.dataset.color);
                    renderTagManagerUI();
                } catch (err) { console.error('Renk kaydedilemedi:', err); }
            });
        });

        // Renk sıfırlama
        const clearBtnEl = tr.querySelector('.tm-color-clear');
        if (clearBtnEl) {
            clearBtnEl.addEventListener('click', async () => {
                try {
                    await removeTagColor(tag);
                    renderTagManagerUI();
                } catch (err) { console.error('Renk silinemedi:', err); }
            });
        }

        // Checkbox
        tr.querySelector('.tag-checkbox').addEventListener('change', updateTagManagerSelection);

        // Yeniden adlandır
        tr.querySelector('.tag-rename-btn').addEventListener('click', () => promptRenameTagModern(tag));

        // Sil
        tr.querySelector('.tag-delete-btn').addEventListener('click', () => deleteSingleTag(tag));

        tbody.appendChild(tr);
    });
}

export async function mergeSelectedTags() {
    if (selectedTagsForMerge.length < 2) return;
    const lang = store.get('currentLang');
    const mergeInput = document.getElementById('tag-merge-input');
    const targetName = mergeInput?.value.trim();
    if (!targetName) {
        await showCustomAlert(
            lang === 'tr' ? 'Birleştirilecek yeni etiketi yazın.' : 'Please enter the new tag name.',
            lang === 'tr' ? 'Tamam' : 'OK'
        );
        return;
    }
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `"${selectedTagsForMerge.join('", "')}" etiketlerini "${targetName}" ile birleştirmek istediğinize emin misiniz?`
            : `Merge "${selectedTagsForMerge.join('", "')}" into "${targetName}"?`,
        lang === 'tr' ? 'Birleştir' : 'Merge',
        lang === 'tr' ? 'İptal' : 'Cancel'
    );
    if (!ok) return;
    try {
        showLoading(true);
        for (const tag of selectedTagsForMerge) {
            await dbMergeTags(tag, targetName);
        }
        selectedTagsForMerge.forEach(tag => renameTagLocally(tag, targetName));
        await fetchVideosCallback?.();
        renderTagManagerUICallback?.();
        showLoading(false);
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}

export async function deleteSelectedTags() {
    if (selectedTagsForMerge.length === 0) return;
    const lang = store.get('currentLang');
    const deleteCount = selectedTagsForMerge.length;
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `${deleteCount} etiketi tüm videolardan silmek istediğinize emin misiniz?`
            : `Delete ${deleteCount} selected tags from all videos?`,
        lang === 'tr' ? 'Sil' : 'Delete',
        lang === 'tr' ? 'İptal' : 'Cancel'
    );
    if (!ok) return;
    try {
        showLoading(true);
        for (const tag of selectedTagsForMerge) {
            await dbDeleteTagFromAllVideos(tag);
        }
        deleteTagsLocally(selectedTagsForMerge);
        renderTagManagerUICallback?.();
        showLoading(false);
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}

export async function cleanupUnusedTags() {
    const lang = store.get('currentLang');
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? 'Hiçbir videoda kullanılmayan etiketler temizlensin mi?'
            : 'Remove all tags that are not used in any video?',
        lang === 'tr' ? 'Temizle' : 'Clean',
        lang === 'tr' ? 'İptal' : 'Cancel'
    );
    if (!ok) return;
    try {
        showLoading(true);
        await dbCleanupUnusedTags();
        await fetchVideosCallback?.();
        renderTagManagerUICallback?.();
        showLoading(false);
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}