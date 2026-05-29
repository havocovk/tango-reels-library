// www/store.js
// Merkezi state yönetimi (henüz kullanılmıyor, sadece dosya var)
class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map();
    this.globalListeners = [];
  }

  set(key, value, silent = false) {
    const oldValue = this.state[key];
    if (oldValue === value) return;
    this.state[key] = value;
    if (!silent) this._notify(key, value, oldValue);
  }

  get(key) {
    return this.state[key];
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(callback);
    callback(this.state[key], undefined, key);
    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      const idx = this.listeners.get(key).indexOf(callback);
      if (idx !== -1) this.listeners.get(key).splice(idx, 1);
    }
  }

  _notify(key, newVal, oldVal) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(newVal, oldVal, key));
    }
    this.globalListeners.forEach(cb => cb(this.state, { key, newVal, oldVal }));
  }
}

const initialState = {
  currentLang: 'tr',
  globalVideos: [],
  globalFavorites: [],
  currentView: 'library',
  visibleCount: 20,
  globalInstructors: [],
  editingVideoId: null,
  editInstructorId: null,
  loading: false,
};

export const store = new Store(initialState);

// Kolay erişim için (isteğe bağlı)
if (typeof window !== 'undefined') {
  window.__store = store;
}