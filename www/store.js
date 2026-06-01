// store.js - Merkezi state yönetimi + yerel güncelleme metodları
// ✅ GÜNCELLEME (Adım 2.2): dueTodayCount: 0 eklendi
class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Map();
  }

  get(key) {
    return this.state[key];
  }

  getAll() {
    return { ...this.state };
  }

  set(key, value, silent = false) {
    const oldValue = this.state[key];
    if (oldValue === value) return;
    this.state[key] = value;
    if (!silent) {
      this._notify(key, value, oldValue);
    }
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    callback(this.state[key], undefined, key);
    return () => this.unsubscribe(key, callback);
  }

  unsubscribe(key, callback) {
    if (this.listeners.has(key)) {
      const callbacks = this.listeners.get(key);
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
      if (callbacks.length === 0) this.listeners.delete(key);
    }
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

  // ========= YEREL GÜNCELLEME METODLARI =========

  updateVideoLocally(videoId, updates) {
    const videos = this.get('globalVideos');
    const index = videos.findIndex(v => v.id === videoId);
    if (index !== -1) {
      const updatedVideo = { ...videos[index], ...updates };
      videos[index] = updatedVideo;
      this.set('globalVideos', [...videos]);
      return updatedVideo;
    }
    return null;
  }

  removeVideoLocally(videoId) {
    const videos = this.get('globalVideos');
    const newVideos = videos.filter(v => v.id !== videoId);
    this.set('globalVideos', newVideos);
  }

  addVideoLocally(video) {
    const videos = this.get('globalVideos');
    this.set('globalVideos', [video, ...videos]);
  }

  bulkUpdateVideos(updatesArray) {
    let videos = this.get('globalVideos');
    let changed = false;
    for (const { id, updates } of updatesArray) {
      const index = videos.findIndex(v => v.id === id);
      if (index !== -1) {
        videos[index] = { ...videos[index], ...updates };
        changed = true;
      }
    }
    if (changed) {
      this.set('globalVideos', [...videos]);
    }
  }

  updateFavoriteLocally(videoId, isFavorite) {
    let favs = this.get('globalFavorites');
    if (isFavorite && !favs.includes(videoId)) {
      this.set('globalFavorites', [...favs, videoId]);
    } else if (!isFavorite && favs.includes(videoId)) {
      this.set('globalFavorites', favs.filter(id => id !== videoId));
    }
  }

  clearFavoritesLocally() {
    this.set('globalFavorites', []);
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
  dueTodayCount: 0,   // ✅ YENİ (Adım 2.2): Bugün tekrar edilmesi gereken video sayısı
};

export const store = new Store(initialState);
if (typeof window !== 'undefined') window.__store = store;