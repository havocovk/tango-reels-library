// badgeSystem.js - Rozet & Hedef Takibi (Adım 10)
// Tamamen istemci taraflı — DB'den gelen verilerle çalışır

import { icon } from './icons.js';

// ─────────────────────────────────────────────────────────────
// ROZET TANIMLARI
// ─────────────────────────────────────────────────────────────

export const MONTHLY_BADGES = [
    { id: 'aktif',        nameTr: 'Aktif',         nameEn: 'Active',      threshold: 2,  iconName: 'zap',    color: '#f59e0b' },
    { id: 'kararli',      nameTr: 'Kararlı',       nameEn: 'Committed',   threshold: 6,  iconName: 'flame',  color: '#ff007f' },
    { id: 'disiplinli',   nameTr: 'Disiplinli',    nameEn: 'Disciplined', threshold: 10, iconName: 'target', color: '#c026d3' },
    { id: 'ay-sampiyonu', nameTr: 'Ay Şampiyonu',  nameEn: 'Champion',    threshold: 13, iconName: 'trophy', color: '#00f0ff' },
];

export const CUMULATIVE_PRACTICE_BADGES = [
    { id: 'ilk-hareket', nameTr: 'İlk Hareket', nameEn: 'First Move',   threshold: 5,  iconName: 'play',     color: '#4ade80' },
    { id: 'isinma',      nameTr: 'Isınma',       nameEn: 'Warm Up',      threshold: 15, iconName: 'activity', color: '#00f0ff' },
    { id: 'ritim',       nameTr: 'Ritim',         nameEn: 'Rhythm',       threshold: 25, iconName: 'repeat',   color: '#ff007f' },
    { id: 'akis',        nameTr: 'Akış',           nameEn: 'Flow',         threshold: 50, iconName: 'flame',    color: '#f59e0b' },
    { id: 'dans-ustasi', nameTr: 'Dans Ustası',   nameEn: 'Dance Master', threshold: 70, iconName: 'medal',    color: '#c026d3' },
];

export const COLLECTION_BADGES = [
    { id: 'baslangic',         nameTr: 'Başlangıç',         nameEn: 'Beginner',    threshold: 25,  iconName: 'sprout',  color: '#4ade80' },
    { id: 'koleksiyoner',      nameTr: 'Koleksiyoner',      nameEn: 'Collector',   threshold: 100, iconName: 'library', color: '#00f0ff' },
    { id: 'arsivci',           nameTr: 'Arşivci',           nameEn: 'Archivist',   threshold: 250, iconName: 'archive', color: '#f59e0b' },
    { id: 'usta-koleksiyoner', nameTr: 'Usta Koleksiyoner', nameEn: 'Expert',      threshold: 500, iconName: 'trophy',  color: '#ff007f' },
    { id: 'efsane',            nameTr: 'Efsane',            nameEn: 'Legend',      threshold: 1000,iconName: 'crown',   color: '#c026d3' },
];

export const MASTERY_BADGES = [
    { id: 'ilk-ustalik',   nameTr: 'İlk Ustalık',   nameEn: 'First Mastery', threshold: 1,  iconName: 'star',      color: '#f59e0b' },
    { id: 'repertuar',     nameTr: 'Repertuar',      nameEn: 'Repertoire',    threshold: 5,  iconName: 'book-open', color: '#4ade80' },
    { id: 'teknik',        nameTr: 'Teknik',         nameEn: 'Technical',     threshold: 10, iconName: 'layers',    color: '#00f0ff' },
    { id: 'virtuoz',       nameTr: 'Virtüöz',        nameEn: 'Virtuoso',      threshold: 25, iconName: 'gem',       color: '#ff007f' },
    { id: 'tango-maestro', nameTr: 'Tango Maestro',  nameEn: 'Tango Maestro', threshold: 50, iconName: 'crown',     color: '#c026d3' },
];

// ─────────────────────────────────────────────────────────────
// computeBadgeData — tüm rozetler için kazanılmış/kazanılmamış hesapla
// ─────────────────────────────────────────────────────────────
export function computeBadgeData(videos, monthlyStats) {
    const now = new Date();
    const currentYear  = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Bu ayın pratik sayısı
    const thisMonthStat = (monthlyStats || []).find(
        s => s.year === currentYear && s.month === currentMonth
    );
    const thisMonthCount = thisMonthStat ? (thisMonthStat.practiced_count || 0) : 0;

    // Kümülatif pratik (tüm zamanlar)
    const totalPracticed = (monthlyStats || []).reduce(
        (sum, s) => sum + (s.practiced_count || 0), 0
    );

    // Video sayısı (sadece combination)
    const combinationVideos = videos.filter(v => !v.content_type || v.content_type === 'combination');
    const totalVideos = combinationVideos.length;

    // Ustalaşılan video sayısı
    const masteredCount = combinationVideos.filter(v => v.learning_status === 'mastered').length;

    return {
        thisMonthCount,
        totalPracticed,
        totalVideos,
        masteredCount,
        monthlyBadges:     MONTHLY_BADGES.map(b => ({ ...b, earned: thisMonthCount >= b.threshold })),
        practicesBadges:   CUMULATIVE_PRACTICE_BADGES.map(b => ({ ...b, earned: totalPracticed >= b.threshold })),
        collectionBadges:  COLLECTION_BADGES.map(b => ({ ...b, earned: totalVideos >= b.threshold })),
        masteryBadges:     MASTERY_BADGES.map(b => ({ ...b, earned: masteredCount >= b.threshold })),
    };
}

