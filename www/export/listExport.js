// export/listExport.js — Pratik Listesi Paylaşma & Dışa Aktarma
// ✅ YENİ (Adım 6.4)
// WhatsApp metni, panoya kopyalama ve yazdırma/PDF özelliklerini sağlar.

import { store } from '../store.js';
import { getFilteredVideos } from '../tangoFilters.js';
import { showToast } from '../toast.js';

// ─────────────────────────────────────────────────────────────
// buildCurrentList
// Store ve DOM'dan okunarak aktif bağlamı (favoriler, playlist
// veya filtreli koleksiyon) tespit eder; paylaşılacak video
// listesini ve liste adını döndürür.
// ─────────────────────────────────────────────────────────────
export function buildCurrentList() {
    const allVideos          = store.get('globalVideos')          || [];
    const currentView        = store.get('currentView');
    const favorites          = store.get('globalFavorites')       || [];
    const activePlaylistId   = store.get('activePlaylistId');
    const activePlaylistVIds = store.get('activePlaylistVideoIds') || [];
    const lang               = store.get('currentLang');

    let videos, listName;

    if (activePlaylistId !== null && activePlaylistId !== undefined) {
        // Aktif playlist görünümü
        videos   = allVideos.filter(v => activePlaylistVIds.includes(v.id));
        const playlists = store.get('globalPlaylists') || [];
        const pl = playlists.find(p => p.id === activePlaylistId);
        listName = pl ? pl.name : (lang === 'tr' ? 'Playlist' : 'Playlist');

    } else if (currentView === 'favorites') {
        // Pratik Listesi görünümü
        videos   = allVideos.filter(v => favorites.includes(v.id));
        listName = lang === 'tr' ? 'Pratik Listesi' : 'Practice List';

    } else {
        // Koleksiyon görünümü — mevcut arama/filtreler uygulanır
        const searchInput = document.getElementById('search-input');
        const aramaMetni  = searchInput ? (searchInput.value || '') : '';
        const filters = {
            aramaMetni,
            rol:           document.getElementById('filter-role-select')?.value            || 'all',
            egitmen:       document.getElementById('filter-instructor-select')?.value      || 'all',
            etiket:        document.getElementById('filter-tag-select')?.value             || 'all',
            tarih:         document.getElementById('filter-date-select')?.value            || 'all',
            platform:      document.getElementById('filter-platform-select')?.value        || 'all',
            learningStatus:document.getElementById('filter-learning-status-select')?.value || 'all'
        };
        videos   = getFilteredVideos(allVideos, filters, lang);
        listName = lang === 'tr' ? 'Video Koleksiyonu' : 'Video Collection';
    }

    return { videos, listName, lang };
}

// ─────────────────────────────────────────────────────────────
// instructorName — video nesnesinden eğitmen adını alır
// ─────────────────────────────────────────────────────────────
function instructorName(video) {
    return (video.instructors && video.instructors.name)
        ? video.instructors.name
        : (video.instructor_name || (store.get('currentLang') === 'tr' ? 'Bilinmeyen' : 'Unknown'));
}

// ─────────────────────────────────────────────────────────────
// rolLabel — rol tipini dile göre çevirir
// ─────────────────────────────────────────────────────────────
function rolLabel(roleType, lang) {
    if (roleType === 'Leader')   return lang === 'tr' ? 'Lider'   : 'Leader';
    if (roleType === 'Follower') return lang === 'tr' ? 'Takipçi' : 'Follower';
    return lang === 'tr' ? 'Çift' : 'Both';
}

// ─────────────────────────────────────────────────────────────
// platformLabel — platform adını döndürür
// ─────────────────────────────────────────────────────────────
function platformLabel(platform, lang) {
    const map = {
        drive: 'Google Drive', youtube: 'YouTube',
        instagram: 'Instagram', facebook: 'Facebook',
        other: lang === 'tr' ? 'Diğer' : 'Other'
    };
    return map[platform] || (lang === 'tr' ? 'Diğer' : 'Other');
}

