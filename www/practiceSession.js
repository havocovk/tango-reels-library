// practiceSession.js - Odak Pratik Modu
// "Pratik Başlat" butonuna basıldığında tam ekran kart kart çalışma modunu yönetir.
// getDueVideos() listesini alır, sırayla gösterir.
// Kullanıcı her kart için "Çalıştım", "Geç" veya "İzle" seçeneği yapar.
// Oturum sonunda özet ekranı gösterilir.

import { store } from './store.js';
import { dbUpdateLearningStatus } from './tangoVeritabani.js';
import { getDueTodayCount } from './learning/spacedRepetition.js';
import { showToast } from './toast.js';

// ─────────────────────────────────────────────────────────────
// OTURUM STATE'İ
// ─────────────────────────────────────────────────────────────
let sessionQueue      = [];   // çalışılacak video listesi
let currentIndex      = 0;    // şu anki sıra
let startTime         = null; // oturum başlama zamanı
let practicedIds      = [];   // "Çalıştım" denilen video id'leri
let skippedIds        = [];   // "Geç" denilen video id'leri
let _callSwitchView   = null; // navigation.js'den geçirilen fonksiyon
let currentLang       = 'tr';

// ─────────────────────────────────────────────────────────────
// init — navigation ve dil bağlantısı
// ─────────────────────────────────────────────────────────────
export function initPracticeSession(callSwitchViewFn) {
    _callSwitchView = callSwitchViewFn;
}

// ─────────────────────────────────────────────────────────────
// startPracticeSession(videoQueue)
// Dışarıdan çağrılır (app.js içinden).
// videoQueue = getDueVideos() sonucu
// ─────────────────────────────────────────────────────────────
export function startPracticeSession(videoQueue) {
    sessionQueue  = [...videoQueue];
    currentIndex  = 0;
    startTime     = Date.now();
    practicedIds  = [];
    skippedIds    = [];
    currentLang   = store.get('currentLang');

    // Pratik ekranına geç
    if (_callSwitchView) _callSwitchView('practiceSession');

    // Özet gizle, aktif ekranı göster
    const activeScreen  = document.getElementById('practice-active-screen');
    const summaryScreen = document.getElementById('practice-summary-screen');
    if (activeScreen)  activeScreen.classList.remove('d-none');
    if (summaryScreen) summaryScreen.classList.add('d-none');

    // Çıkış butonu
    const exitBtn = document.getElementById('practice-exit-btn');
    if (exitBtn) exitBtn.onclick = () => exitSession();

    showCurrentCard();
}

