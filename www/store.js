// store.js - Merkezi state yönetimi (Observer pattern)
class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map(); // key -> callback[]
  }

  // State okuma
  get(key) {
    return this.state[key];
  }

  // Tüm state'i okuma (isteğe bağlı)
  getAll() {
    return { ...this.state };
  }

  // State güncelleme
  set(key, value, silent = false) {
    const oldValue = this.state[key];
    if (oldValue === value) return;
    this.state[key] = value;
    if (!silent) {
      this._notify(key, value, oldValue);
    }
  }

  // Belirli bir key'e abone ol
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    // İlk çağrıda mevcut değeri gönder
    callback(this.state[key], undefined, key);
    // Unsubscribe fonksiyonu döndür
    return () => this.unsubscribe(key, callback);
  }

  // Aboneliği kaldır
  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
      if (callbacks.length === 0) this.listeners.delete(key);
    }
  }

  // Tüm key'leri dinlemek için (isteğe bağlı)
  subscribeAll(callback) {
    // callback(state, changeInfo) şeklinde
    const handler = (newVal, oldVal, key) => {
      callback(this.state, { key, newVal, oldVal });
    };
    // Her key için ayrı ayrı eklemek yerine özel bir mekanizma kurabiliriz
    // Basitlik için şimdilik kullanmayacağız, ama ileride gerekebilir.
    // Şimdilik sadece key bazlı abonelik yeterli.
  }

  _notify(key, newVal, oldVal) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => {
        try {
          cb(newVal, oldVal, key);
        } catch (err) {
          console.error(`Store notification error for key "${key}":`, err);
        }
      });
    }
  }
}

// Başlangıç state'i
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

// Geliştirme yardımı (opsiyonel)
if (typeof window !== 'undefined') {
  window.__store = store;
}