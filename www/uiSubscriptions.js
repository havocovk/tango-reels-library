// uiSubscriptions.js - Store değişikliklerine tepki veren UI güncellemeleri
import { store } from './store.js';
import { applyFiltersAndSearch, setVideoHandlersGlobalData } from './videoHandlers.js';
import { setInstructorHandlersGlobalData } from './instructorHandlers.js';
import { setFormHandlersGlobalData, formTagsArray } from './formHandlers.js';
import { initTagManager } from './tagManager.js';
import { renderStatsPanel, renderTagManagerUI, fetchVideos } from './dataManager.js';
import { callUpdateInterfaceLanguage } from './navigation.js';

// Abonelikleri saklamak için
let subscriptions = [];

export function setupStoreSubscriptions() {
  // 1. currentLang değişince
  subscriptions.push(
    store.subscribe('currentLang', (newLang, oldLang) => {
      console.log(`Language changed: ${oldLang} -> ${newLang}`);
      // Dil değişince interface dili güncellenir
      callUpdateInterfaceLanguage();
      // Filtre dropdown'ları yenilenir (zaten callUpdateInterfaceLanguage içinde var)
      // İstatistik veya tagManager açıksa yeniden render
      if (store.get('currentView') === 'stats') renderStatsPanel();
      if (store.get('currentView') === 'tagManager') renderTagManagerUI();
      // Video handler'lara yeni dili bildir
      setVideoHandlersGlobalData(newLang);
      setInstructorHandlersGlobalData(newLang);
      setFormHandlersGlobalData(newLang, formTagsArray, store.get('globalVideos'));
      initTagManager(newLang, store.get('globalVideos'), fetchVideos, renderTagManagerUI);
      // Listeyi yenile
      applyFiltersAndSearch();
    })
  );

  // 2. globalVideos değişince
  subscriptions.push(
    store.subscribe('globalVideos', (newVideos, oldVideos) => {
      console.log(`Videos updated: ${oldVideos?.length || 0} -> ${newVideos.length}`);
      // Form handler'daki globalVideos referansını güncelle
      setFormHandlersGlobalData(store.get('currentLang'), formTagsArray, newVideos);
      // Tag manager'ı güncelle
      initTagManager(store.get('currentLang'), newVideos, fetchVideos, renderTagManagerUI);
      // Filtreleri ve listeyi yenile
      applyFiltersAndSearch();
      // İstatistik paneli açıksa yenile
      if (store.get('currentView') === 'stats') renderStatsPanel();
      if (store.get('currentView') === 'tagManager') renderTagManagerUI();
    })
  );

  // 3. globalFavorites değişince
  subscriptions.push(
    store.subscribe('globalFavorites', (newFavs, oldFavs) => {
      console.log(`Favorites updated: ${oldFavs?.length || 0} -> ${newFavs.length}`);
      // Sadece listeyi yenile (favori yıldızları güncellensin)
      applyFiltersAndSearch();
      // İstatistik panelinde favori sayısı yok şu an, ama ileride olabilir
    })
  );

  // 4. currentView değişince
  subscriptions.push(
    store.subscribe('currentView', (newView, oldView) => {
      console.log(`View changed: ${oldView} -> ${newView}`);
      // Görünüm değişince visibleCount sıfırlanır mı? navigation.js'de zaten yapılıyor.
      // Ama burada da yapabiliriz. Tekrar etmemek için navigation.js'deki mantığı koruyacağız.
      // Sadece UI'ı güncellemek için applyFiltersAndSearch çağrılır.
      applyFiltersAndSearch();
      // İstatistik veya tagManager görünümleri için ayrıca render
      if (newView === 'stats') renderStatsPanel();
      if (newView === 'tagManager') renderTagManagerUI();
    })
  );

  // 5. visibleCount değişince
  subscriptions.push(
    store.subscribe('visibleCount', (newCount, oldCount) => {
      console.log(`Visible count changed: ${oldCount} -> ${newCount}`);
      applyFiltersAndSearch();
    })
  );

  // 6. globalInstructors değişince
  subscriptions.push(
    store.subscribe('globalInstructors', (newIns, oldIns) => {
      console.log(`Instructors updated: ${oldIns?.length || 0} -> ${newIns.length}`);
      // Form'daki instructor select'i update etmek için fetchInstructors zaten çağrılıyor.
      // Burada ekstra bir şey yapmaya gerek yok, çünkü değişim zaten fetchInstructors tarafından yapılıyor.
      // Ama istersen form select'i güncellemek için bir fonksiyon çağırabiliriz. Şimdilik pas.
    })
  );
}

// İsteğe bağlı: Tüm abonelikleri temizle (test veya reload için)
export function cleanupSubscriptions() {
  subscriptions.forEach(unsubscribe => unsubscribe());
  subscriptions = [];
}