// playlistManager.js - Çoklu Playlist Yönetimi (Adım 2.4)
// Playlist oluşturma, silme, yeniden adlandırma ve video ekleme/çıkarma işlemlerini yönetir.
// Sol menünün altında playlist listesi render edilir.
// Video kartlarında playlist butonu açılır menü gösterir.

import { store } from './store.js';
import { showToast } from './toast.js';
import {
    dbFetchPlaylists,
    dbCreatePlaylist,
    dbUpdatePlaylist,
    dbDeletePlaylist,
    dbFetchPlaylistVideoIds,
    dbAddVideoToPlaylist,
    dbRemoveVideoFromPlaylist
} from './db/playlists.js';

// ─────────────────────────────────────────────────────────────
// initPlaylists()
// Uygulama başlangıcında çağrılır. Tüm playlist'leri çeker
// ve store'a yazar. Ardından sol menüde render eder.
// ─────────────────────────────────────────────────────────────
export async function initPlaylists() {
    try {
        const playlists = await dbFetchPlaylists();
        store.set('globalPlaylists', playlists);
        renderPlaylistsInSidebar();
    } catch (err) {
        console.error('Playlist yükleme hatası:', err);
    }
}

// ─────────────────────────────────────────────────────────────
// renderPlaylistsInSidebar()
// Sol menüdeki #playlist-section-container div'ini doldurur.
// Her playlist bir buton, aktif olan vurgulanır.
// ─────────────────────────────────────────────────────────────
export function renderPlaylistsInSidebar() {
    const container = document.getElementById('playlist-section-container');
    if (!container) return;

    const playlists = store.get('globalPlaylists') || [];
    const activeId  = store.get('activePlaylistId');
    const lang      = store.get('currentLang');

    container.innerHTML = '';

    // Bölüm başlığı + yeni playlist butonu
    const header = document.createElement('div');
    header.className = 'playlist-sidebar-header';
    header.innerHTML = `
        <span class="playlist-sidebar-title">📋 ${lang === 'tr' ? 'Listelerim' : 'My Lists'}</span>
        <button id="btn-new-playlist" class="playlist-new-btn" title="${lang === 'tr' ? 'Yeni Liste' : 'New List'}">＋</button>
    `;
    container.appendChild(header);

    header.querySelector('#btn-new-playlist').onclick = () => promptCreatePlaylist();

    if (playlists.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'playlist-sidebar-empty';
        empty.textContent = lang === 'tr' ? 'Henüz liste yok' : 'No lists yet';
        container.appendChild(empty);
        return;
    }

    playlists.forEach(pl => {
        const btn = document.createElement('button');
        btn.className = 'playlist-sidebar-btn' + (pl.id === activeId ? ' active' : '');
        btn.dataset.playlistId = pl.id;
        btn.innerHTML = `
            <span class="playlist-color-dot" style="background: ${pl.color || '#ff007f'};"></span>
            <span class="playlist-btn-name">${escapeHtml(pl.name)}</span>
            <span class="playlist-btn-actions">
                <button class="playlist-edit-btn" data-id="${pl.id}" title="${lang === 'tr' ? 'Düzenle' : 'Edit'}">✏️</button>
                <button class="playlist-delete-btn" data-id="${pl.id}" title="${lang === 'tr' ? 'Sil' : 'Delete'}">🗑️</button>
            </span>
        `;

        // Playlist'e tıkla → aktif yap ve filtrele
        btn.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-btn-actions')) return; // düzenle/sil tıklandı
            selectPlaylist(pl.id);
        });

        // Düzenle
        btn.querySelector('.playlist-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            promptEditPlaylist(pl);
        });

        // Sil
        btn.querySelector('.playlist-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeletePlaylist(pl);
        });

        container.appendChild(btn);
    });
}

// ─────────────────────────────────────────────────────────────
// selectPlaylist(playlistId)
// Bir playlist'i aktif yapar; store güncellenir ve
// videoHandlers applyFiltersAndSearch çağrılır (uiSubscriptions üzerinden).
// null geçilirse seçim kaldırılır.
// ─────────────────────────────────────────────────────────────
export async function selectPlaylist(playlistId) {
    if (store.get('activePlaylistId') === playlistId) {
        // Aynı playlist'e tekrar tıklandı → seçimi kaldır
        store.set('activePlaylistId', null);
        store.set('activePlaylistVideoIds', []);
    } else {
        store.set('activePlaylistId', playlistId);
        // O playlist'in video ID'lerini çek
        try {
            const ids = await dbFetchPlaylistVideoIds(playlistId);
            store.set('activePlaylistVideoIds', ids);
        } catch (err) {
            console.error('Playlist videoları alınamadı:', err);
            store.set('activePlaylistVideoIds', []);
        }
    }
    renderPlaylistsInSidebar();
    // uiSubscriptions activePlaylistId değişimini dinliyor ve applyFiltersAndSearch tetikliyor
}

