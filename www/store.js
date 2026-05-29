// store.js - Merkezi State Yönetimi (Observer Pattern)
class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map(); // key -> [callback, callback, ...]
    this.globalListeners = [];   // '*' için
  }

  set(key, value, silent = false) {
    const oldValue = this.state[key];
    if (oldValue === value) return;
    this.state[key] = value;
    if (!silent) {
      this._notify(key, value, oldValue);
    }
  }

  setMultiple(updates, silent = false) {
    const changed = [];
    for (const [key, value] of Object.entries(updates)) {
      const oldValue = this.state[key];
      if (oldValue !== value) {
        this.state[key] = value;
        changed.push({ key, value, oldValue });
      }
    }
    if (!silent && changed.length) {
      changed.forEach(change => this._notify(change.key, change.value, change.oldValue));
    }
  }

  get(key) {
    return this.state[key];
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    callback(this.state[key], undefined, key);
    return () => this.unsubscribe(key, callback);
  }

  subscribeAll(callback) {
    this.globalListeners.push(callback);
    callback(this.state, undefined, '*');
    return () => {
      const index = this.globalListeners.indexOf(callback);
      if (index !== -1) this.globalListeners.splice(index, 1);
    };
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    }
  }

  _notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(newValue, oldValue, key));
    }
    this.globalListeners.forEach(cb => cb(this.state, { key, newValue, oldValue }, '*'));
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

if (typeof window !== 'undefined') {
  window.__store = store;
}