// playlistManager.js - Çoklu Playlist Yönetimi
// ✅ DÜZELTİLDİ (3 sorun):
//   1. prompt()/confirm() → sitenin özel modal sistemi (showModernPrompt/showCustomConfirm)
//   2. Renk kodu girişi → 10 renkli hazır palet (tıklayarak seçim)
//   3. Koleksiyon butonuna dönünce playlist seçimi temizleniyor (navigation.js'de)

import { store } from './store.js';
import { showToast } from './toast.js';
import { showCustomConfirm } from './tangoModals.js';
import { showModernPrompt } from './utils.js';
import { icon } from './icons.js';
import { escapeHtml } from './utils.js'; // Adim 1.2
import {
    dbFetchPlaylists,
    dbFetchAllPlaylistVideos,
    dbCreatePlaylist,
    dbUpdatePlaylist,
    dbDeletePlaylist,
    dbFetchPlaylistVideoIds,
    dbAddVideoToPlaylist,
    dbRemoveVideoFromPlaylist
} from './db/playlists.js';

// ─────────────────────────────────────────────────────────────
// Synthwave temasıyla uyumlu 10 hazır renk paleti
// ─────────────────────────────────────────────────────────────
const PALETTE = [
    { color: '#ff007f', label: 'Neon Pembe'   },
    { color: '#00f0ff', label: 'Cyan'          },
    { color: '#10b981', label: 'Yeşil'         },
    { color: '#f59e0b', label: 'Turuncu'       },
    { color: '#8b5cf6', label: 'Mor'           },
    { color: '#ef4444', label: 'Kırmızı'       },
    { color: '#3b82f6', label: 'Mavi'          },
    { color: '#ec4899', label: 'Pembe'         },
    { color: '#14b8a6', label: 'Turkuaz'       },
    { color: '#f97316', label: 'Turuncu-Kırmızı' }
];

