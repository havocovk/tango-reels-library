// stats/computeStats.js - Sadece verilerden istatistik hesaplama (DOM/UI yok)
export function computeStats(videos, instructors) {
    const totalVideos = videos.length;
    const totalInstructors = instructors.length;
    let leaderCount = 0, followerCount = 0, bothCount = 0;
    videos.forEach(v => {
        if (v.role_type === 'Leader') leaderCount++;
        else if (v.role_type === 'Follower') followerCount++;
        else bothCount++;
    });
    const platformCounts = {
        drive: videos.filter(v => v.platform === 'drive').length,
        youtube: videos.filter(v => v.platform === 'youtube').length,
        instagram: videos.filter(v => v.platform === 'instagram').length,
        facebook: videos.filter(v => v.platform === 'facebook').length,
        other: videos.filter(v => !v.platform || v.platform === 'other').length
    };
    const tagMap = new Map();
    videos.forEach(v => {
        if (v.tags) {
            v.tags.split(',').forEach(t => {
                const tag = t.trim();
                if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });
    const topTags = Array.from(tagMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }));
    
    // 12 aylık periyot (Mayıs 2026'dan itibaren)
    const startDate = new Date(2026, 4, 1);
    const months = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
        months.push({
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            label: `${d.getMonth() + 1}/${d.getFullYear()}`,
            count: 0
        });
    }
    videos.forEach(v => {
        if (v.created_at) {
            const date = new Date(v.created_at);
            if (!isNaN(date)) {
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const found = months.find(m => m.year === year && m.month === month);
                if (found) found.count++;
            }
        }
    });
    return { totalVideos, totalInstructors, leaderCount, followerCount, bothCount, platformCounts, topTags, monthlyData: months };
}