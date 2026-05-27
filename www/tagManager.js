import { translations } from './config.js';
import { dbMergeTags, dbDeleteTagFromAllVideos, dbRenameTag, dbCleanupUnusedTags } from './tangoVeritabani.js';
import { showCustomAlert, showCustomConfirm } from './tangoModals.js';
import { showLoading, showModernPrompt } from './utils.js';

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

export async function promptRenameTagModern(oldTag) {
    const title = currentLang === 'tr' ? `"${oldTag}" etiketini yeni adıyla değiştir:` : `Rename "${oldTag}" to:`;
    const placeholder = currentLang === 'tr' ? 'Yeni etiket adı' : 'New tag name';
    const newTag = await showModernPrompt(title, oldTag, placeholder);
    if (!newTag || newTag === oldTag) return;
    
    showLoading(true);
    try {
        await dbRenameTag(oldTag, newTag);
        if (fetchVideosCallback) await fetchVideosCallback();
        showLoading(false);
        const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `"${oldTag}" → "${newTag}" olarak değiştirildi.` : `"${oldTag}" → "${newTag}" renamed.`, okText);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(`Hata: ${err.message}`, okText);
    }
}

export async function deleteSingleTag(tag) {
    const okText = currentLang === 'tr' ? 'Evet' : 'Yes';
    const cancelText = currentLang === 'tr' ? 'Hayır' : 'No';
    if (!await showCustomConfirm(currentLang === 'tr' ? `"${tag}" etiketini TÜM videolardan silmek istediğinize emin misiniz?` : `Are you sure you want to delete "${tag}" from ALL videos?`, okText, cancelText)) return;
    showLoading(true);
    try {
        await dbDeleteTagFromAllVideos([tag]);
        if (fetchVideosCallback) await fetchVideosCallback();
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `"${tag}" etiketi kaldırıldı.` : `"${tag}" removed.`, alertOk);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(`Hata: ${err.message}`, alertOk);
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
        if (fetchVideosCallback) await fetchVideosCallback();
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `${deleteCount} etiket silindi.` : `${deleteCount} tag(s) deleted.`, alertOk);
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(`Hata: ${err.message}`, alertOk);
    }
}

export async function mergeSelectedTags() {
    if (selectedTagsForMerge.length < 2) return;
    const newTagName = document.getElementById('tag-merge-new-name').value.trim();
    if (!newTagName) {
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
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
        if (fetchVideosCallback) await fetchVideosCallback();
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `${mergeCount} etiket birleştirildi → ${newTagName}` : `${mergeCount} tags merged → ${newTagName}`, alertOk);
        document.getElementById('tag-merge-new-name').value = '';
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(`Hata: ${err.message}`, alertOk);
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
        if (fetchVideosCallback) await fetchVideosCallback();
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(currentLang === 'tr' ? `${result.removedCount} kullanılmayan etiket temizlendi.` : `${result.removedCount} unused tag(s) removed.`, alertOk);
        if (renderTagManagerUICallback) renderTagManagerUICallback();
    } catch (err) {
        showLoading(false);
        const alertOk = currentLang === 'tr' ? 'Tamam' : 'OK';
        await showCustomAlert(`Hata: ${err.message}`, alertOk);
    }
}

// renderTagManagerUI artık burada değil, app.js içinde kalacak çünkü globalVideos'a doğrudan erişiyor ve UI oluşturuyor.
// Ama yine de app.js'den çağrılacağı için bir referans yeterli. O yüzden ayrıca export etmiyoruz.