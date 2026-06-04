// tagManager.js - Toplu etiket işlemleri
// ✅ GÜNCELLEME (Adım 3.3): Etiket Sağlık Kontrolü butonu eklendi
import { translations } from './i18n.js';
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, showModernPrompt } from './utils.js';
import { store } from './store.js';
import { dbRunTagSyncCheck, dbRepairTagSync } from './db/healthCheck.js';
import { showToast } from './toast.js';

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
    const checked = Array.from(document.querySelectorAll('#tag-manager-tbody .tag-checkbox:checked')).map(cb => cb.dataset.tag);
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

function mergeTagsLocally(tagsToMerge, targetTag) {
    updateAllVideosTagsLocally(video => {
        if (!video.tags) return video;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        let changed = false;
        const newTags = tags.map(t => {
            if (tagsToMerge.includes(t) && t !== targetTag) { changed = true; return targetTag; }
            return t;
        });
        const unique = [...new Set(newTags)];
        if (changed) return { ...video, tags: unique.join(', ') };
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
        if (changed) return { ...video, tags: tags.length ? tags.join(', ') : null };
        return video;
    });
}

function getTagColor(tag) {
    const tagColors = store.get('tagColors') || {};
    return tagColors[tag] || null;
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

// ─────────────────────────────────────────────────────────────
// ✅ YENİ (Adım 3.3): Etiket Sağlık Kontrolü
// ─────────────────────────────────────────────────────────────
export async function runTagHealthCheck() {
    const lang = store.get('currentLang');
    const okText = lang === 'tr' ? 'Tamam' : 'OK';

    showLoading(true);
    try {
        const problems = await dbRunTagSyncCheck();
        showLoading(false);

        if (!problems || problems.length === 0) {
            showToast(
                lang === 'tr' ? '✅ Tüm etiketler senkron' : '✅ All tags are in sync',
                'success', 3000
            );
            return;
        }

        // Sorun var — kalıcı modal ile göster
        const problemList = problems.slice(0, 10).map(p =>
            `• ${p.video_url || 'ID:' + p.video_id}\n  videos.tags: "${p.tags_text || ''}"\n  video_tags: "${p.normalized_tags || ''}"`
        ).join('\n\n');

        const more = problems.length > 10 ? `\n\n...ve ${problems.length - 10} tane daha` : '';

        const msg = lang === 'tr'
            ? `⚠️ ${problems.length} videoda etiket senkron bozukluğu tespit edildi:\n\n${problemList}${more}\n\nOtomatik onar?`
            : `⚠️ ${problems.length} video(s) have tag sync issues:\n\n${problemList}${more}\n\nAuto-repair?`;

        const repair = await showCustomConfirm(
            msg,
            lang === 'tr' ? '🔧 Onar' : '🔧 Repair',
            lang === 'tr' ? 'İptal' : 'Cancel'
        );

        if (!repair) return;

        // Otomatik onar
        showLoading(true);
        let fixed = 0;
        let failed = 0;
        for (const p of problems) {
            try {
                await dbRepairTagSync(p.video_id);
                fixed++;
            } catch (err) {
                console.warn(`Video ${p.video_id} onarılamadı:`, err.message);
                failed++;
            }
        }
        showLoading(false);

        const resultMsg = lang === 'tr'
            ? `✅ ${fixed} video onarıldı${failed > 0 ? `, ${failed} video onarılamadı` : ''}`
            : `✅ ${fixed} video(s) repaired${failed > 0 ? `, ${failed} failed` : ''}`;

        await showCustomAlert(resultMsg, okText, true);

        // Veriyi yenile
        if (fetchVideosCallback) await fetchVideosCallback();
        renderTagManagerUICallback?.();

    } catch (err) {
        showLoading(false);
        console.error('Sağlık kontrolü hatası:', err);
        await showCustomAlert(
            lang === 'tr' ? `Hata: ${err.message}` : `Error: ${err.message}`,
            okText, true
        );
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

            // İşlemler
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

    // ✅ YENİ (Adım 3.3): Sağlık Kontrolü butonu — varsa yeniden bağla
    _attachHealthCheckButton();
}

// ─────────────────────────────────────────────────────────────
// Yardımcı: Sağlık Kontrolü butonunu bul ve bağla
// ─────────────────────────────────────────────────────────────
function _attachHealthCheckButton() {
    const btn = document.getElementById('tag-manager-health-btn');
    if (!btn) return;
    // Önceki listener'ı temizle
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', runTagHealthCheck);
}

export async function deleteSelectedTags() {
    if (selectedTagsForMerge.length === 0) return;
    const lang = store.get('currentLang');
    const alertOk = lang === 'tr' ? 'Tamam' : 'OK';
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `${selectedTagsForMerge.length} etiketi tüm videolardan silmek istediğinize emin misiniz?`
            : `Delete ${selectedTagsForMerge.length} selected tags from all videos?`,
        lang === 'tr' ? 'Sil' : 'Delete',
        lang === 'tr' ? 'İptal' : 'Cancel'
    );
    if (!ok) return;
    showLoading(true);
    const deleteCount = selectedTagsForMerge.length;
    try {
        for (const tag of selectedTagsForMerge) {
            await dbDeleteTagFromAllVideos(tag);
        }
        deleteTagsLocally(selectedTagsForMerge);
        showLoading(false);
        await showCustomAlert(
            lang === 'tr' ? `${deleteCount} etiket silindi.` : `${deleteCount} tag(s) deleted.`,
            alertOk
        );
        selectedTagsForMerge = [];
        renderTagManagerUICallback?.();
    } catch (err) {
        showLoading(false);
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                lang === 'tr'
                    ? 'Çakışma: Bazı videolar başka bir kullanıcı tarafından değiştirildi. Sayfayı yenileyin.'
                    : 'Conflict: Some videos were modified by another user. Please refresh.',
                alertOk
            );
            location.reload();
        } else {
            await showCustomAlert(`Hata: ${err.message}`, alertOk);
        }
    }
}

