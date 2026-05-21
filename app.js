// app.js
import { translations } from './config.js';
import * as api from './api.js';
import { handlePasteEvent } from './storage.js';
import { getFavorites, clearAllFavorites, toggleFavorite } from './favorites.js';
import { renderFormChips } from './handlers.js';
import { applyFiltersAndSearch, renderInstructorSelect, switchView } from './ui.js';
import { setupAutocomplete } from './tags.js';
import { openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal, setupModalAutocomplete } from './modals.js';
import { handleInstructorSubmit, deleteInstructorFlow } from './instructors.js';
import { handleFormSubmit } from './handlers.js';

// MERKEZİ UYGULAMA DURUMU (AppState)
const AppState = {
    currentLang: 'tr',
    globalVideos: [],
    editingVideoId: null,
    currentView: 'library',
    formTagsArray: [],
    modalTagsArray: [],
    activeEditTagsVideoId: null,
    onRefreshUI: null // Döngüsel bağımlılığı kırmak için ui yenileme tetikleyicisi
};

// Uygulama Başlatıcı Fonksiyon (Initialization)
async function initApp() {
    // 1. Dil ayarını yükle
    const savedLang = localStorage.getItem('atkk_lang');
    if (savedLang) AppState.currentLang = savedLang;

    // 2. Arayüz yenileme görevini ata
    AppState.onRefreshUI = loadDataAndRender;

    // 3. Dinleyicileri (Event Listeners) ayağa kaldır
    setupEventListeners();

    // 4. Etiket tamamlama (Autocomplete) sistemlerini kur
    setupAutocomplete(AppState);
    setupModalAutocomplete(AppState);

    // 5. İlk verileri veritabanından çek ve ekrana bas
    await loadDataAndRender();
}

// Veritabanından Güncel Verileri Çekip Ekrana Basma Fonksiyonu
async function loadDataAndRender() {
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
        loadingMsg.classList.remove('d-none');
        loadingMsg.innerText = translations[AppState.currentLang].loading;
    }

    try {
        // api.js dosyasındaki export edilmiş fonksiyonları güvenle çağırıyoruz
        const [videos, instructors] = await Promise.all([
            api.fetchVideos(),
            api.fetchInstructors()
        ]);

        AppState.globalVideos = videos;

        // Arayüz bileşenlerini güncelle
        renderInstructorSelect(instructors);
        applyFiltersAndSearch(AppState);

    } catch (err) {
        console.error("Veri yükleme hatası:", err);
        const videoGrid = document.getElementById('video-grid');
        if (videoGrid) {
            videoGrid.innerHTML = `<div class="info-msg" style="color: #ef4444;">${translations[AppState.currentLang].error}</div>`;
        }
    }
}

