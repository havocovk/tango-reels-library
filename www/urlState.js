// urlState.js - URL durum senkronizasyonu
// ✅ YENİ DOSYA (Adım 3.2)
// Filtre durumunu URL'e yazar/okur.
// Sayfa yenilenince veya link paylaşılınca filtreler korunur.

// ─────────────────────────────────────────────────────────────
// writeUrlState — Mevcut filtre durumunu URL'e yaz
// Örnek: ?view=library&instructor=3&platform=youtube&tag=giro&status=learning
// ─────────────────────────────────────────────────────────────
export function writeUrlState(state = {}) {
    try {
        const params = new URLSearchParams();

        if (state.view && state.view !== 'library') params.set('view', state.view);
        if (state.instructor && state.instructor !== 'all') params.set('instructor', state.instructor);
        if (state.platform && state.platform !== 'all') params.set('platform', state.platform);
        if (state.tag && state.tag !== 'all') params.set('tag', state.tag);
        if (state.status && state.status !== 'all') params.set('status', state.status);
        if (state.role && state.role !== 'all') params.set('role', state.role);
        if (state.date && state.date !== 'all') params.set('date', state.date);
        if (state.search && state.search.trim()) params.set('search', state.search.trim());

        const queryString = params.toString();
        const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        history.replaceState({}, '', newUrl);
    } catch (e) {
        // URL yazma başarısız olursa sessizce geç
    }
}

// ─────────────────────────────────────────────────────────────
// readUrlState — URL'den filtre durumunu oku
// Yoksa null döner
// ─────────────────────────────────────────────────────────────
export function readUrlState() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (!params.toString()) return null;

        return {
            view:       params.get('view')       || 'library',
            instructor: params.get('instructor') || 'all',
            platform:   params.get('platform')   || 'all',
            tag:        params.get('tag')         || 'all',
            status:     params.get('status')      || 'all',
            role:       params.get('role')        || 'all',
            date:       params.get('date')        || 'all',
            search:     params.get('search')      || ''
        };
    } catch (e) {
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// applyUrlStateToUI — Okunan URL durumunu dropdown'lara uygula
// ─────────────────────────────────────────────────────────────
export function applyUrlStateToUI(state) {
    if (!state) return;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val && val !== 'all') el.value = val;
    };

    set('filter-instructor-select', state.instructor);
    set('filter-platform-select', state.platform);
    set('filter-tag-select', state.tag);
    set('filter-learning-status-select', state.status);
    set('filter-role-select', state.role);
    set('filter-date-select', state.date);

    if (state.search) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = state.search;
    }
}

// ─────────────────────────────────────────────────────────────
// clearUrlState — URL'yi temizle
// ─────────────────────────────────────────────────────────────
export function clearUrlState() {
    try {
        history.replaceState({}, '', window.location.pathname);
    } catch (e) {}
}