export async function mergeSelectedTags() {
    if (selectedTagsForMerge.length < 2) return;
    const lang = store.get('currentLang');
    const mergeInput = document.getElementById('tag-merge-new-name');
    const targetName = mergeInput?.value.trim();
    const alertOk = lang === 'tr' ? 'Tamam' : 'OK';

    if (!targetName) {
        await showCustomAlert(
            lang === 'tr' ? 'Lütfen yeni etiket adını girin.' : 'Please enter the new tag name.',
            alertOk
        );
        return;
    }

    const tagsToMerge = [...selectedTagsForMerge];
    const mergeCount = tagsToMerge.length;
    const ok = await showCustomConfirm(
        lang === 'tr'
            ? `${mergeCount} etiket "${targetName}" çatısı altında birleştirilsin mi?`
            : `Merge ${mergeCount} tags into "${targetName}"?`,
        lang === 'tr' ? 'Evet' : 'Yes',
        lang === 'tr' ? 'Hayır' : 'No'
    );
    if (!ok) return;

    showLoading(true);
    try {
        await dbMergeTags(tagsToMerge, targetName);
        mergeTagsLocally(tagsToMerge, targetName);
        showLoading(false);
        await showCustomAlert(
            lang === 'tr'
                ? `${mergeCount} etiket birleştirildi → ${targetName}`
                : `${mergeCount} tags merged → ${targetName}`,
            alertOk
        );
        if (mergeInput) mergeInput.value = '';
        selectedTagsForMerge = [];
        renderTagManagerUICallback?.();
    } catch (err) {
        showLoading(false);
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                lang === 'tr'
                    ? 'Çakışma: Bazı videolar başka bir kullanıcı tarafından değiştirildi. Sayfayı yenileyin.'
                    : 'Conflict: Some videos were modified by another user. Please refresh.',
                alertOk
            );
            location.reload();
        } else {
            await showCustomAlert(`Hata: ${err.message}`, alertOk);
        }
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