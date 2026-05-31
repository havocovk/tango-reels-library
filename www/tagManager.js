// tagManager.js - Toplu etiket işlemleri (RPC ile, hata yönetimi düzeltildi)
import { translations } from './i18n.js';
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, showModernPrompt } from './utils.js';
import { store } from './store.js';

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

// Yerel güncelleme fonksiyonları (RPC'den sonra state'i güncellemek için)
function updateAllVideosTagsLocally(updateFunction) {
    let videos = store.get('globalVideos');
    let changed = false;
    const newVideos = videos.map(video => {
        const newVideo = updateFunction(video);
        if (newVideo !== video) changed = true;
        return newVideo;
    });
    if (changed) {
        store.set('globalVideos', newVideos);
    }
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
            if (tags.includes(tag)) {
                tags = tags.filter(t => t !== tag);
                changed = true;
            }
        });
        if (changed) {
            return { ...video, tags: tags.length ? tags.join(', ') : null };
        }
        return video;
    });
}

function mergeTagsLocally(oldTagsArray, newTag) {
    updateAllVideosTagsLocally(video => {
        if (!video.tags) return video;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        let changed = false;
        oldTagsArray.forEach(oldTag => {
            if (tags.includes(oldTag)) {
                tags = tags.filter(t => t !== oldTag);
                if (!tags.includes(newTag)) tags.push(newTag);
                changed = true;
            }
        });
        if (changed) {
            return { ...video, tags: tags.join(', ') };
        }
        return video;
    });
}

function cleanupUnusedTagsLocally() {
    let videos = store.get('globalVideos');
    let removedCount = 0;
    const newVideos = videos.map(video => {
        if (!video.tags) return video;
        let tags = video.tags.split(',').map(t => t.trim()).filter(t => t !== '');
        const uniqueTags = [...new Set(tags)];
        if (uniqueTags.length !== tags.length) {
            removedCount += (tags.length - uniqueTags.length);
            return { ...video, tags: uniqueTags.join(', ') };
        }
        return video;
    });
    if (removedCount > 0) {
        store.set('globalVideos', newVideos);
    }
    return { removedCount };
}

// ============= DÜZELTİLMİŞ FONKSİYONLAR (alertOk tanımlı) =============

export async function promptRenameTagModern(oldTag) {
    const title = currentLang === 'tr' ? `"${oldTag}" etiketini yeni adıyla değiştir:` : `Rename "${oldTag}" to:`;
    const placeholder = currentLang === 'tr' ? 'Yeni etiket adı' : 'New tag name';
    const newTag = await showModernPrompt(title, oldTag, placeholder);
    if (!newTag || newTag === oldTag) return;
    
    showLoading(true);
    try {
        await dbRenameTag(oldTag, newTag);
        renameTagLocally(oldTag, newTag);
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `"${oldTag}" → "${newTag}" olarak değiştirildi.` : `"${oldTag}" → "${newTag}" renamed.`, alertOk);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                currentLang === 'tr' 
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

export async function deleteSingleTag(tag) {
    const okText = currentLang === 'tr' ? 'Evet' : 'Yes';
    const cancelText = currentLang === 'tr' ? 'Hayır' : 'No';
    if (!await showCustomConfirm(currentLang === 'tr' ? `"${tag}" etiketini TÜM videolardan silmek istediğinize emin misiniz?` : `Are you sure you want to delete "${tag}" from ALL videos?`, okText, cancelText)) return;
    showLoading(true);
    try {
        await dbDeleteTagFromAllVideos([tag]);
        deleteTagsLocally([tag]);
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `"${tag}" etiketi kaldırıldı.` : `"${tag}" removed.`, alertOk);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                currentLang === 'tr' 
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

export async function deleteSelectedTags() {
    if (selectedTagsForMerge.length === 0) return;
    const deleteCount = selectedTagsForMerge.length;
    const okText = currentLang === 'tr' ? 'Evet' : 'Yes';
    const cancelText = currentLang === 'tr' ? 'Hayır' : 'No';
    const confirmMsg = currentLang === 'tr' ? `${deleteCount} etiketi tüm videolardan silmek istediğinize emin misiniz?` : `Are you sure you want to delete ${deleteCount} tag(s) from all videos?`;
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;
    showLoading(true);
    try {
        await dbDeleteTagFromAllVideos(selectedTagsForMerge);
        deleteTagsLocally(selectedTagsForMerge);
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `${deleteCount} etiket silindi.` : `${deleteCount} tag(s) deleted.`, alertOk);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                currentLang === 'tr' 
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
    const newTagName = document.getElementById('tag-merge-new-name').value.trim();
    const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
    if (!newTagName) {
        await showCustomAlert(currentLang === 'tr' ? 'Lütfen yeni etiket adını girin.' : 'Please enter the new tag name.', alertOk);
        return;
    }
    const mergeCount = selectedTagsForMerge.length;
    const okText = currentLang === 'tr' ? 'Evet' : 'Yes';
    const cancelText = currentLang === 'tr' ? 'Hayır' : 'No';
    const confirmMsg = currentLang === 'tr' ? `${mergeCount} etiket "${newTagName}" çatısı altında birleştirilsin mi?` : `Merge ${mergeCount} tags into "${newTagName}"?`;
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;
    
    showLoading(true);
    try {
        await dbMergeTags(selectedTagsForMerge, newTagName);
        mergeTagsLocally(selectedTagsForMerge, newTagName);
        showLoading(false);
        await showCustomAlert(currentLang === 'tr' ? `${mergeCount} etiket birleştirildi → ${newTagName}` : `${mergeCount} tags merged → ${newTagName}`, alertOk);
        document.getElementById('tag-merge-new-name').value = '';
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                currentLang === 'tr' 
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
    const okText = currentLang === 'tr' ? 'Evet' : 'Yes';
    const cancelText = currentLang === 'tr' ? 'Hayır' : 'No';
    const confirmMsg = currentLang === 'tr' ? 'Hiçbir videoda kullanılmayan etiketleri temizlemek istediğinize emin misiniz?' : 'Are you sure you want to clean up unused tags?';
    if (!await showCustomConfirm(confirmMsg, okText, cancelText)) return;
    showLoading(true);
    try {
        const result = await dbCleanupUnusedTags();
        const localResult = cleanupUnusedTagsLocally();
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `${localResult.removedCount} kullanılmayan etiket temizlendi.` : `${localResult.removedCount} unused tag(s) removed.`, alertOk);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        if (err.message.includes('CONFLICT')) {
            await showCustomAlert(
                currentLang === 'tr' 
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