// Tüm Buton Tıklamaları ve Olay Dinleyicileri
function setupEventListeners() {
    const lang = translations[AppState.currentLang];

    // Dil Değiştirme Butonu
    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
        AppState.currentLang = AppState.currentLang === 'tr' ? 'en' : 'tr';
        localStorage.setItem('atkk_lang', AppState.currentLang);
        document.getElementById('lang-toggle-btn').innerText = AppState.currentLang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR';
        loadDataAndRender();
    });

    // Sol Menü Navigasyon Butonları
    document.getElementById('menu-library').addEventListener('click', () => switchView('library', AppState));
    document.getElementById('menu-favorites').addEventListener('click', () => switchView('favorites', AppState));
    document.getElementById('menu-add-video').addEventListener('click', () => switchView('add', AppState));

    // Pratik Listesini Temizleme
    document.getElementById('btn-clear-favorites').addEventListener('click', () => {
        clearAllFavorites(AppState, () => applyFiltersAndSearch(AppState));
    });

    // Sürükle-Bırak / Ekran Görüntüsü Yapıştırma Alanı
    const dropArea = document.getElementById('drop-area');
    if (dropArea) {
        dropArea.addEventListener('paste', (e) => handlePasteEvent(e, AppState.currentLang));
    }

    // Google Drive İndirildi Checkbox'ı Mantığı
    document.getElementById('form-is-downloaded').addEventListener('change', (e) => {
        const driveUrlContainer = document.getElementById('drive-url-container');
        const driveInput = document.getElementById('form-drive-url');
        if (e.target.checked) {
            driveUrlContainer.classList.remove('d-none');
            driveInput.required = true;
        } else {
            driveUrlContainer.classList.add('d-none');
            driveInput.value = '';
            driveInput.required = false;
        }
    });

    // Eğitmen CRUD Panelini Aç/Kapat Butonları
    document.getElementById('btn-toggle-new-instructor').addEventListener('click', () => {
        const container = document.getElementById('new-instructor-container');
        container.classList.toggle('d-none');
        document.getElementById('form-save-instructor').innerText = translations[AppState.currentLang].btnAddIns;
    });

    document.getElementById('btn-edit-instructor').addEventListener('click', () => {
        const select = document.getElementById('form-instructor-select');
        if (!select.value) return alert(translations[AppState.currentLang].assistantAlert);
        
        const container = document.getElementById('new-instructor-container');
        container.classList.remove('d-none');
        document.getElementById('form-new-instructor-input').value = select.options[select.selectedIndex].text;
        document.getElementById('form-save-instructor').innerText = translations[AppState.currentLang].btnUpdateIns;
    });

    // Form Gönderimleri ve Silme Tetikleyicileri
    document.getElementById('btn-delete-instructor').addEventListener('click', () => deleteInstructorFlow(AppState));
    document.getElementById('form-save-instructor').addEventListener('click', () => handleInstructorSubmit(AppState));
    
    // Video Formu Kaydetme (Düzeltilmiş handlers.js'e bağlanıyor)
    document.getElementById('add-video-form').addEventListener('submit', (e) => {
        handleFormSubmit(e, AppState, (targetView) => switchView(targetView, AppState));
    });

    // Arama ve Filtreleme Olayları
    document.getElementById('search-input').addEventListener('input', () => applyFiltersAndSearch(AppState));
    document.getElementById('filter-role-select').addEventListener('change', () => applyFiltersAndSearch(AppState));
    document.getElementById('filter-location-select').addEventListener('change', () => applyFiltersAndSearch(AppState));
    document.getElementById('filter-btn').addEventListener('click', () => applyFiltersAndSearch(AppState));

    // Video İzleme Modalı Kapatma Olayları
    document.getElementById('modal-close-btn').addEventListener('click', closeVideoModal);
    document.getElementById('video-modal').addEventListener('click', (e) => {
        if (e.target.id === 'video-modal') closeVideoModal();
    });

    // Etiket Düzenleme Modalı Kapatma Olayları
    document.getElementById('tags-modal-close-btn').addEventListener('click', () => closeTagsEditModal(AppState));
    document.getElementById('tags-edit-modal').addEventListener('click', (e) => {
        if (e.target.id === 'tags-edit-modal') closeTagsEditModal(AppState);
    });
}

// Global Kart Tıklamalarını Yakalama Mekanizması (Event Delegation)
document.addEventListener('click', (e) => {
    const target = e.target;

    // 1. Favori Yıldız Butonu
    if (target.classList.contains('fav-star-btn') || target.closest('.fav-star-btn')) {
        const btn = target.classList.contains('fav-star-btn') ? target : target.closest('.fav-star-btn');
        const id = parseInt(btn.getAttribute('data-id'));
        toggleFavorite(id);
        applyFiltersAndSearch(AppState);
        return;
    }

    // 2. Video Kartı Oynat Butonu
    if (target.classList.contains('play-overlay') || target.closest('.play-overlay')) {
        const overlay = target.classList.contains('play-overlay') ? target : target.closest('.play-overlay');
        const driveUrl = overlay.getAttribute('data-drive-url');
        const videoUrl = overlay.getAttribute('data-video-url');
        openVideoModal(driveUrl, videoUrl);
        return;
    }
});

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', initApp);