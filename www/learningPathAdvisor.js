// learningPathAdvisor.js - Kural tabanlı öğrenme yolu önerisi
// ✅ YENİ DOSYA (Adım 4.3) — API gerektirmez, tamamen istemci taraflı

// ─────────────────────────────────────────────────────────────
// buildLearningProfile — Video listesinden öğrenme profili çıkar
// ─────────────────────────────────────────────────────────────
export function buildLearningProfile(videos) {
    const tagStats = new Map();
    // Her etiket için sayaçları başlat
    videos.forEach(video => {
        if (!video.tags) return;
        const tags = video.tags.split(',').map(t => t.trim()).filter(Boolean);
        const status = video.learning_status || 'new';
        tags.forEach(tag => {
            if (!tagStats.has(tag)) {
                tagStats.set(tag, { total: 0, new: 0, learning: 0, mastered: 0 });
            }
            const s = tagStats.get(tag);
            s.total++;
            if (status === 'mastered') s.mastered++;
            else if (status === 'learning') s.learning++;
            else s.new++;
        });
    });

    // Her etiketi diziye çevir ve oran hesapla
    const tagList = Array.from(tagStats.entries()).map(([tag, s]) => ({
        tag,
        total: s.total,
        new: s.new,
        learning: s.learning,
        mastered: s.mastered,
        masteryRate: s.total > 0 ? Math.round((s.mastered / s.total) * 100) : 0
    }));

    // Genel istatistikler
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

    // ── Kural 1: "Hemen Devam Et" ──
    // "learning" statüsünde en çok videon olan etiket
    const continueCandidates = tagList
        .filter(t => t.learning > 0)
        .sort((a, b) => b.learning - a.learning || b.total - a.total);
    const continueTag = continueCandidates[0] || null;

    // ── Kural 2: "Sıradaki Öğrenim" ──
    // Hiç başlanmamış (all new) ama en fazla videon olan etiket
    const nextCandidates = tagList
        .filter(t => t.learning === 0 && t.mastered === 0 && t.new > 0)
        .sort((a, b) => b.total - a.total);
    const nextTag = nextCandidates[0] || null;

    // ── Kural 3: "Ustalaşmaya Yakın" ──
    // "learning" statüsünde, masteryRate en yüksek (ama %100 değil) etiket
    const almostCandidates = tagList
        .filter(t => t.learning > 0 && t.masteryRate < 100 && t.masteryRate > 0)
        .sort((a, b) => b.masteryRate - a.masteryRate);
    const almostTag = almostCandidates[0] || null;

    // ── En az ilerlenen ──
    // Çok videosu olup hiç ustalaşılmamış etiket (uyarı amaçlı)
    const neglectedCandidates = tagList
        .filter(t => t.total >= 3 && t.mastered === 0)
        .sort((a, b) => b.total - a.total);
    const neglectedTag = neglectedCandidates[0] || null;

    return {
        continueTag,
        nextTag,
        almostTag,
        neglectedTag
    };
}

// ─────────────────────────────────────────────────────────────
// renderLearningPathCard — İstatistikler sayfasına kart render et
// ─────────────────────────────────────────────────────────────
export function renderLearningPathCard(videos, currentLang) {
    const container = document.getElementById('learning-path-container');
    if (!container) return;

    const profile  = buildLearningProfile(videos);
    const advice   = computeLearningAdvice(profile);
    const isTr     = currentLang === 'tr';

    // Video yoksa kart gösterme
    if (profile.totalVideos === 0) {
        container.innerHTML = '';
        return;
    }

    // Öneri yoksa (hepsi yeni, hiç çalışılmamış)
    if (!advice || (!advice.continueTag && !advice.nextTag && !advice.almostTag)) {
        container.innerHTML = `
            <div class="learning-path-card">
                <div class="lp-header">
                    <span class="lp-icon">🤖</span>
                    <span>${isTr ? 'Öğrenme Yolu Önerisi' : 'Learning Path Advice'}</span>
                </div>
                <div class="lp-empty">
                    ${isTr
                        ? '📚 Henüz hiç video çalışılmamış. Bir videoyu "Çalışıyorum" olarak işaretle ve öneri almaya başla.'
                        : '📚 No videos marked as learning yet. Mark a video as "Learning" to get advice.'}
                </div>
            </div>
        `;
        return;
    }

    // Genel durum satırı
    const overallHtml = `
        <div class="lp-overall">
            <span class="lp-stat">📊 ${isTr ? 'Toplam' : 'Total'}: <strong>${profile.totalVideos}</strong></span>
            <span class="lp-stat">✅ ${isTr ? 'Ustalaştım' : 'Mastered'}: <strong>${profile.masteredVideos}</strong></span>
            <span class="lp-stat">📚 ${isTr ? 'Çalışıyorum' : 'Learning'}: <strong>${profile.learningVideos}</strong></span>
            <span class="lp-stat">🆕 ${isTr ? 'Yeni' : 'New'}: <strong>${profile.newVideos}</strong></span>
            <span class="lp-stat lp-rate">🏆 %${profile.masteryRate} ${isTr ? 'tamamlandı' : 'complete'}</span>
        </div>
    `;

    // Öneri satırları
    let suggestionsHtml = '';

    if (advice.continueTag) {
        suggestionsHtml += `
            <div class="lp-suggestion lp-continue">
                <div class="lp-suggestion-icon">🎯</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Hemen Devam Et' : 'Keep Going'}</div>
                    <div class="lp-suggestion-detail">
                        <span class="lp-tag-badge">#${advice.continueTag.tag}</span>
                        ${isTr
                            ? `${advice.continueTag.learning} video çalışıyorsun, ${advice.continueTag.mastered} ustalaştın`
                            : `${advice.continueTag.learning} in progress, ${advice.continueTag.mastered} mastered`}
                    </div>
                </div>
            </div>
        `;
    }

    if (advice.nextTag) {
        suggestionsHtml += `
            <div class="lp-suggestion lp-next">
                <div class="lp-suggestion-icon">📚</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Sıradaki Öğrenim' : 'Next to Learn'}</div>
                    <div class="lp-suggestion-detail">
                        <span class="lp-tag-badge">#${advice.nextTag.tag}</span>
                        ${isTr
                            ? `${advice.nextTag.total} video var, henüz hiç başlamadın`
                            : `${advice.nextTag.total} videos available, not started yet`}
                    </div>
                </div>
            </div>
        `;
    }

    if (advice.almostTag) {
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

    if (advice.neglectedTag && advice.neglectedTag.tag !== advice.nextTag?.tag) {
        suggestionsHtml += `
            <div class="lp-suggestion lp-neglected">
                <div class="lp-suggestion-icon">⚠️</div>
                <div class="lp-suggestion-content">
                    <div class="lp-suggestion-title">${isTr ? 'Dikkat Gerektiriyor' : 'Needs Attention'}</div>
                    <div class="lp-suggestion-detail">
                        <span class="lp-tag-badge">#${advice.neglectedTag.tag}</span>
                        ${isTr
                            ? `${advice.neglectedTag.total} videon var ama hiç ustalaşılmadı`
                            : `${advice.neglectedTag.total} videos but none mastered yet`}
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

    // Yenile butonu
    const refreshBtn = document.getElementById('lp-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            renderLearningPathCard(videos, currentLang);
        });
    }
}