// ─────────────────────────────────────────────────────────────
// showCurrentCard()
// Sıradaki videoyu ekrana basar.
// ─────────────────────────────────────────────────────────────
function showCurrentCard() {
    const video = sessionQueue[currentIndex];
    if (!video) { endSession(); return; }

    const lang = currentLang;
    const total = sessionQueue.length;
    const current = currentIndex + 1;

    // ── İlerleme çubuğu ──
    const progressBar  = document.getElementById('practice-progress-bar');
    const progressText = document.getElementById('practice-progress-text');
    const pct = Math.round(((currentIndex) / total) * 100);
    if (progressBar)  progressBar.style.width = pct + '%';
    if (progressText) progressText.textContent = `${current} / ${total}`;

    // ── Kapak resmi ──
    const defaultCover = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800';
    const coverImg = document.getElementById('practice-cover-img');
    if (coverImg) {
        coverImg.style.backgroundImage = `url('${video.cover_url || defaultCover}')`;
    }

    // ── İzle butonu (kapak üstündeki play) ──
    const playBtn = document.getElementById('practice-play-btn');
    const watchLabel = document.getElementById('practice-watch-label');
    if (watchLabel) watchLabel.textContent = lang === 'tr' ? 'İzle' : 'Watch';
    if (playBtn) {
        playBtn.onclick = () => watchVideo(video);
    }

    // ── Eğitmen ──
    const instructorEl = document.getElementById('practice-instructor-name');
    if (instructorEl) {
        instructorEl.textContent = '👤 ' + (video.instructors?.name || video.instructor_name || '—');
    }

    // ── Partner ──
    const partnerEl = document.getElementById('practice-partner-name');
    if (partnerEl) {
        partnerEl.textContent = video.partner_name ? ('👥 ' + video.partner_name) : '';
    }

    // ── Badge'ler (rol + öğrenme durumu) ──
    const badgesRow = document.getElementById('practice-badges-row');
    if (badgesRow) {
        const roleMap = {
            Leader:   lang === 'tr' ? 'Lider'    : 'Leader',
            Follower: lang === 'tr' ? 'Takipçi'  : 'Follower',
            Both:     lang === 'tr' ? 'Çift'     : 'Couple'
        };
        const roleClass = {
            Leader: 'badge-leader', Follower: 'badge-follower', Both: 'badge-both'
        };
        const role = video.role_type || 'Both';
        const roleDisplay = roleMap[role] || role;
        const roleCls = roleClass[role] || 'badge-both';

        const statusMap = {
            new:      lang === 'tr' ? '🆕 Yeni'         : '🆕 New',
            learning: lang === 'tr' ? '📚 Çalışıyorum'  : '📚 Learning',
            mastered: lang === 'tr' ? '✅ Ustalaştım'   : '✅ Mastered'
        };
        const statusClassMap = {
            new: 'badge-learning-new',
            learning: 'badge-learning-active',
            mastered: 'badge-learning-mastered'
        };
        const status = video.learning_status || 'new';

        badgesRow.innerHTML = `
            <span class="badge ${roleCls}">${roleDisplay}</span>
            <span class="badge ${statusClassMap[status]}">${statusMap[status]}</span>
        `;
    }

    // ── Etiketler ──
    const tagsRow = document.getElementById('practice-tags-row');
    if (tagsRow) {
        if (video.tags && video.tags.trim()) {
            const tags = video.tags.split(',').map(t => t.trim()).filter(Boolean);
            tagsRow.innerHTML = tags.map(t =>
                `<span class="badge" style="background:rgba(255,255,255,0.05);color:#cbd5e1;border:1px solid rgba(255,255,255,0.1);font-size:0.75rem;padding:3px 8px;">#${t}</span>`
            ).join('');
        } else {
            tagsRow.innerHTML = '';
        }
    }

    // ── Not ──
    const noteEl = document.getElementById('practice-note-text');
    if (noteEl) {
        noteEl.textContent = video.notes ? ('📝 ' + video.notes) : '';
    }

    // ── Aksiyon butonları ──
    const skipBtn  = document.getElementById('btn-practice-skip');
    const watchBtn = document.getElementById('btn-practice-watch');
    const doneBtn  = document.getElementById('btn-practice-done');

    const skipLabel  = document.getElementById('skip-label');
    const watchBtnLabel = document.getElementById('watch-label');
    const doneLabel  = document.getElementById('done-label');

    if (skipLabel)     skipLabel.textContent  = lang === 'tr' ? 'Geç'      : 'Skip';
    if (watchBtnLabel) watchBtnLabel.textContent = lang === 'tr' ? 'İzle'  : 'Watch';
    if (doneLabel)     doneLabel.textContent  = lang === 'tr' ? 'Çalıştım' : 'Done';

    if (skipBtn) skipBtn.onclick = () => skipCard();
    if (watchBtn) watchBtn.onclick = () => watchVideo(video);
    if (doneBtn) doneBtn.onclick = () => markPracticed(video);
}

// ─────────────────────────────────────────────────────────────
// watchVideo(video)
// Videoyu yeni sekmede açar.
// ─────────────────────────────────────────────────────────────
function watchVideo(video) {
    const url = video.drive_url || video.url;
    if (url) window.open(url, '_blank');
}

// ─────────────────────────────────────────────────────────────
// markPracticed(video)
// "Çalıştım" butonuna basıldı:
// 1. DB'de last_reviewed_at ve review_count güncellenir
// 2. Store lokalde güncellenir
// 3. Sonraki karta geçilir
// ─────────────────────────────────────────────────────────────
async function markPracticed(video) {
    try {
        const currentReviewCount = video.review_count || 0;
        const updatedVideo = await dbUpdateLearningStatus(
            video.id,
            video.learning_status || 'learning',
            currentReviewCount,
            video.updated_at
        );
        if (updatedVideo) {
            store.updateVideoLocally(video.id, {
                learning_status: updatedVideo.learning_status,
                last_reviewed_at: updatedVideo.last_reviewed_at,
                review_count: updatedVideo.review_count,
                updated_at: updatedVideo.updated_at
            });
        }
        practicedIds.push(video.id);

        // dueTodayCount'u güncelle
        const updatedVideos = store.get('globalVideos');
        store.set('dueTodayCount', getDueTodayCount(updatedVideos));

    } catch (err) {
        console.error('Pratik kaydı hatası:', err);
        showToast(currentLang === 'tr' ? 'Kayıt hatası, devam ediliyor...' : 'Save error, continuing...', 'error');
        practicedIds.push(video.id); // hata olsa bile ilerle
    }
    nextCard();
}

