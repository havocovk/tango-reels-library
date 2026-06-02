// annotationManager.js - Zaman damgasına bağlı not yönetimi
// ✅ YENİ (Adım 6.1)
import { dbFetchAnnotations, dbAddAnnotation, dbDeleteAnnotation } from './db/annotations.js';
import { showToast } from './toast.js';

// Şu an hangi video için modal açık — modül düzeyinde saklıyoruz
let activeVideoId   = null;
let activeVideoUrl  = null;
let activePlatform  = null;

// ─────────────────────────────────────────────────────────────
// parseTimestamp — "1:32", "45", "1:05:30" → saniye sayısına çevirir
// Geçersiz giriş → null döner
// ─────────────────────────────────────────────────────────────
function parseTimestamp(input) {
    const str = String(input || '').trim();
    if (!str) return null;

    if (str.includes(':')) {
        const parts = str.split(':').map(Number);
        if (parts.some(isNaN)) return null;
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return null;
    }

    const num = parseInt(str, 10);
    return (!isNaN(num) && num >= 0) ? num : null;
}

// ─────────────────────────────────────────────────────────────
// formatTimestamp — saniyeyi "1:32" biçimine çevirir
// ─────────────────────────────────────────────────────────────
function formatTimestamp(sec) {
    if (sec === null || sec === undefined) return '—';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
}

// ─────────────────────────────────────────────────────────────
// jumpToTimestamp — videoyu verilen anı gösterecek şekilde açar
// YouTube'da ?t= parametresiyle tam saniyeye atlar
// ─────────────────────────────────────────────────────────────
function jumpToTimestamp(videoUrl, platform, timestampSec) {
    if (!videoUrl) return;

    if (platform === 'youtube') {
        const match = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
        const videoId = match ? match[1] : null;
        if (videoId) {
            window.open(
                `https://www.youtube.com/watch?v=${videoId}&t=${timestampSec}s`,
                '_blank'
            );
            return;
        }
    }

    // YouTube değilse veya ID bulunamazsa videoyu normal aç
    window.open(videoUrl, '_blank');
}

// ─────────────────────────────────────────────────────────────
// escapeHtml — not içeriğini güvenle HTML'e gömer
// ─────────────────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────
// renderAnnotationList — annotation listesini modal içine çizer
// ─────────────────────────────────────────────────────────────
function renderAnnotationList(annotations, videoUrl, platform, videoId) {
    const container = document.getElementById('annotation-list-container');
    if (!container) return;

    if (!annotations || annotations.length === 0) {
        container.innerHTML = `
            <div style="
                text-align:center; padding:28px 16px;
                opacity:0.5; font-size:0.88rem; line-height:1.6;
            ">
                📭 Henüz not eklenmemiş.<br>
                <span style="font-size:0.8rem;">Yukarıdaki formu kullanarak ilk notunu ekleyebilirsin.</span>
            </div>`;
        return;
    }

    container.innerHTML = annotations.map(ann => `
        <div class="annotation-row" data-id="${ann.id}" style="
            display: flex;
            align-items: flex-start;
            gap: 12px;
            background: rgba(255,0,127,0.04);
            border: 1px solid rgba(255,0,127,0.15);
            border-radius: 12px;
            padding: 11px 13px;
            margin-bottom: 9px;
            transition: border-color 0.2s;
        ">
            <button
                class="ann-timestamp-btn"
                data-sec="${ann.timestamp_sec}"
                title="${platform === 'youtube' ? 'Bu ana YouTube\'da git' : 'Videoyu aç'}"
                style="
                    flex-shrink: 0;
                    padding: 5px 11px;
                    background: rgba(0,240,255,0.09);
                    border: 1px solid rgba(0,240,255,0.3);
                    border-radius: 8px;
                    color: #00f0ff;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    white-space: nowrap;
                    font-family: 'Poppins', sans-serif;
                    transition: background 0.15s;
                "
            >⏱ ${formatTimestamp(ann.timestamp_sec)}</button>

            <div style="
                flex: 1;
                font-size: 0.88rem;
                color: #e2e8f0;
                line-height: 1.55;
                padding-top: 5px;
                word-break: break-word;
            ">${escapeHtml(ann.note)}</div>

            <button
                class="ann-delete-btn"
                data-id="${ann.id}"
                title="Notu sil"
                style="
                    flex-shrink: 0;
                    background: transparent;
                    border: none;
                    color: #475569;
                    font-size: 1.05rem;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 6px;
                    line-height: 1;
                    transition: color 0.15s;
                "
            >🗑️</button>
        </div>
    `).join('');

    // Timestamp butonlarına tıklama
    container.querySelectorAll('.ann-timestamp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sec = parseInt(btn.dataset.sec, 10);
            jumpToTimestamp(videoUrl, platform, sec);
        });
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(0,240,255,0.2)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(0,240,255,0.09)';
        });
    });

    // Silme butonlarına tıklama
    container.querySelectorAll('.ann-delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id, 10);
            try {
                await dbDeleteAnnotation(id);
                const fresh = await dbFetchAnnotations(videoId);
                renderAnnotationList(fresh, videoUrl, platform, videoId);
                showToast('Not silindi', 'success');
            } catch (err) {
                showToast('Silinemedi: ' + err.message, 'error');
            }
        });
        btn.addEventListener('mouseenter', () => { btn.style.color = '#ef4444'; });
        btn.addEventListener('mouseleave', () => { btn.style.color = '#475569'; });
    });
}