// ─────────────────────────────────────────────────────────────
// promptCreatePlaylist()
// Kullanıcıdan yeni playlist adı ve rengi ister.
// ─────────────────────────────────────────────────────────────
export function promptCreatePlaylist() {
    const lang = store.get('currentLang');
    const name = prompt(lang === 'tr' ? 'Yeni liste adı:' : 'New list name:');
    if (!name || !name.trim()) return;
    const color = prompt(
        lang === 'tr' ? 'Renk kodu (örn: #ff007f):' : 'Color code (e.g. #ff007f):',
        '#ff007f'
    ) || '#ff007f';
    createNewPlaylist(name.trim(), color.trim());
}

// ─────────────────────────────────────────────────────────────
// createNewPlaylist(name, color)
// DB'ye yazar, store'u günceller, sidebar'ı yeniler.
// ─────────────────────────────────────────────────────────────
export async function createNewPlaylist(name, color = '#ff007f') {
    const lang = store.get('currentLang');
    try {
        const newPlaylist = await dbCreatePlaylist(name, color);
        const playlists = store.get('globalPlaylists') || [];
        store.set('globalPlaylists', [...playlists, newPlaylist]);
        renderPlaylistsInSidebar();
        showToast(lang === 'tr' ? `"${name}" listesi oluşturuldu` : `"${name}" list created`, 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Liste oluşturulamadı' : 'Failed to create list', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// promptEditPlaylist(playlist)
// Var olan bir playlist'in adını ve rengini düzenler.
// ─────────────────────────────────────────────────────────────
export function promptEditPlaylist(playlist) {
    const lang = store.get('currentLang');
    const newName = prompt(
        lang === 'tr' ? 'Liste adı:' : 'List name:',
        playlist.name
    );
    if (!newName || !newName.trim()) return;
    const newColor = prompt(
        lang === 'tr' ? 'Renk kodu:' : 'Color code:',
        playlist.color || '#ff007f'
    ) || playlist.color || '#ff007f';
    editPlaylist(playlist.id, newName.trim(), newColor.trim());
}

export async function editPlaylist(id, name, color) {
    const lang = store.get('currentLang');
    try {
        await dbUpdatePlaylist(id, name, color);
        const playlists = store.get('globalPlaylists').map(p =>
            p.id === id ? { ...p, name, color } : p
        );
        store.set('globalPlaylists', playlists);
        renderPlaylistsInSidebar();
        showToast(lang === 'tr' ? 'Liste güncellendi' : 'List updated', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Güncelleme hatası' : 'Update failed', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// confirmDeletePlaylist(playlist)
// Onay alıp playlist'i siler.
// ─────────────────────────────────────────────────────────────
export function confirmDeletePlaylist(playlist) {
    const lang = store.get('currentLang');
    const msg = lang === 'tr'
        ? `"${playlist.name}" listesini silmek istediğinize emin misiniz?`
        : `Are you sure you want to delete "${playlist.name}"?`;
    if (!confirm(msg)) return;
    deletePlaylist(playlist.id);
}

export async function deletePlaylist(id) {
    const lang = store.get('currentLang');
    try {
        await dbDeletePlaylist(id);
        const playlists = store.get('globalPlaylists').filter(p => p.id !== id);
        store.set('globalPlaylists', playlists);
        // Aktif playlist silindiyse seçimi kaldır
        if (store.get('activePlaylistId') === id) {
            store.set('activePlaylistId', null);
            store.set('activePlaylistVideoIds', []);
        }
        renderPlaylistsInSidebar();
        showToast(lang === 'tr' ? 'Liste silindi' : 'List deleted', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Silme hatası' : 'Delete failed', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// addToPlaylist(videoId, playlistId)
// Bir videoyu bir playlist'e ekler ve store'daki ID listesini günceller.
// ─────────────────────────────────────────────────────────────
export async function addToPlaylist(videoId, playlistId) {
    const lang = store.get('currentLang');
    try {
        await dbAddVideoToPlaylist(playlistId, videoId);
        // Aktif playlist ise store'daki ID listesini güncelle
        if (store.get('activePlaylistId') === playlistId) {
            const ids = store.get('activePlaylistVideoIds') || [];
            if (!ids.includes(videoId)) {
                store.set('activePlaylistVideoIds', [...ids, videoId]);
            }
        }
        showToast(lang === 'tr' ? '✅ Listeye eklendi' : '✅ Added to list', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Eklenemedi' : 'Failed to add', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// removeFromPlaylist(videoId, playlistId)
// Bir videoyu bir playlist'ten çıkarır.
// ─────────────────────────────────────────────────────────────
export async function removeFromPlaylist(videoId, playlistId) {
    const lang = store.get('currentLang');
    try {
        await dbRemoveVideoFromPlaylist(playlistId, videoId);
        // Aktif playlist ise store'daki ID listesini güncelle
        if (store.get('activePlaylistId') === playlistId) {
            const ids = (store.get('activePlaylistVideoIds') || []).filter(id => id !== videoId);
            store.set('activePlaylistVideoIds', ids);
        }
        showToast(lang === 'tr' ? '🗑️ Listeden çıkarıldı' : '🗑️ Removed from list', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Çıkarılamadı' : 'Failed to remove', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// showPlaylistDropdown(videoId, anchorEl)
// Bir video kartındaki ➕ butonuna tıklandığında
// mevcut playlist'leri gösteren açılır mini menü render eder.
// ─────────────────────────────────────────────────────────────
export function showPlaylistDropdown(videoId, anchorEl) {
    // Varsa önceki dropdown'ı kapat
    closeAllPlaylistDropdowns();

    const playlists = store.get('globalPlaylists') || [];
    const activePlaylistIds = getVideoPlaylistIds(videoId);
    const lang = store.get('currentLang');

    if (playlists.length === 0) {
        showToast(
            lang === 'tr' ? 'Önce bir liste oluşturun (sol menü)' : 'Create a list first (left menu)',
            'error'
        );
        return;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'playlist-dropdown';
    dropdown.id = 'playlist-dropdown-' + videoId;

    playlists.forEach(pl => {
        const isIn = activePlaylistIds.includes(pl.id);
        const item = document.createElement('button');
        item.className = 'playlist-dropdown-item' + (isIn ? ' in-playlist' : '');
        item.innerHTML = `
            <span class="playlist-color-dot" style="background:${pl.color || '#ff007f'};"></span>
            <span>${escapeHtml(pl.name)}</span>
            <span class="playlist-check">${isIn ? '✓' : '＋'}</span>
        `;
        item.onclick = async (e) => {
            e.stopPropagation();
            if (isIn) {
                await removeFromPlaylist(videoId, pl.id);
            } else {
                await addToPlaylist(videoId, pl.id);
            }
            closeAllPlaylistDropdowns();
        };
        dropdown.appendChild(item);
    });

    // Yeni liste oluştur kısayolu
    const newBtn = document.createElement('button');
    newBtn.className = 'playlist-dropdown-new';
    newBtn.textContent = lang === 'tr' ? '＋ Yeni Liste' : '＋ New List';
    newBtn.onclick = (e) => {
        e.stopPropagation();
        closeAllPlaylistDropdowns();
        promptCreatePlaylist();
    };
    dropdown.appendChild(newBtn);

    // Dropdown'ı anchor'ın yanına konumlandır
    document.body.appendChild(dropdown);
    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    dropdown.style.zIndex = '99999';

    // Dışarı tıklanınca kapat
    setTimeout(() => {
        document.addEventListener('click', closeAllPlaylistDropdowns, { once: true });
    }, 10);
}

export function closeAllPlaylistDropdowns() {
    document.querySelectorAll('.playlist-dropdown').forEach(el => el.remove());
}

// Bir video hangi playlist'lerde? (store'daki globalPlaylists + activePlaylistVideoIds ile yaklaşık)
// Tam doğruluk için her video için DB sorgusu gerekir; bu şimdilik sadece aktif playlist'i kontrol eder.
function getVideoPlaylistIds(videoId) {
    const activeId = store.get('activePlaylistId');
    const activeIds = store.get('activePlaylistVideoIds') || [];
    if (activeId && activeIds.includes(videoId)) return [activeId];
    return [];
}

// XSS koruması
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
}