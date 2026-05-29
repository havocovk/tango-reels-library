// www/js/store.js
// Burası uygulamanın beyni. Bütün önemli bilgiler burada durur.

class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };      // Bilgilerin saklandığı kutu
    this.listeners = new Map();             // Dinleyicilerin listesi (her anahtar için)
    this.globalListeners = [];              // Her şeyi dinleyenler
  }

  // Tek bir bilgiyi değiştir (ör: dili değiştir)
  set(key, value, silent = false) {
    const oldValue = this.state[key];
    if (oldValue === value) return;         // Aynıysa işlem yapma
    this.state[key] = value;
    if (!silent) {
      this._notify(key, value, oldValue);
    }
  }

  // Aynı anda birçok bilgiyi değiştir (ör: videoları ve favorileri birlikte güncelle)
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

  // Bir bilgiyi al (ör: şu anki dili öğren)
  get(key) {
    return this.state[key];
  }

  // Bir bilgi değiştiğinde haber almak için dinleme (abonelik)
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
    // İlk değeri hemen gönder
    callback(this.state[key], undefined, key);
    // Çıkış yapmak için fonksiyon döndür
    return () => this.unsubscribe(key, callback);
  }

  // Her şey değiştiğinde haber al (global dinleyici)
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
    // Önce o anahtarı dinleyenlere haber ver
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(cb => cb(newValue, oldValue, key));
    }
    // Sonra her şeyi dinleyenlere haber ver
    this.globalListeners.forEach(cb => cb(this.state, { key, newValue, oldValue }, '*'));
  }
}

// Başlangıçtaki bilgiler (ilk hal)
const initialState = {
  currentLang: 'tr',           // Dil: tr veya en
  globalVideos: [],            // Tüm videoların listesi
  globalFavorites: [],         // Favori video ID'lerinin listesi
  currentView: 'library',      // Hangi sayfadayız: library, favorites, stats, add, tagManager
  visibleCount: 20,            // Bir seferde gösterilecek video sayısı
  globalInstructors: [],       // Eğitmenlerin listesi
  editingVideoId: null,        // Düzenlenen video'nun ID'si (null ise yeni video ekleme)
  editInstructorId: null,      // Düzenlenen eğitmenin ID'si
  formTagsArray: [],           // Formdaki geçici etiketler
  modalTagsArray: [],          // Etiket modalındaki geçici etiketler
  activeEditTagsVideoId: null, // Hangi video'nun etiketini düzenliyoruz
  activeEditTagsVideoUpdatedAt: null, // O video'nun son güncellenme zamanı (çakışma kontrolü için)
  loading: false               // Yükleme ekranı gösterilsin mi?
};

// Store'u dışarıya ver
export const store = new Store(initialState);

// Geliştirici konsolunda yardım için (isteğe bağlı)
if (typeof window !== 'undefined') {
  window.__store = store;
}