// ─────────────────────────────────────────────────────────────
// loadAnnotations — DB'den çeker ve listeyi günceller
// ─────────────────────────────────────────────────────────────
async function loadAnnotations(videoId, videoUrl, platform) {
    const container = document.getElementById('annotation-list-container');
    if (container) {
        container.innerHTML = `<div style="text-align:center; padding:24px; opacity:0.45; font-size:0.88rem;">
            ⏳ Notlar yükleniyor…
        </div>`;
    }
    try {
        const annotations = await dbFetchAnnotations(videoId);
        renderAnnotationList(annotations, videoUrl, platform, videoId);
    } catch (err) {
        if (container) {
            container.innerHTML = `<div style="color:#ef4444; text-align:center; padding:16px; font-size:0.85rem;">
                Notlar yüklenemedi: ${escapeHtml(err.message)}
            </div>`;
        }
        console.error('loadAnnotations hatası:', err);
    }
}

// ─────────────────────────────────────────────────────────────
// openAnnotationModal — karttan çağrılır; modalı hazırlar ve açar
// ─────────────────────────────────────────────────────────────
export async function openAnnotationModal(video) {
    const modal = document.getElementById('annotation-modal');
    if (!modal) {
        console.error('annotation-modal DOM\'da bulunamadı');
        return;
    }

    // Aktif video bilgilerini sakla
    activeVideoId  = video.id;
    activePlatform = video.platform || 'other';
    // Drive videolarında oynatma URL'si drive_url'dir, orijinal kaynak URL'si değil
    activeVideoUrl = (activePlatform === 'drive')
        ? (video.drive_url || video.url)
        : video.url;

    // Alt başlık: eğitmen adı + YouTube uyarısı
    const subtitle = document.getElementById('annotation-modal-subtitle');
    if (subtitle) {
        const instructor = video.instructor_name
            || (video.instructors && video.instructors.name)
            || 'Bilinmeyen Eğitmen';
        subtitle.textContent = activePlatform !== 'youtube'
            ? `${instructor} — ⚠️ Timestamp atlama yalnızca YouTube\'da çalışır`
            : instructor;
    }

    // Form inputlarını sıfırla
    const tsInput   = document.getElementById('annotation-timestamp-input');
    const noteInput = document.getElementById('annotation-note-input');
    const errEl     = document.getElementById('annotation-form-error');
    if (tsInput)   tsInput.value = '';
    if (noteInput) noteInput.value = '';
    if (errEl)     { errEl.style.display = 'none'; errEl.textContent = ''; }

    // Modalı göster
    modal.classList.remove('d-none');

    // Notları yükle
    await loadAnnotations(activeVideoId, activeVideoUrl, activePlatform);

    // "Ekle" butonu
    const addBtn = document.getElementById('annotation-add-btn');
    if (addBtn) {
        // Eski listener'ı temizlemek için onclick kullanıyoruz (addEventListener birikiyor)
        addBtn.onclick = async () => {
            const tsVal   = tsInput   ? tsInput.value.trim()   : '';
            const noteVal = noteInput ? noteInput.value.trim() : '';

            const timestampSec = parseTimestamp(tsVal);
            if (timestampSec === null) {
                if (errEl) {
                    errEl.textContent = '⚠️ Geçerli bir zaman gir. Örnek: 1:32 veya 45';
                    errEl.style.display = 'block';
                }
                return;
            }
            if (!noteVal) {
                if (errEl) {
                    errEl.textContent = '⚠️ Not alanı boş bırakılamaz.';
                    errEl.style.display = 'block';
                }
                return;
            }
            if (errEl) errEl.style.display = 'none';

            addBtn.disabled = true;
            addBtn.style.opacity = '0.5';
            try {
                await dbAddAnnotation(activeVideoId, timestampSec, noteVal);
                if (tsInput)   tsInput.value   = '';
                if (noteInput) noteInput.value = '';
                await loadAnnotations(activeVideoId, activeVideoUrl, activePlatform);
                showToast('Not eklendi ✓', 'success');
            } catch (err) {
                if (errEl) {
                    errEl.textContent = 'Kaydedilemedi: ' + err.message;
                    errEl.style.display = 'block';
                }
            } finally {
                addBtn.disabled = false;
                addBtn.style.opacity = '1';
            }
        };
    }

    // Note input'ta Enter → Ekle
    if (noteInput) {
        noteInput.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addBtn && addBtn.click(); }
        };
    }

    // Kapat butonu
    const closeBtn = document.getElementById('annotation-modal-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => modal.classList.add('d-none');
    }

    // Overlay'e (arka plana) tıklayınca kapat
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('d-none');
    };
}