// ─────────────────────────────────────────────────────────────
// generateTextSummary
// Video listesini WhatsApp/pano için okunabilir metin formatına
// dönüştürür.
//
// Örnek çıktı:
//   💃 Pratik Listesi — 3 Haziran 2025
//   ─────────────────────────────────
//   1. Carlos Gavito
//      🏷 giro, sacada
//      🎬 Lider • YouTube
//   ...
//   ─────────────────────────────────
//   Toplam: 3 video
// ─────────────────────────────────────────────────────────────
export function generateTextSummary(videos, listName, lang) {
    const now    = new Date();
    const dateStr = now.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
    const divider = '─'.repeat(34);
    const total   = lang === 'tr' ? `Toplam: ${videos.length} video` : `Total: ${videos.length} videos`;

    const lines = videos.map((v, i) => {
        const name    = instructorName(v);
        const tags    = v.tags ? v.tags.split(',').map(t => t.trim()).filter(Boolean).join(', ') : '—';
        const role    = rolLabel(v.role_type, lang);
        const plat    = platformLabel(v.platform, lang);
        const partner = v.partner_name ? ` (${v.partner_name})` : '';
        return `${i + 1}. ${name}${partner}\n   🏷 ${tags}\n   🎬 ${role} • ${plat}`;
    });

    return [
        `💃 ${listName} — ${dateStr}`,
        divider,
        ...lines,
        divider,
        total
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────
// shareToWhatsApp
// Metni URL'ye kodlayarak WhatsApp'ı yeni sekmede açar.
// ─────────────────────────────────────────────────────────────
export function shareToWhatsApp() {
    const { videos, listName, lang } = buildCurrentList();

    if (videos.length === 0) {
        showToast(
            lang === 'tr' ? 'Paylaşılacak video yok.' : 'No videos to share.',
            'error'
        );
        return;
    }

    const text = generateTextSummary(videos, listName, lang);
    const url  = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

// ─────────────────────────────────────────────────────────────
// copyListToClipboard
// Metni panoya kopyalar, toast ile bildirim gösterir.
// ─────────────────────────────────────────────────────────────
export async function copyListToClipboard() {
    const { videos, listName, lang } = buildCurrentList();

    if (videos.length === 0) {
        showToast(
            lang === 'tr' ? 'Kopyalanacak video yok.' : 'No videos to copy.',
            'error'
        );
        return;
    }

    const text = generateTextSummary(videos, listName, lang);

    try {
        await navigator.clipboard.writeText(text);
        showToast(
            lang === 'tr'
                ? `📋 ${listName} panoya kopyalandı!`
                : `📋 ${listName} copied to clipboard!`,
            'success'
        );
    } catch {
        // Clipboard API'ye erişim yoksa (bazı eski tarayıcılar / HTTP)
        showToast(
            lang === 'tr'
                ? 'Panoya kopyalanamadı. HTTPS gerekebilir.'
                : 'Could not copy. HTTPS may be required.',
            'error'
        );
    }
}

// ─────────────────────────────────────────────────────────────
// exportToPrintView
// Temiz, açık renk temalı ve yazdırmaya uygun bir HTML sayfasını
// yeni pencerede açar; tarayıcının yazdır/PDF diyaloğunu tetikler.
// ─────────────────────────────────────────────────────────────
export function exportToPrintView() {
    const { videos, listName, lang } = buildCurrentList();

    if (videos.length === 0) {
        showToast(
            lang === 'tr' ? 'Yazdırılacak video yok.' : 'No videos to print.',
            'error'
        );
        return;
    }

    const now     = new Date();
    const dateStr = now.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const T = {
        role:      lang === 'tr' ? 'Rol'      : 'Role',
        platform:  lang === 'tr' ? 'Platform' : 'Platform',
        tags:      lang === 'tr' ? 'Etiketler': 'Tags',
        instructor:lang === 'tr' ? 'Eğitmen'  : 'Instructor',
        partner:   lang === 'tr' ? 'Partner'  : 'Partner',
        total:     lang === 'tr' ? `Toplam ${videos.length} video` : `Total ${videos.length} videos`,
        footer:    lang === 'tr'
            ? 'Arjantin Tango Kombinasyon Koleksiyonu'
            : 'Argentine Tango Combination Collection',
        none:      lang === 'tr' ? '—' : '—'
    };

    const rows = videos.map((v, i) => {
        const name    = `<strong>${escHtml(instructorName(v))}</strong>`;
        const partner = v.partner_name ? `<br><span class="partner">${escHtml(v.partner_name)}</span>` : '';
        const tags    = v.tags
            ? v.tags.split(',').map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join(' ')
            : T.none;
        return `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">
            <td class="num">${i + 1}</td>
            <td>${name}${partner}</td>
            <td>${tags}</td>
            <td>${escHtml(rolLabel(v.role_type, lang))}</td>
            <td>${escHtml(platformLabel(v.platform, lang))}</td>
        </tr>`;
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escHtml(listName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            padding: 32px 40px 48px;
            font-size: 13px;
            line-height: 1.5;
        }
        header { margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; }
        header h1 {
            font-size: 1.35rem;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: -0.2px;
        }
        header .meta {
            font-size: 0.78rem;
            color: #64748b;
            margin-top: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        thead th {
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            font-size: 0.72rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        tbody td {
            padding: 9px 10px;
            vertical-align: top;
            border-bottom: 1px solid #f1f5f9;
        }
        tr.even td { background: #ffffff; }
        tr.odd td  { background: #f8fafc; }
        td.num {
            color: #94a3b8;
            font-weight: 600;
            width: 32px;
            text-align: center;
        }
        .partner {
            font-size: 0.78rem;
            color: #64748b;
        }
        .tag {
            display: inline-block;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 1px 5px;
            font-size: 0.72rem;
            color: #475569;
            margin: 1px 1px 1px 0;
        }
        footer {
            margin-top: 28px;
            padding-top: 12px;
            border-top: 1px solid #e2e8f0;
            font-size: 0.72rem;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
        }
        @media print {
            body { padding: 16px 20px; }
            header { margin-bottom: 14px; }
        }
    </style>
</head>
<body>
    <header>
        <h1>💃 ${escHtml(listName)}</h1>
        <div class="meta">${dateStr} &nbsp;·&nbsp; ${T.total}</div>
    </header>

    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>${T.instructor}</th>
                <th>${T.tags}</th>
                <th>${T.role}</th>
                <th>${T.platform}</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>

    <footer>
        <span>${T.footer}</span>
        <span>${dateStr}</span>
    </footer>

    <script>
        // Sayfa yüklenir yüklenmez yazdır diyaloğunu aç
        window.addEventListener('load', () => {
            setTimeout(() => { window.print(); }, 400);
        });
    </script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        showToast(
            lang === 'tr'
                ? 'Açılır pencere engellendi. Tarayıcı ayarlarından izin ver.'
                : 'Popup blocked. Please allow popups in your browser settings.',
            'error'
        );
        return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
}

// ─────────────────────────────────────────────────────────────
// escHtml — XSS koruması için HTML escape (bu modülde kullanılır)
// ─────────────────────────────────────────────────────────────
function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}