// ─────────────────────────────────────────────────────────────
// showPlaylistFormModal(title, defaultName, defaultColor)
// Hem "yeni liste oluştur" hem "listeyi düzenle" için kullanılır.
// Sitenin özel modal sistemi üzerinden çalışır.
// { name, color } döner; iptal edilirse null döner.
// ─────────────────────────────────────────────────────────────
function showPlaylistFormModal(title, defaultName = '', defaultColor = '#ff007f') {
    return new Promise((resolve) => {
        const modal   = document.getElementById('custom-dialog-modal');
        const msgEl   = document.getElementById('custom-dialog-message');
        const okBtn   = document.getElementById('custom-dialog-ok-btn');
        const cancelBtn = document.getElementById('custom-dialog-cancel-btn');
        if (!modal || !msgEl || !okBtn || !cancelBtn) { resolve(null); return; }

        const lang = store.get('currentLang');
        let selectedColor = defaultColor;

        // Renk paleti HTML'i
        const paletteHtml = PALETTE.map(p => `
            <button
                type="button"
                class="palette-dot"
                data-color="${p.color}"
                title="${p.label}"
                style="
                    width:28px; height:28px; border-radius:50%;
                    background:${p.color};
                    border: 3px solid ${p.color === defaultColor ? '#ffffff' : 'transparent'};
                    cursor:pointer; transition: border 0.15s ease;
                    flex-shrink:0;
                "
            ></button>
        `).join('');

        msgEl.innerHTML = `
            <div style="text-align:left;">
                <div style="font-size:1rem; font-weight:600; color:#f1f5f9; margin-bottom:14px;">
                    ${title}
                </div>
                <label style="font-size:0.8rem; color:#94a3b8; display:block; margin-bottom:6px;">
                    ${lang === 'tr' ? 'Liste Adı:' : 'List Name:'}
                </label>
                <input
                    type="text"
                    id="playlist-form-name"
                    value="${escapeHtml(defaultName)}"
                    placeholder="${lang === 'tr' ? 'Örn: Milonga Repertuarı' : 'e.g. Milonga Repertoire'}"
                    style="
                        width:100%; padding:10px 12px;
                        background:#0b0813; border:1px solid #ff007f;
                        border-radius:8px; color:#f1f5f9; outline:none;
                        font-size:0.9rem; margin-bottom:16px;
                        font-family:inherit; box-sizing:border-box;
                    "
                >
                <label style="font-size:0.8rem; color:#94a3b8; display:block; margin-bottom:8px;">
                    ${lang === 'tr' ? 'Renk Seç:' : 'Pick a Color:'}
                </label>
                <div id="palette-container" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:4px;">
                    ${paletteHtml}
                </div>
            </div>
        `;

        okBtn.innerText     = lang === 'tr' ? 'Kaydet' : 'Save';
        cancelBtn.innerText = lang === 'tr' ? 'İptal'  : 'Cancel';
        cancelBtn.classList.remove('d-none');
        modal.classList.remove('d-none');

        // Renk seçimi
        const paletteContainer = document.getElementById('palette-container');
        if (paletteContainer) {
            paletteContainer.addEventListener('click', (e) => {
                const dot = e.target.closest('.palette-dot');
                if (!dot) return;
                selectedColor = dot.dataset.color;
                // Tüm dotları sıfırla, seçileni vurgula
                paletteContainer.querySelectorAll('.palette-dot').forEach(d => {
                    d.style.border = `3px solid ${d.dataset.color === selectedColor ? '#ffffff' : 'transparent'}`;
                    d.style.transform = d.dataset.color === selectedColor ? 'scale(1.2)' : 'scale(1)';
                });
            });
        }

        // Input'a otomatik focus
        setTimeout(() => document.getElementById('playlist-form-name')?.focus(), 50);

        const handleOk = () => {
            const name = document.getElementById('playlist-form-name')?.value?.trim();
            modal.classList.add('d-none');
            cleanup();
            if (!name) { resolve(null); return; }
            resolve({ name, color: selectedColor });
        };

        const handleCancel = () => {
            modal.classList.add('d-none');
            cleanup();
            resolve(null);
        };

        const cleanup = () => {
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// ─────────────────────────────────────────────────────────────
// initPlaylists — uygulama başlangıcında çağrılır
// ─────────────────────────────────────────────────────────────
export async function initPlaylists() {
    try {
        const [playlists, allRelations] = await Promise.all([
            dbFetchPlaylists(),
            dbFetchAllPlaylistVideos()
        ]);
        store.set('globalPlaylists', playlists);

        // GÜNCELLEME (Adim 1.1): Tum playlist-video iliskilerini haritaya donustur
        // Sonuc formati: { videoId: [playlistId1, playlistId2, ...] }
        const map = {};
        for (const row of allRelations) {
            if (!map[row.video_id]) map[row.video_id] = [];
            map[row.video_id].push(row.playlist_id);
        }
        store.set('playlistVideoMap', map);

        renderPlaylistsInSidebar();
    } catch (err) {
        console.error('Playlist yukleme hatasi:', err);
    }
}

// ─────────────────────────────────────────────────────────────
// renderPlaylistsInSidebar — sol menüyü günceller
// ─────────────────────────────────────────────────────────────
export function renderPlaylistsInSidebar() {
    const container = document.getElementById('playlist-section-container');
    if (!container) return;

    const playlists = store.get('globalPlaylists') || [];
    const activeId  = store.get('activePlaylistId');
    const lang      = store.get('currentLang');

    container.innerHTML = '';

    // Başlık + yeni liste butonu
    const header = document.createElement('div');
    header.className = 'playlist-sidebar-header';
    header.innerHTML = `
        <span class="playlist-sidebar-title">${icon('clipboard-list', { size: 15, color: '#f59e0b' })} ${lang === 'tr' ? 'Listelerim' : 'My Lists'}</span>
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
        const map = store.get('playlistVideoMap') || {};
        const videoCount = Object.values(map).filter(ids => ids.includes(pl.id)).length;

        btn.innerHTML = `
            <span class="playlist-color-dot" style="background:${pl.color || '#ff007f'};"></span>
            <span class="playlist-btn-name">${escapeHtml(pl.name)}</span>
            <span class="playlist-btn-count" style="font-size:0.68rem;color:rgba(255,255,255,0.35);margin-left:2px;">(${videoCount})</span>
            <span class="playlist-btn-actions">
                <button class="playlist-edit-btn" data-id="${pl.id}" title="${lang === 'tr' ? 'Düzenle' : 'Edit'}">${icon('pencil', { size: 13, color: '#c026d3' })}</button>
                <button class="playlist-delete-btn" data-id="${pl.id}" title="${lang === 'tr' ? 'Sil' : 'Delete'}">${icon('trash-2', { size: 13, color: '#ef4444' })}</button>
            </span>
        `;

        btn.addEventListener('click', (e) => {
            if (e.target.closest('.playlist-btn-actions')) return;
            selectPlaylist(pl.id);
        });

        btn.querySelector('.playlist-edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            promptEditPlaylist(pl);
        });

        btn.querySelector('.playlist-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeletePlaylist(pl);
        });

        container.appendChild(btn);
    });
}

// ─────────────────────────────────────────────────────────────
// selectPlaylist — bir playlist'i aktif yap / seçimi kaldır
// ─────────────────────────────────────────────────────────────
export async function selectPlaylist(playlistId) {
    if (store.get('activePlaylistId') === playlistId) {
        store.set('activePlaylistId', null);
        store.set('activePlaylistVideoIds', []);
    } else {
        store.set('activePlaylistId', playlistId);
        try {
            const ids = await dbFetchPlaylistVideoIds(playlistId);
            store.set('activePlaylistVideoIds', ids);
        } catch (err) {
            console.error('Playlist videoları alınamadı:', err);
            store.set('activePlaylistVideoIds', []);
        }
    }
    renderPlaylistsInSidebar();
}

// ─────────────────────────────────────────────────────────────
// clearActivePlaylist — menü değişince seçimi temizle (Sorun 3)
// navigation.js callSwitchView() içinden çağrılır.
// ─────────────────────────────────────────────────────────────
export function clearActivePlaylist() {
    if (store.get('activePlaylistId') !== null) {
        store.set('activePlaylistId', null);
        store.set('activePlaylistVideoIds', []);
        renderPlaylistsInSidebar();
    }
}

// ─────────────────────────────────────────────────────────────
// promptCreatePlaylist — yeni liste oluşturma formu (Sorun 1 + 2)
// ─────────────────────────────────────────────────────────────
export async function promptCreatePlaylist() {
    const lang = store.get('currentLang');
    const title = lang === 'tr' ? `${icon('plus-circle', { size: 16, color: '#00f0ff' })} Yeni Liste Oluştur` : `${icon('plus-circle', { size: 16, color: '#00f0ff' })} Create New List`;
    const result = await showPlaylistFormModal(title, '', '#ff007f');
    if (!result) return;
    await createNewPlaylist(result.name, result.color);
}

export async function createNewPlaylist(name, color = '#ff007f') {
    const lang = store.get('currentLang');
    try {
        const newPlaylist = await dbCreatePlaylist(name, color);
        const playlists = store.get('globalPlaylists') || [];
        store.set('globalPlaylists', [...playlists, newPlaylist]);
        renderPlaylistsInSidebar();
        showToast(lang === 'tr' ? `"${name}" listesi oluşturuldu ✅` : `"${name}" list created ✅`, 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Liste oluşturulamadı' : 'Failed to create list', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// promptEditPlaylist — liste düzenleme formu (Sorun 1 + 2)
// ─────────────────────────────────────────────────────────────
export async function promptEditPlaylist(playlist) {
    const lang = store.get('currentLang');
    const title = lang === 'tr' ? `${icon('pencil', { size: 16, color: '#c026d3' })} Listeyi Düzenle` : `${icon('pencil', { size: 16, color: '#c026d3' })} Edit List`;
    const result = await showPlaylistFormModal(title, playlist.name, playlist.color || '#ff007f');
    if (!result) return;
    await editPlaylist(playlist.id, result.name, result.color);
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
        showToast(lang === 'tr' ? 'Liste güncellendi ✅' : 'List updated ✅', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Güncelleme hatası' : 'Update failed', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// confirmDeletePlaylist — silme onayı (Sorun 1)
// ─────────────────────────────────────────────────────────────
export async function confirmDeletePlaylist(playlist) {
    const lang = store.get('currentLang');
    const okText     = lang === 'tr' ? 'Evet, Sil' : 'Yes, Delete';
    const cancelText = lang === 'tr' ? 'İptal'     : 'Cancel';
    const msg = lang === 'tr'
        ? `"${playlist.name}" listesini silmek istediğinize emin misiniz?`
        : `Are you sure you want to delete "${playlist.name}"?`;
    const confirmed = await showCustomConfirm(msg, okText, cancelText);
    if (!confirmed) return;
    await deletePlaylist(playlist.id);
}

export async function deletePlaylist(id) {
    const lang = store.get('currentLang');
    try {
        await dbDeletePlaylist(id);
        const playlists = store.get('globalPlaylists').filter(p => p.id !== id);
        store.set('globalPlaylists', playlists);
        if (store.get('activePlaylistId') === id) {
            store.set('activePlaylistId', null);
            store.set('activePlaylistVideoIds', []);
        }
        renderPlaylistsInSidebar();
        showToast(lang === 'tr' ? 'Liste silindi 🗑️' : 'List deleted 🗑️', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Silme hatası' : 'Delete failed', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// addToPlaylist / removeFromPlaylist
// ─────────────────────────────────────────────────────────────
export async function addToPlaylist(videoId, playlistId) {
    const lang = store.get('currentLang');
    try {
        await dbAddVideoToPlaylist(playlistId, videoId);
        if (store.get('activePlaylistId') === playlistId) {
            const ids = store.get('activePlaylistVideoIds') || [];
            if (!ids.includes(videoId)) store.set('activePlaylistVideoIds', [...ids, videoId]);
        }
        // GUNCELLEME (Adim 1.1): playlistVideoMap'i de guncelle
        const map = { ...(store.get('playlistVideoMap') || {}) };
        if (!map[videoId]) map[videoId] = [];
        if (!map[videoId].includes(playlistId)) map[videoId] = [...map[videoId], playlistId];
        store.set('playlistVideoMap', map);
        showToast(lang === 'tr' ? '✅ Listeye eklendi' : '✅ Added to list', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Eklenemedi' : 'Failed to add', 'error');
        console.error(err);
    }
}

export async function removeFromPlaylist(videoId, playlistId) {
    const lang = store.get('currentLang');
    try {
        await dbRemoveVideoFromPlaylist(playlistId, videoId);
        if (store.get('activePlaylistId') === playlistId) {
            const ids = (store.get('activePlaylistVideoIds') || []).filter(id => id !== videoId);
            store.set('activePlaylistVideoIds', ids);
        }
        // GUNCELLEME (Adim 1.1): playlistVideoMap'i de guncelle
        const map = { ...(store.get('playlistVideoMap') || {}) };
        if (map[videoId]) {
            map[videoId] = map[videoId].filter(pid => pid !== playlistId);
            if (map[videoId].length === 0) delete map[videoId];
        }
        store.set('playlistVideoMap', map);
        showToast(lang === 'tr' ? '🗑️ Listeden çıkarıldı' : '🗑️ Removed from list', 'success');
    } catch (err) {
        showToast(lang === 'tr' ? 'Çıkarılamadı' : 'Failed to remove', 'error');
        console.error(err);
    }
}

// ─────────────────────────────────────────────────────────────
// showPlaylistDropdown — kart üzerindeki 📋 butonuna tıklanınca
// ─────────────────────────────────────────────────────────────
export function showPlaylistDropdown(videoId, anchorEl) {
    closeAllPlaylistDropdowns();

    const playlists = store.get('globalPlaylists') || [];
    const activePlaylistIds = getVideoPlaylistIds(videoId);
    const lang = store.get('currentLang');

    if (playlists.length === 0) {
        showToast(
            lang === 'tr' ? 'Önce bir liste oluşturun (sol menü ＋)' : 'Create a list first (left menu ＋)',
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
            if (isIn) await removeFromPlaylist(videoId, pl.id);
            else       await addToPlaylist(videoId, pl.id);
            closeAllPlaylistDropdowns();
        };
        dropdown.appendChild(item);
    });

    // Yeni liste kısayolu
    const newBtn = document.createElement('button');
    newBtn.className = 'playlist-dropdown-new';
    newBtn.textContent = lang === 'tr' ? '＋ Yeni Liste Oluştur' : '＋ Create New List';
    newBtn.onclick = (e) => {
        e.stopPropagation();
        closeAllPlaylistDropdowns();
        promptCreatePlaylist();
    };
    dropdown.appendChild(newBtn);

    document.body.appendChild(dropdown);
    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top  = (rect.bottom + 4) + 'px';
    dropdown.style.left = Math.min(rect.left, window.innerWidth - 210) + 'px';
    dropdown.style.zIndex = '99999';

    setTimeout(() => {
        document.addEventListener('click', closeAllPlaylistDropdowns, { once: true });
    }, 10);
}

export function closeAllPlaylistDropdowns() {
    document.querySelectorAll('.playlist-dropdown').forEach(el => el.remove());
}

function getVideoPlaylistIds(videoId) {
    // GUNCELLEME (Adim 1.1): Artik sadece aktif listeye degil,
    // tum playlist-video iliskilerine bakiyoruz.
    const map = store.get('playlistVideoMap') || {};
    return map[videoId] || [];
}

// escapeHtml -> utils.js (Adim 1.2)