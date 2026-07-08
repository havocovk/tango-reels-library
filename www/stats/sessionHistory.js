// stats/sessionHistory.js
// Pratik seans geçmişi — listeleme ve silme
// statsUI.js'den bölündü.

import { dbFetchPracticeSessions, dbDeletePracticeSession } from '../tangoVeritabani.js';
import { showCustomConfirm } from '../tangoModals.js';
import { showToast } from '../toast.js';
import { icon } from '../icons.js';

// ─────────────────────────────────────────────────────────────
// renderSessionHistory — container'ı başlatır, veriyi çeker
// ─────────────────────────────────────────────────────────────
export async function renderSessionHistory(container, currentLang) {
    const t = currentLang === 'tr';

    container.innerHTML = `
        <div class="stats-section-title" style="
            font-size:1rem; font-weight:700; color:rgba(255,255,255,0.8);
            margin-bottom:16px; display:flex; align-items:center; gap:8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00f0ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${t ? 'Pratik Seans Geçmişi' : 'Practice Session History'}
        </div>
        <div id="session-history-list" style="display:flex;flex-direction:column;gap:8px;">
            <p style="color:rgba(255,255,255,0.3);font-size:0.82rem;">${t ? 'Yükleniyor...' : 'Loading...'}</p>
        </div>`;

    await loadAndRenderSessions(currentLang);
}

// ─────────────────────────────────────────────────────────────
// loadAndRenderSessions — seansları çeker, listeler, silme bağlar
// ─────────────────────────────────────────────────────────────
export async function loadAndRenderSessions(currentLang) {
    const t = currentLang === 'tr';
    const listEl = document.getElementById('session-history-list');
    if (!listEl) return;

    try {
        const sessions = await dbFetchPracticeSessions();
        if (!listEl) return;

        if (sessions.length === 0) {
            listEl.innerHTML = `<p style="color:rgba(255,255,255,0.3);font-size:0.82rem;">${t ? 'Henüz kayıtlı seans yok.' : 'No sessions recorded yet.'}</p>`;
            return;
        }

        listEl.innerHTML = sessions.map(s => {
            const date    = new Date(s.session_date);
            const dateStr = date.toLocaleDateString(t ? 'tr-TR' : 'en-US', { weekday:'short', day:'numeric', month:'short' });
            const mins    = Math.floor((s.duration_seconds || 0) / 60);
            const secs    = (s.duration_seconds || 0) % 60;
            const durStr  = `${mins}:${secs.toString().padStart(2,'0')}`;
            const total   = (s.practiced_count || 0) + (s.skipped_count || 0);
            const pct     = total > 0 ? Math.round((s.practiced_count / total) * 100) : 0;
            const barColor = pct >= 80 ? '#4ade80' : pct >= 50 ? '#f59e0b' : '#ff007f';

            return `<div class="ph-session-row" data-session-id="${s.id}" style="
                background:rgba(255,255,255,0.03);
                border:1px solid rgba(255,255,255,0.07);
                border-radius:12px;
                padding:12px 16px;
                display:flex;
                align-items:center;
                gap:16px;
                flex-wrap:wrap;
                position:relative;
                transition:border-color 0.2s;">
                    <span style="color:rgba(255,255,255,0.5);font-size:0.8rem;min-width:100px;">${dateStr}</span>
                    <div style="flex:1;min-width:120px;">
                        <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width 0.4s;"></div>
                        </div>
                    </div>
                    <span style="color:rgba(255,255,255,0.7);font-size:0.82rem;white-space:nowrap;">
                        ${s.practiced_count || 0} ${t ? 'video' : 'videos'}
                    </span>
                    <span style="color:rgba(255,255,255,0.4);font-size:0.78rem;white-space:nowrap;">
                        ⏱ ${durStr}
                    </span>
                    <button class="ph-delete-btn" data-session-id="${s.id}" title="${t ? 'Bu seansı sil' : 'Delete this session'}" style="
                        flex-shrink:0;
                        width:30px;height:30px;
                        border-radius:8px;
                        background:transparent;
                        border:1px solid rgba(239,68,68,0.25);
                        color:#ef4444;
                        opacity:0;
                        cursor:pointer;
                        display:flex;align-items:center;justify-content:center;
                        transition:opacity 0.15s, background 0.15s;">
                        ${icon('trash-2', { size: 15, color: '#ef4444' })}
                    </button>
            </div>`;
        }).join('');

        listEl.querySelectorAll('.ph-session-row').forEach(row => {
            const delBtn = row.querySelector('.ph-delete-btn');
            row.addEventListener('mouseenter', () => { if (delBtn) delBtn.style.opacity = '1'; });
            row.addEventListener('mouseleave', () => { if (delBtn) delBtn.style.opacity = '0'; });
        });

        listEl.querySelectorAll('.ph-delete-btn').forEach(btn => {
            btn.addEventListener('mouseover', () => { btn.style.background = 'rgba(239,68,68,0.15)'; });
            btn.addEventListener('mouseout',  () => { btn.style.background = 'transparent'; });
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sessionId = btn.dataset.sessionId;
                const confirmMsg = t
                    ? 'Bu pratik seansını silmek istediğine emin misin? Bu işlem geri alınamaz.'
                    : 'Are you sure you want to delete this practice session? This cannot be undone.';
                const confirmed = await showCustomConfirm(confirmMsg, t ? 'Sil' : 'Delete', t ? 'İptal' : 'Cancel');
                if (!confirmed) return;

                try {
                    btn.disabled = true;
                    await dbDeletePracticeSession(sessionId);
                    showToast(t ? 'Seans silindi ✓' : 'Session deleted ✓', 'success');
                    await loadAndRenderSessions(currentLang);
                } catch (err) {
                    console.error('[SessionHistory] Silme hatası:', err);
                    showToast(t ? 'Seans silinemedi.' : 'Could not delete session.', 'error');
                    btn.disabled = false;
                }
            });
        });

    } catch (err) {
        console.warn('[SessionHistory] Yüklenemedi:', err);
        if (listEl) listEl.innerHTML = `<p style="color:rgba(239,68,68,0.7);font-size:0.82rem;">${t ? 'Seanslar yüklenemedi.' : 'Could not load sessions.'}</p>`;
    }
}