// ─────────────────────────────────────────────────────────────
// renderBadgeSection — HTML üretir
// ─────────────────────────────────────────────────────────────
function badgeHtml(badge, currentLang) {
    const name = currentLang === 'tr' ? badge.nameTr : badge.nameEn;
    const color = badge.earned ? badge.color : '#64748b';
    const textColor = badge.earned ? badge.color : '#94a3b8';
    const opacity = badge.earned ? '1' : '0.85';
    const glowStyle = badge.earned
        ? `box-shadow: 0 0 14px ${badge.color}55; border-color: ${badge.color}66;`
        : 'border-color: rgba(255,255,255,0.12);';

    return `
        <div class="badge-item ${badge.earned ? 'badge-earned' : 'badge-locked'}"
             title="${name} — ${badge.threshold}${currentLang === 'tr' ? '' : ' needed'}"
             style="opacity:${opacity}; ${glowStyle} border: 1px solid; border-radius: 14px;
                    padding: 12px 10px; display:flex; flex-direction:column;
                    align-items:center; gap:6px; background: rgba(11,8,19,0.5);
                    transition: all 0.2s ease; cursor:default;">
            <div style="color:${color};">
                ${icon(badge.iconName, { size: 22, color })}
            </div>
            <div style="font-size:0.68rem; font-weight:700; color:${textColor};
                        text-align:center; line-height:1.3; max-width:72px;">
                ${name}
            </div>
            <div style="font-size:0.6rem; color:${badge.earned ? '#4ade80' : '#64748b'};
                        font-weight:600;">
                ${badge.earned
                    ? (currentLang === 'tr' ? '✓ Kazanıldı' : '✓ Earned')
                    : `${badge.threshold}${currentLang === 'tr' ? ' gerekli' : ' needed'}`}
            </div>
        </div>`;
}

function groupHtml(titleTr, titleEn, badges, currentLang, statLine) {
    const title = currentLang === 'tr' ? titleTr : titleEn;
    const earnedCount = badges.filter(b => b.earned).length;
    return `
        <div class="badge-group" style="margin-bottom: 28px;">
            <div style="display:flex; align-items:center; justify-content:space-between;
                        margin-bottom:12px;">
                <div style="font-size:0.82rem; font-weight:700;
                            color:rgba(255,255,255,0.7); letter-spacing:0.3px;">
                    ${title}
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${statLine ? `<span style="font-size:0.75rem; color:#64748b;">${statLine}</span>` : ''}
                    <span style="font-size:0.72rem; color:#4ade80; font-weight:600;">
                        ${earnedCount}/${badges.length}
                    </span>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                ${badges.map(b => badgeHtml(b, currentLang)).join('')}
            </div>
        </div>`;
}

export function renderBadgePanel(badgeData, currentLang) {
    const container = document.getElementById('badge-panel-container');
    if (!container) return;

    const t = currentLang === 'tr';

    const monthName = new Date().toLocaleString(t ? 'tr-TR' : 'en-US', { month: 'long' });
    const monthStatLine = `${t ? 'Bu ay' : 'This month'}: ${badgeData.thisMonthCount} ${t ? 'pratik' : 'sessions'}`;
    const practiceStatLine = `${t ? 'Toplam' : 'Total'}: ${badgeData.totalPracticed} ${t ? 'pratik' : 'sessions'}`;
    const collectionStatLine = `${t ? 'Koleksiyon' : 'Collection'}: ${badgeData.totalVideos} ${t ? 'video' : 'videos'}`;
    const masteryStatLine = `${t ? 'Ustalaşılan' : 'Mastered'}: ${badgeData.masteredCount} ${t ? 'kombinasyon' : 'combinations'}`;

    container.innerHTML = `
        <div style="
            background: rgba(11,8,19,0.5);
            border: 1px solid rgba(0,240,255,0.15);
            border-radius: 20px;
            padding: 24px;
            margin-top: 30px;
        ">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:24px;">
                ${icon('trophy', { size: 20, color: '#f59e0b' })}
                <h3 style="font-size:1rem; font-weight:700;
                           background:linear-gradient(135deg,#f59e0b,#ff007f);
                           -webkit-background-clip:text; -webkit-text-fill-color:transparent;
                           margin:0;">
                    ${t ? 'Rozetler & Hedefler' : 'Badges & Goals'}
                </h3>
            </div>

            ${groupHtml(
                `${monthName} Ayı Rozetleri`, `${monthName} Monthly Badges`,
                badgeData.monthlyBadges, currentLang, monthStatLine
            )}
            ${groupHtml(
                'Pratik Rozetleri', 'Practice Badges',
                badgeData.practicesBadges, currentLang, practiceStatLine
            )}
            ${groupHtml(
                'Koleksiyon Rozetleri', 'Collection Badges',
                badgeData.collectionBadges, currentLang, collectionStatLine
            )}
            ${groupHtml(
                'Ustalık Rozetleri', 'Mastery Badges',
                badgeData.masteryBadges, currentLang, masteryStatLine
            )}
        </div>`;
}