// learningPathAdvisor.js - Kural tabanlı öğrenme yolu önerisi
// ✅ YENİ DOSYA (Adım 4.3) — API gerektirmez, tamamen istemci taraflı
// ✅ DÜZELTME: Tüm "Çalışıyorum" etiketleri gösteriliyor, video detayı eklendi

// ─────────────────────────────────────────────────────────────
// buildLearningProfile — Video listesinden öğrenme profili çıkar
// ─────────────────────────────────────────────────────────────
export function buildLearningProfile(videos) {
    const tagStats = new Map();

    videos.forEach(video => {
        if (!video.tags) return;
        const tags = video.tags.split(',').map(t => t.trim()).filter(Boolean);
        const status = video.learning_status || 'new';
        tags.forEach(tag => {
            if (!tagStats.has(tag)) {
                tagStats.set(tag, { total: 0, new: 0, learning: 0, mastered: 0, learningVideos: [] });
            }
            const s = tagStats.get(tag);
            s.total++;
            if (status === 'mastered') s.mastered++;
            else if (status === 'learning') {
                s.learning++;
                s.learningVideos.push(video);
            } else s.new++;
        });
    });

    const tagList = Array.from(tagStats.entries()).map(([tag, s]) => ({
        tag,
        total: s.total,
        new: s.new,
        learning: s.learning,
        mastered: s.mastered,
        learningVideos: s.learningVideos,
        masteryRate: s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0
    }));

    const totalVideos = videos.length;
    const masteredVideos = videos.filter(v => v.learning_status === 'mastered').length;
    const learningVideos = videos.filter(v => v.learning_status === 'learning').length;
    const newVideos = videos.filter(v => !v.learning_status || v.learning_status === 'new').length;

    return {
        tagList,
        totalVideos,
        masteredVideos,
        learningVideos,
        newVideos,
        masteryRate: totalVideos > 0 ? Math.round((masteredVideos / totalVideos) * 100) : 0
    };
}

// ─────────────────────────────────────────────────────────────
// computeLearningAdvice — Kural tabanlı öneri üret
// ─────────────────────────────────────────────────────────────
export function computeLearningAdvice(profile) {
    const { tagList } = profile;
    if (!tagList || tagList.length === 0) return null;

    // ── "Hemen Devam Et" — TÜM "learning" etiketleri (sadece biri değil)
    const continueTags = tagList
        .filter(t => t.learning > 0)
        .sort((a, b) => b.learning - a.learning || b.total - a.total);

    // ── "Sıradaki Öğrenim" — Hiç başlanmamış, en fazla video olan
    const nextCandidates = tagList
        .filter(t => t.learning === 0 && t.mastered === 0 && t.new > 0)
        .sort((a, b) => b.total - a.total);
    const nextTag = nextCandidates[0] || null;

    // ── "Ustalaşmaya Yakın" — learning var, masteryRate en yüksek
    const almostCandidates = tagList
        .filter(t => t.learning > 0 && t.masteryRate < 100 && t.masteryRate > 0)
        .sort((a, b) => b.masteryRate - a.masteryRate);
    const almostTag = almostCandidates[0] || null;

    // ── "Dikkat Gerektiriyor" — çok video var ama hiç ustalaşılmamış
    const neglectedCandidates = tagList
        .filter(t => t.total >= 3 && t.mastered === 0 && t.learning === 0)
        .sort((a, b) => b.total - a.total);
    const neglectedTag = neglectedCandidates[0] || null;

    return { continueTags, nextTag, almostTag, neglectedTag };
}