// ─────────────────────────────────────────────────────────────
// skipCard()
// "Geç" butonuna basıldı: db güncelleme olmadan ileri geç
// ─────────────────────────────────────────────────────────────
function skipCard() {
    const video = sessionQueue[currentIndex];
    if (video) skippedIds.push(video.id);
    nextCard();
}

// ─────────────────────────────────────────────────────────────
// nextCard()
// Sıradaki karta geç. Kuyruk bitti ise endSession çağır.
// ─────────────────────────────────────────────────────────────
function nextCard() {
    currentIndex++;
    if (currentIndex >= sessionQueue.length) {
        endSession();
    } else {
        showCurrentCard();
    }
}

// ─────────────────────────────────────────────────────────────
// endSession()
// Oturum bitti: süreyi hesapla, özet ekranını göster.
// ─────────────────────────────────────────────────────────────
function endSession() {
    const lang = currentLang;
    const elapsedMs  = Date.now() - startTime;
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Aktif ekranı gizle, özet ekranını göster
    const activeScreen  = document.getElementById('practice-active-screen');
    const summaryScreen = document.getElementById('practice-summary-screen');
    if (activeScreen)  activeScreen.classList.add('d-none');
    if (summaryScreen) summaryScreen.classList.remove('d-none');

    // Başlık
    const summaryTitle = document.getElementById('summary-title');
    if (summaryTitle) summaryTitle.textContent = lang === 'tr' ? '🎉 Pratik Tamamlandı!' : '🎉 Practice Complete!';

    // İstatistikler
    const practicedCount = document.getElementById('summary-practiced-count');
    const skippedCount   = document.getElementById('summary-skipped-count');
    const durationEl     = document.getElementById('summary-duration');
    if (practicedCount) practicedCount.textContent = practicedIds.length;
    if (skippedCount)   skippedCount.textContent   = skippedIds.length;
    if (durationEl)     durationEl.textContent     = durationStr;

    // Etiketler
    const practicedLabel = document.getElementById('summary-practiced-label');
    const skippedLabel   = document.getElementById('summary-skipped-label');
    const durationLabel  = document.getElementById('summary-duration-label');
    if (practicedLabel) practicedLabel.textContent = lang === 'tr' ? 'Çalışıldı' : 'Practiced';
    if (skippedLabel)   skippedLabel.textContent   = lang === 'tr' ? 'Geçildi'   : 'Skipped';
    if (durationLabel)  durationLabel.textContent  = lang === 'tr' ? 'Süre'      : 'Duration';

    // Motivasyon mesajı
    const msgEl = document.getElementById('summary-message');
    if (msgEl) {
        const pct = sessionQueue.length > 0
            ? Math.round((practicedIds.length / sessionQueue.length) * 100)
            : 0;
        let msg = '';
        if (lang === 'tr') {
            if (pct === 100) msg = 'Mükemmel! Tüm kombinasyonları çalıştın. 💪';
            else if (pct >= 70) msg = 'Harika gidiyor! Devam et. 🔥';
            else if (pct >= 40) msg = 'İyi başlangıç. Yarın kalan kombinasyonları tamamla. 👍';
            else msg = 'Bugün bir adım attın. Küçük adımlar büyük fark yaratır. 🌱';
        } else {
            if (pct === 100) msg = 'Perfect! You practiced all combinations. 💪';
            else if (pct >= 70) msg = 'Great job! Keep going. 🔥';
            else if (pct >= 40) msg = 'Good start. Finish the rest tomorrow. 👍';
            else msg = 'You took a step today. Small steps make a big difference. 🌱';
        }
        msgEl.textContent = msg;
    }

    // "Koleksiyona Dön" butonu
    const returnBtn = document.getElementById('btn-practice-return');
    if (returnBtn) {
        returnBtn.textContent = lang === 'tr' ? '📚 Koleksiyona Dön' : '📚 Back to Collection';
        returnBtn.onclick = () => {
            if (_callSwitchView) _callSwitchView('library');
        };
    }
}

// ─────────────────────────────────────────────────────────────
// exitSession()
// "Çıkış" butonuna basıldı: onaysız koleksiyona dön
// ─────────────────────────────────────────────────────────────
function exitSession() {
    if (_callSwitchView) _callSwitchView('library');
}
