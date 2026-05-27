import { translations } from './config.js';
import { handlePasteEvent, getUploadedCoverUrl, resetUploadedCoverUrl } from './storage.js';
import { 
    dbSaveVideo, dbDeleteVideo, dbFetchInstructors, dbFetchVideos, 
    dbSaveInstructor, dbDeleteInstructor, dbFetchFavorites, dbAddFavorite,
    dbRemoveFavorite, dbClearAllFavorites, detectPlatform
} from './tangoVeritabani.js';
import { renderChips, setupAutocomplete, renderVideoCards } from './uiRenderer.js';
import { 
    openVideoModal, closeVideoModal, openTagsEditModal, closeTagsEditModal,
    modalTagsArray, showCustomAlert, showCustomConfirm, saveTagsToSupabaseDirectly
} from './tangoModals.js';
import { updateSmartFilenameAssistant, updateInterfaceLanguage, switchView } from './tangoUI.js';
import { getFilteredVideos, getAllUniqueTagsPool, populateFilterDropdowns } from './tangoFilters.js';
import { computeStats, renderStats } from './tangoStats.js';
import { showLoading, setCurrentLangForUtils, showModernPrompt } from './utils.js';
import { initTagManager, updateTagManagerSelection, promptRenameTagModern, deleteSingleTag, deleteSelectedTags, mergeSelectedTags, cleanupUnusedTags } from './tagManager.js';
import { initVideoHandlers, toggleFavorite, applyFiltersAndSearch, setVisibleCount, incrementVisibleCount, deleteVideoFlow, setVideoHandlersGlobalData } from './videoHandlers.js';
import { initInstructorHandlers, handleInstructorSubmit, deleteInstructor, setInstructorHandlersGlobalData } from './instructorHandlers.js';
import { initFormHandlers, handleFormSubmit, setFormHandlersGlobalData } from './formHandlers.js';

// =========================================================================
// 🔄 YENİ EKLEME: YEDEKLER İÇİN KAFADAKİ HAFIZA KUTUSUNDAN KABLOLARI ALIYORUZ
// =========================================================================
import { exportToJSON, importFromJSON, setBackupLang } from './backup.js';

// Uygulama Durumu (State)
let currentLang = 'tr';
let videos = [];
let instructors = [];
let favorites = [];
let currentView = 'library';
let visibleCount = 20;

// Dil ayarlarını modüllere bildiriyoruz
setCurrentLangForUtils(currentLang);
setBackupLang(currentLang);

// Eğitmenleri Veritabanından Çeken Fonksiyon
async function fetchInstructors() {
    try {
        instructors = await dbFetchInstructors();
        const select = document.getElementById('form-instructor-select');
        if (select) {
            const oldVal = select.value;
            select.innerHTML = `<option value="">${translations[currentLang].chooseInstructor || 'Seçiniz...'}</option>`;
            instructors.forEach(ins => {
                select.innerHTML += `<option value="${ins.id}">${ins.name}</option>`;
            });
            select.value = oldVal;
        }
    } catch (err) {
        console.error("Eğitmenler yüklenirken hata oluştu:", err);
    }
}

// Videoları ve Favorileri Veritabanından Çeken Fonksiyon
async function fetchVideos() {
    showLoading(true);
    try {
        videos = await dbFetchVideos();
        favorites = (await dbFetchFavorites()).map(f => f.video_id);
        
        // Alt modüllere güncel verileri dağıtıyoruz
        syncModuleData();
        
        // Filtreleri doldur ve listeyi ekrana bas
        populateFilterDropdowns(videos, currentLang);
        applyFiltersAndSearch();
        
        // Eğer istatistik sayfasındaysak grafikleri yeniden çizdir
        if (currentView === 'stats') {
            const stats = computeStats(videos, instructors);
            renderStats(stats, currentLang);
        }
    } catch (err) {
        console.error("Videolar yüklenirken hata oluştu:", err);
        const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
        showCustomAlert(translations[currentLang].error, okText);
    } finally {
        showLoading(false);
    }
}