// ─────────────────────────────────────────────────────────────
// renderLearningPathCard — İstatistikler sayfasına kart render et
// ─────────────────────────────────────────────────────────────
export function renderLearningPathCard(videos, currentLang) {
    const container = document.getElementById('learning-path-container');
    if (!container) return;

    const profile = buildLearningProfile(videos);
    const advice  = computeLearningAdvice(profile);
    const isTr    = currentLang === 'tr';

    if (profile.totalVideos === 0) {
        container.innerHTML = '';
        return;
    }

    // ── Genel durum satırı
    const overallHtml = `
        <div class="lp-overall">
            <span class="lp-stat">📊 ${isTr ? 'Toplam' : 'Total'}: <strong>${profile.totalVideos}</strong></span>
            <span class="lp-stat">✅ ${isTr ? 'Ustalaştım' : 'Mastered'}: <strong>${profile.masteredVideos}</strong></span>
            <span class="lp-stat">📚 ${isTr ? 'Çalışıyorum' : 'Learning'}: <strong>${profile.learningVideos}</strong></span>
            <span class="lp-stat">🆕 ${isTr ? 'Yeni' : 'New'}: <strong>${profile.newVideos}</strong></span>
            <span class="lp-stat lp-rate">🏆 %${profile.masteryRate} ${isTr ? 'tamamlandı' : 'complete'}</span>
        </div>
    `;

    // ── Hiç çalışma yoksa
    const hasAnyProgress = profile.learningVideos > 0 || profile.masteredVideos > 0;
    if (!hasAnyProgress) {
        container.innerHTML = `
            <div class="learning-path-card">
                <div class="lp-header">
                    <span class="lp-icon">🤖</span>
                    <span>${isTr ? 'Öğrenme Yolu Önerisi' : 'Learning Path Advice'}</span>
                </div>
                ${overallHtml}
                <div class="lp-empty">
                    📚 ${isTr
                        ? 'Henüz hiç video çalışılmamış. Ana sayfada bir videoyu "Çalışıyorum" olarak işaretle ve öneri almaya başla.'
                        : 'No videos marked as learning yet. Go to the library and mark a video as "Learning" to get advice.'}
                </div>
            </div>
        `;
        _attachRefreshBtn(videos, currentLang);
        return;
    }

    let suggestionsHtml = '';

    // ── "Hemen Devam Et" — TÜM çalışılan etiketler
    if (advice && advice.continueTags && advice.continueTags.length > 0) {
        const tagsHtml = advice.continueTags.map(t => {
            // Bu etiketteki çalışılan videoların eğitmen adlarını listele
            const instructorNames = [...new Set(
                t.learningVideos
                    .map(v => v.instructors?.name || v.instructor_name || null)
                    .filter(Boolean)
            )].slice(0, 3).join(', ');

            const videoDetail = instructorNames
                ? `${t.learning} video • ${instructorNames}`
                : `${t.learning} video ${isTr ? 'çalışıyorsun' : 'in progress'}`;

            return `
                <div class="lp-continue-tag-row">
                    <span class="lp-tag-badge">#${t.tag}</span>
                    <span class="lp-tag-meta">${videoDetail}, ${t.mastered} ${isTr ? 'ustalaştın' : 'mastered'}</span>
                </div>
            `;
        }).join('');

        suggestionsHtml += `
            <div class="lp-suggestion lp-continue">
                <div class="lp-suggestion-icon">🎯</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Hemen Devam Et' : 'Keep Going'}</div>
                    <div class="lp-continue-tags">${tagsHtml}</div>
                </div>
            </div>
        `;
    }

    // ── "Sıradaki Öğrenim"
    if (advice && advice.nextTag) {
        suggestionsHtml += `
            <div class="lp-suggestion lp-next">
                <div class="lp-suggestion-icon">📚</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Sıradaki Öğrenim' : 'Next to Learn'}</div>
                    <div class="lp-suggestion-detail">
                        <span class="lp-tag-badge">#${advice.nextTag.tag}</span>
                        ${isTr
                            ? `${advice.nextTag.total} videon var, henüz hiç başlamadın`
                            : `${advice.nextTag.total} videos available, not started yet`}
                    </div>
                </div>
            </div>
        `;
    }

    // ── "Ustalaşmaya Yakın"
    if (advice && advice.almostTag) {
        suggestionsHtml += `
            <div class="lp-suggestion lp-almost">
                <div class="lp-suggestion-icon">⭐</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Ustalaşmaya Yakın' : 'Almost Mastered'}</div>
                    <div class="lp-suggestion-detail">
                        <span class="lp-tag-badge">#${advice.almostTag.tag}</span>
                        ${isTr
                            ? `%${advice.almostTag.masteryRate} tamamlandı — ${advice.almostTag.mastered}/${advice.almostTag.total} video`
                            : `${advice.almostTag.masteryRate}% complete — ${advice.almostTag.mastered}/${advice.almostTag.total} videos`}
                    </div>
                </div>
            </div>
        `;
    }

    // ── "Dikkat Gerektiriyor"
    if (advice && advice.neglectedTag) {
        suggestionsHtml += `
            <div class="lp-suggestion lp-neglected">
                <div class="lp-suggestion-icon">⚠️</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Dikkat Gerektiriyor' : 'Needs Attention'}</div>
                    <div class="lp-suggestion-detail">
                        <span class="lp-tag-badge">#${advice.neglectedTag.tag}</span>
                        ${isTr
                            ? `${advice.neglectedTag.total} videon var ama henüz hiç çalışılmadı`
                            : `${advice.neglectedTag.total} videos but none started yet`}
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="learning-path-card">
            <div class="lp-header">
                <span class="lp-icon">🤖</span>
                <span>${isTr ? 'Öğrenme Yolu Önerisi' : 'Learning Path Advice'}</span>
                <button id="lp-refresh-btn" class="lp-refresh-btn" title="${isTr ? 'Yenile' : 'Refresh'}">🔄</button>
            </div>
            ${overallHtml}
            <div class="lp-suggestions">${suggestionsHtml}</div>
        </div>
    `;

    _attachRefreshBtn(videos, currentLang);
}

function _attachRefreshBtn(videos, currentLang) {
    const btn = document.getElementById('lp-refresh-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        // Store'dan güncel videoları al (yenileme anındaki durum)
        import('./store.js').then(({ store }) => {
            renderLearningPathCard(store.get('globalVideos'), currentLang);
        });
    });
}