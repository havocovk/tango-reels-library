// tagManager.js
// ✅ GÜNCELLEME (Adım 3.3): Renk sistemi + ikon butonlar yan yana
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, showModernPrompt } from './utils.js';
import { store } from './store.js';
import { getTagColor } from './tagColorManager.js';

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
    const videos = store.get('globalVideos');
    let changed = false;
    const newVideos = videos.map(video => {
        const newVideo = updateFunction(video);
        if (newVideo !== video) changed = true;
        return newVideo;
    });
    if (changed) store.set('globalVideos', newVideos);
}

function renameTagLocally(oldTag, newTag) {
    updateAllVideosTagsLocally(video => {
        if (!video.tags) return video;
        const tags = video.tags.split(',').map(t => t.trim()).filter(Boolean);
        if (!tags.includes(oldTag)) return video;
        return { ...video, tags: tags.map(t => t === oldTag ? newTag : t).join(', ') };
    });
}

function mergeTagsLocally(tagsArray, targetTag) {
    tagsArray.forEach(tag => renameTagLocally(tag, targetTag));
}

function deleteTagsLocally(tagsArray) {
    updateAllVideosTagsLocally(video => {
        if (!video.tags) return video;
        let tags = video.tags.split(',').map(t => t.trim()).filter(Boolean);
        const before = tags.length;
        tagsArray.forEach(tag => { tags = tags.filter(t => t !== tag); });
        if (tags.length === before) return video;
        return { ...video, tags: tags.join(', ') };
    });
}

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

export function renderTagManagerUI() {
    const tbody = document.getElementById('tag-manager-tbody');
    if (!tbody) return;

    const videos = store.get('globalVideos');
    const tagMap = new Map();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });

    tbody.innerHTML = '';

    Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([tag, count]) => {
            const color = getTagColor(tag);

            const row = tbody.insertRow();

            // Checkbox
            const cbCell = row.insertCell(0);
            cbCell.style.cssText = 'width:36px; text-align:center;';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'tag-checkbox';
            cb.dataset.tag = tag;
            cb.addEventListener('change', updateTagManagerSelection);
            cbCell.appendChild(cb);

            // Etiket
            const tagCell = row.insertCell(1);
            const badge = document.createElement('span');
            badge.style.cssText = `
                display:inline-block;
                background:${color ? color + '22' : 'rgba(255,255,255,0.05)'};
                color:${color || '#cbd5e1'};
                border:1px solid ${color ? color + '66' : 'rgba(255,255,255,0.1)'};
                font-size:0.78rem; padding:2px 8px; border-radius:8px; font-weight:600;
            `;
            badge.textContent = '#' + tag;
            tagCell.appendChild(badge);

            // Kullanım sayısı
            const countCell = row.insertCell(2);
            countCell.textContent = count;
            countCell.style.cssText = 'text-align:center; width:80px; font-size:0.85rem; color:#94a3b8;';

            // İşlemler — YAN YANA (display:flex)
            const actionCell = row.insertCell(3);
            actionCell.style.cssText = 'width:70px; text-align:center;';

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; gap:4px; justify-content:center; align-items:center;';

            const renameBtn = document.createElement('button');
            renameBtn.textContent = '✏️';
            renameBtn.className = 'tag-action-btn';
            renameBtn.title = currentLang === 'tr' ? 'Yeniden Adlandır' : 'Rename';
            renameBtn.style.cssText = 'padding:3px 6px; margin:0;';
            renameBtn.onclick = () => promptRenameTagModern(tag);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.className = 'tag-action-btn tag-danger-btn';
            deleteBtn.title = currentLang === 'tr' ? 'Sil' : 'Delete';
            deleteBtn.style.cssText = 'padding:3px 6px; margin:0;';
            deleteBtn.onclick = () => deleteSingleTag(tag);

            wrapper.appendChild(renameBtn);
            wrapper.appendChild(deleteBtn);
            actionCell.appendChild(wrapper);
        });

    // Tümünü seç checkbox
    const selectAll = document.getElementById('tag-select-all');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onclick = () => {
            document.querySelectorAll('#tag-manager-tbody .tag-checkbox')
                .forEach(cb => { cb.checked = selectAll.checked; });
            updateTagManagerSelection();
        };
    }
    updateTagManagerSelection();
}

export async function mergeSelectedTags() {
    if (selectedTagsForMerge.length < 2) return;
    const lang = store.get('currentLang');
    const mergeInput = document.getElementById('tag-merge-new-name');
    const targetName = mergeInput?.value.trim();
    if (!targetName) {
        await showCustomAlert(
            lang === 'tr' ? 'Birleştirilecek yeni etiketi yazın.' : 'Please enter the new tag name.',
            lang === 'tr' ? 'Tamam' : 'OK'
        );
        return;
    }

    const tagsToMerge = [...selectedTagsForMerge]; // Sayıyı şimdi al, döngüde kaybolmasın
    const mergeCount = tagsToMerge.length;

    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `${mergeCount} etiket "${targetName}" çatısı altında birleştirilsin mi?`
            : `Merge ${mergeCount} tags into "${targetName}"?`,
        lang === 'tr' ? 'Evet' : 'Yes',
        lang === 'tr' ? 'Hayır' : 'No'
    );
    if (!ok) return;

    try {
        showLoading(true);
        for (const tag of tagsToMerge) {
            await dbMergeTags(tag, targetName);
        }
        renameTagLocally(tagsToMerge[0], targetName);
        tagsToMerge.slice(1).forEach(tag => deleteTagsLocally([tag]));
        showLoading(false);
        await showCustomAlert(
            lang === 'tr'
                ? `${mergeCount} etiket birleştirildi → ${targetName}`
                : `${mergeCount} tags merged → ${targetName}`,
            lang === 'tr' ? 'Tamam' : 'OK'
        );
        if (mergeInput) mergeInput.value = '';
        renderTagManagerUICallback?.();
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}

export async function deleteSelectedTags() {
    if (selectedTagsForMerge.length === 0) return;
    const lang = store.get('currentLang');
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `${selectedTagsForMerge.length} etiketi tüm videolardan silmek istediğinize emin misiniz?`
            : `Delete ${selectedTagsForMerge.length} selected tags from all videos?`,
        lang === 'tr' ? 'Sil' : 'Delete',
        lang === 'tr' ? 'İptal' : 'Cancel'
    );
    if (!ok) return;
    showLoading(true);
    try {
        for (const tag of selectedTagsForMerge) {
            await dbDeleteTagFromAllVideos(tag);
        }
        deleteTagsLocally(selectedTagsForMerge);
        showLoading(false);
        renderTagManagerUICallback?.();
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
    showLoading(true);
    try {
        await dbCleanupUnusedTags();
        await fetchVideosCallback?.();
        renderTagManagerUICallback?.();
        showLoading(false);
    } catch (err) {
        showLoading(false);
        console.error(err);
    }
}