// Modüller arası veri senkronizasyonu
function syncModuleData() {
    setVideoHandlersGlobalData(currentLang, videos, favorites, currentView, visibleCount);
    setInstructorHandlersGlobalData(currentLang, null);
    setFormHandlersGlobalData(currentLang, null, [], videos);
}

// Filtre değiştiğinde tetiklenen yardımcı fonksiyon
function handleFilter() {
    setVisibleCount(20);
    applyFiltersAndSearch();
}

// Sayfa Değiştirme Yönetimi (Navigasyon)
window.navigateToView = function(viewName) {
    currentView = viewName;
    switchView(viewName, { currentLang, editingVideoId: null }, { renderFormChips: () => {} }); 
    
    syncModuleData();
    
    if (viewName === 'stats') {
        const stats = computeStats(videos, instructors);
        renderStats(stats, currentLang);
    } else {
        applyFiltersAndSearch();
    }
    
    // Aktif menü butonunu renklendir
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    const activeMenu = document.getElementById(`menu-${viewName}`);
    if (activeMenu) activeMenu.classList.add('active');
};

// 🎬 SİTE İLK AÇILDIĞINDA ÇALIŞACAK ANA BAŞLANGIÇ NOKTASI
document.addEventListener('DOMContentLoaded', async () => {
    // İlk arayüz dilini ayarla
    updateInterfaceLanguage(currentLang, null, null, [], applyFiltersAndSearch, populateFilterDropdowns);
    
    // Verileri uzak sunucudan indir
    await fetchInstructors();
    await fetchVideos();

    // Diğer JS dosyalarının çalışması için gerekli fonksiyon bağlamalarını yap
    initVideoHandlers(
        () => applyFiltersAndSearch(),
        () => fetchVideos(),
        (url) => openVideoModal(url),
        (video) => openTagsEditModal(video),
        (video) => { /* Düzenleme akışı */ },
        (id) => deleteVideoFlow(id)
    );
    
    initInstructorHandlers(null, () => fetchInstructors(), () => fetchVideos());
    initFormHandlers(null, [], videos, () => fetchVideos(), (view) => window.navigateToView(view));

    // Sol Menü Tıklama Olayları
    document.getElementById('menu-library').onclick = () => window.navigateToView('library');
    document.getElementById('menu-favorites').onclick = () => window.navigateToView('favorites');
    document.getElementById('menu-stats').onclick = () => window.navigateToView('stats');
    document.getElementById('menu-add-video').onclick = () => window.navigateToView('add-video');
    const tagMenu = document.getElementById('menu-tagManager');
    if (tagMenu) tagMenu.onclick = () => window.navigateToView('tagManager');

    // Dil Değiştirme Butonu (TR / EN) Tıklama Olayı
    const langBtn = document.getElementById('btn-lang-toggle');
    if (langBtn) {
        langBtn.onclick = () => {
            currentLang = currentLang === 'tr' ? 'en' : 'tr';
            langBtn.innerText = currentLang === 'tr' ? 'EN' : 'TR';
            setCurrentLangForUtils(currentLang);
            setBackupLang(currentLang);
            updateInterfaceLanguage(currentLang, null, null, [], applyFiltersAndSearch, populateFilterDropdowns);
            populateFilterDropdowns(videos, currentLang);
            applyFiltersAndSearch();
            if (currentView === 'stats') {
                const stats = computeStats(videos, instructors);
                renderStats(stats, currentLang);
            }
        };
    }

    // Filtreleme Elemanlarının Değişim Olayları
    document.getElementById('search-input').oninput = applyFiltersAndSearch;
    document.getElementById('filter-role-select').onchange = handleFilter;
    document.getElementById('filter-instructor-select').onchange = handleFilter;
    document.getElementById('filter-tag-select').onchange = handleFilter;
    document.getElementById('filter-date-select').onchange = handleFilter;
    document.getElementById('filter-platform-select').onchange = handleFilter;
    document.getElementById('filter-btn').onclick = () => { setVisibleCount(20); fetchVideos(); };
    document.getElementById('btn-load-more').onclick = () => { incrementVisibleCount(20); applyFiltersAndSearch(); };
    
    // Video ve Etiket Modalları Kapatma Olayları
    document.getElementById('modal-close-btn').onclick = closeVideoModal;
    document.getElementById('video-modal').onclick = (e) => { if (e.target.id === 'video-modal') closeVideoModal(); };
    document.getElementById('tags-modal-close-btn').onclick = closeTagsEditModal;
    document.getElementById('tags-edit-modal').onclick = (e) => { if (e.target.id === 'tags-edit-modal') closeTagsEditModal(); };
    
    // Pano üzerinden kapak resmi yapıştırma dinleyicisi
    document.getElementById('drop-area')?.addEventListener('paste', (e) => handlePasteEvent(e, currentLang));
    
    // Toplu Etiket Yönetimi Buton Olayları
    document.getElementById('tag-manager-merge-btn').onclick = () => mergeSelectedTags();
    document.getElementById('tag-manager-delete-btn').onclick = () => deleteSelectedTags();
    document.getElementById('tag-manager-cleanup-btn').onclick = () => cleanupUnusedTags();
    document.getElementById('tag-merge-cancel-btn').onclick = () => {
        document.getElementById('tag-merge-panel').classList.add('d-none');
        updateTagManagerSelection();
    };

    // =========================================================================
    // 🔥 EN ÖNEMLİ KISIM: YEDEKLEME VE GERİ YÜKLEME BUTONLARININ ELEKTRİK BAĞLANTILARI
    // =========================================================================
    
    // 1. Yedekle Butonunun Kablosunu Bağlıyoruz (HTML'deki ID ne olursa olsun ikisini de kontrol eder)
    const backupBtn = document.getElementById('btn-backup') || document.getElementById('backup-btn');
    if (backupBtn) {
        backupBtn.onclick = () => {
            console.log("Yedekleme dosyası hazırlanıyor ve indiriliyor...");
            // backup.js içindeki fonksiyonu çağırıp güncel verileri veriyoruz
            exportToJSON(videos, instructors, favorites);
        };
    }

    // 2. Geri Yükle Butonunun ve Gizli Dosya Seçicinin Kablosunu Bağlıyoruz
    const restoreBtn = document.getElementById('btn-restore') || document.getElementById('restore-btn');
    // Geri yükleme yapabilmek için HTML'de bir <input type="file"> olmalı. İki olası ID'yi de aratıyoruz:
    const restoreInput = document.getElementById('restore-file-input') || document.getElementById('backup-file-input');
    
    if (restoreBtn && restoreInput) {
        // Kullanıcı "Yedekten Geri Yükle" butonuna bastığında, gizli dosya seçme penceresini tetikliyoruz
        restoreBtn.onclick = () => {
            restoreInput.click();
        };

        // Kullanıcı bilgisayarından bir JSON yedek dosyası seçtiği an burası çalışır:
        restoreInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const okText = currentLang === 'tr' ? 'Tamam' : 'OK';
            showLoading(true); // Ekrana yükleniyor animasyonu getir
            
            try {
                // backup.js içindeki geri yükleme motorunu çalıştırıp listeleri tazeleyecek fonksiyonları teslim ediyoruz
                await importFromJSON(file, fetchInstructors, fetchVideos);
                // Aynı dosya üst üste seçilirse yine çalışabilsin diye seçiciyi sıfırlıyoruz
                restoreInput.value = '';
            } catch (err) {
                console.error("Geri yükleme işlemi sırasında hata:", err);
                showCustomAlert(currentLang === 'tr' ? 'Geri yükleme başarısız oldu.' : 'Restore failed.', okText);
            } finally {
                showLoading(false); // Yükleniyor animasyonunu kaldır
            }
        };
    }
});