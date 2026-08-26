# ATTK — Arjantin Tango Kombinasyon Koleksiyonu
# Master Yol Haritası

**Son Güncelleme:** 2026-08-07  
**Kapsam:** V1 → V5 yol haritalarının tüm geçmişi + mevcut durum + bekleyen işler + şartlı görevler

---

## Bu Dosya Ne İçin Var

Bu dosya projenin hafızasıdır. Hangi özelliğin ne zaman eklendiği, hangisinin neden vazgeçildiği, hangisinin yapılmayı beklediği ve bazı işlerin başlaması için ne gerektiği burada kayıtlıdır.

Claude'a "yol haritası dosyasına bak ve şu şartı sağlayan adımları uygula" dediğinde, Claude bu dosyayı okuyarak ne yapacağını doğrudan anlayacak.

---

## Projenin Teknik Kimliği

| Alan | Değer |
|------|-------|
| Stack | Vanilla JS ES Modules, Supabase (PostgreSQL + REST API), Vercel, GitHub |
| Repo | `havocovk/tango-reels-library` |
| UI Teması | Synthwave/neon koyu — Tokyo Cyber-Synthwave |
| Renkler | Cyan `#00f0ff`, Pink `#ff007f`, Purple `#c026d3`, Green `#4ade80`, Amber `#f59e0b`, Red `#ef4444`, Muted `#64748b` |
| İkon sistemi | Yalnızca Lucide SVG — `icons.js` içindeki `icon()` fonksiyonu |
| Kütüphaneler | Chart.js (istatistik), vis-network jsDelivr CDN (zincir haritası), Fuse.js CDN (fuzzy search) |
| Supabase tabloları | `videos`, `favorites`, `practice_list`, `monthly_stats`, `practice_sessions`, `annotations`, `playlists`, `playlist_videos`, `video_links`, `tag_colors`, `tags`, `video_tags` |

### Dosya Yapısı (Güncel)

```
Kök: app.js, tangoUI.js, videoHandlers.js, videoCardRenderer.js, navigation.js
     tangoVeritabani.js (merkezi DB facade — tüm DB importları buradan geçmeli)
     practiceListManager.js, badgeSystem.js

ui/:  viewRouter.js (eski adı: ui/navigation.js — iki kez yeniden adlandırıldı)
      language.js, uiSubscriptions.js, modalLoader.js

db/, views/, styles/, modals/, learning/, stats/
  stats/ altında: chartRenderers.js, heatmapRenderer.js, sessionHistory.js
```

### Kritik Teknik Kurallar

- `tangoVeritabani.js` tek doğru DB import yolu — `db/` altından doğrudan import yapma.
- `ui/navigation.js` → `ui/viewRouter.js` olarak yeniden adlandırıldı. Navigation ile ilgili işlerde hangisinin geçerli olduğunu önce doğrula.
- `content_type` alanı: `'combination'` ve `'show'` videolarını ayırt eder. Show videoları pratik/spaced repetition akışlarına dahil edilmemeli.
- Lokalizasyon: `ui/language.js` her dil değişiminde HTML'i ezebilir. Buton metni düzeltmeleri HTML'de değil, dil sisteminde yapılmalı.
- SM-2 spaced repetition kapalı: `practice_sessions` tablosu ve veriler korunuyor ama algoritma devre dışı.

---

## GEÇMİŞ — Tamamlanan Tüm Adımlar

### V1 Bölüm 1 — Acil Düzeltmeler ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 1.1 | Arama bug fix — `applyFiltersAndSearch()` aramaMetni her zaman boş geçiyordu | ✅ Tamamlandı |
| 1.2 | YouTube thumbnail otomatik çekme — URL girilince thumbnail preview | ✅ Tamamlandı |
| 1.3 | Kapak fotoğrafı dosya seçici — mobilde Ctrl+V çalışmıyordu | ✅ Tamamlandı |
| 1.4 | Sonsuz kaydırma (Infinite Scroll) — IntersectionObserver ile | ✅ Tamamlandı |

### V1 Bölüm 2 — Öğrenme Sistemi ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 2.1 | Öğrenme Durumu Etiketi — Yeni / Çalışıyorum / Ustalaştım | ✅ Tamamlandı |
| 2.2 | Spaced Repetition (SM-2) — aralıklı tekrar sistemi | ✅ Tamamlandı (sonradan V5 ile devre dışı bırakıldı) |
| 2.3 | Practice Session Modu — tam ekran tek kart pratik akışı | ✅ Tamamlandı |
| 2.4 | Çoklu Playlist — "Bu Hafta", "Milonga" gibi isimli listeler | ✅ Tamamlandı |

### V1 Bölüm 3 — Arama & Keşif ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 3.1 | Fuse.js bulanık arama — yazım hatası toleranslı | ✅ Tamamlandı |
| 3.2 | Benzer video önerileri — ortak etiket puanlaması | ✅ Tamamlandı |
| 3.3 | Etiket renk sistemi — `tag_colors` tablosu + `tagColorManager.js` | ✅ Tamamlandı |

### V1 Bölüm 4 — Performans ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 4.1 | Lokal state optimizasyonu — favori/not/etiket güncellemelerinde `fetchVideos()` çağrılmıyor | ✅ Tamamlandı |
| 4.2 | Supabase Realtime senkronizasyonu — cihazlar arası anlık güncelleme | ✅ Tamamlandı |
| 4.3 | Server-side pagination — sayfa sayfa çekme (sayfalama uygulandı) | ⚠️ Kısmen — filtreleme hâlâ istemcide (detay aşağıda) |

### V1 Bölüm 5 — Görselleştirme & İstatistikler ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 5.1 | Öğrenme heatmap — GitHub tarzı yıllık ısı haritası | ✅ Tamamlandı |
| 5.2 | İnteraktif etiket ağ haritası | ⚠️ Kısmen — `computeTagNetwork()` var, görsel render yok (detay aşağıda) |
| 5.3 | Tıklanabilir etiket bulutu | ✅ Tamamlandı |
| 5.4 | Aylık trend için yıl seçici | ✅ Tamamlandı |

### V1 Bölüm 6 — Derinlik Özellikleri ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 6.1 | Video Annotation — zaman damgasına bağlı notlar | ✅ Tamamlandı |
| 6.2 | Kombinasyon zincirleri — video_links tablosu + chainManager | ✅ Tamamlandı |
| 6.3 | Eğitmen profil sayfası | ✅ Tamamlandı |
| 6.4 | Pratik listesi paylaşma (PDF/WhatsApp export) | ✅ Tamamlandı |

### V1 Bölüm 7 — UI / UX ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 7.1 | Mobil alt navigasyon barı — sabit 5 butonlu bottom nav | ✅ Tamamlandı |
| 7.2 | Liste / grid görünüm geçişi | ✅ Tamamlandı |
| 7.3 | Hover-to-glow animasyonu — pembe→cyan kenarlık geçişi | ✅ Tamamlandı |
| 7.4 | ARIA etiketleri ve klavye navigasyonu | ✅ Tamamlandı |

### V1 Bölüm 8 — Teknik Altyapı ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 8.1 | Etiket veritabanı normalizasyonu — `tags` + `video_tags` tabloları, migration | ✅ Tamamlandı |
| 8.2 | PostgreSQL RPC ile atomik yedek içe aktarma | ✅ Tamamlandı |

---

### V2 — Kalite, PWA, Performans, AI ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 1.1 | Kalıcı bildirim modalı — kritik mesajlar için "Tamam" butonlu modal | ✅ Tamamlandı |
| 1.2 | Supabase Storage RLS politikaları | ❓ Panel ayarı — kod tarafında doğrulanamıyor, belirsiz |
| 1.3 | Auth ekranı iki dil desteği | ✅ Tamamlandı |
| 2.1 | Service Worker önbellek — offline uygulama kabuğu | ✅ Tamamlandı |
| 2.2 | IndexedDB video önbelleği — offline'da son veri | ✅ Tamamlandı |
| 2.3 | Offline pratik modu — `syncQueue.js` ile kuyruk sistemi | ✅ Tamamlandı |
| 2.4 | PWA ikon & splash tamamlama | ⚠️ Kısmen — ikonlar var ama yanlış yolda, shortcuts/screenshots eksik |
| 3.1 | Sunucu taraflı filtreleme | ⚠️ Kısmen — sayfalama var, filtreleme hâlâ istemcide |
| 3.2 | URL durum senkronizasyonu — filtreler URL'e yazılıyor | ✅ Tamamlandı |
| 3.3 | Etiket tutarlılık denetçisi — `healthCheck.js` | ✅ Tamamlandı |
| 4.1 | YouTube metadata tam çekme — başlık, açıklama, süre | ✅ Tamamlandı |
| 4.2 | AI otomatik etiket önerisi | ❌ Yapılmadı |
| 4.3 | AI öğrenme yolu önerisi | ✅ Dosya oluşturuldu (`learningPathAdvisor.js`) ama sonradan devre dışı bırakıldı (V5/Adım 8) |
| 5.1 | Herkese açık playlist paylaşım linki | ❌ Yapılmadı |
| 5.2 | Çok kullanıcı altyapısı | ❌ Yapılmadı (uzun vade) |

---

### V4 — Bug Düzeltmeleri ve UX ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 1.1 | `getVideoPlaylistIds` hatası — playlist tik işaretleri düzeltildi | ✅ Tamamlandı |
| 1.2 | `escapeHtml` 8 kopya → 1 kopya (`utils.js`) | ✅ Tamamlandı |
| 1.3 | Pratik modundan çıkışa onay eklendi | ✅ Tamamlandı |
| 1.4 | Zincir sistemine döngü kontrolü eklendi (A→B→A engeli) | ✅ Tamamlandı |
| 2.1 | Isı haritasına yıl seçici eklendi | ✅ Tamamlandı |
| 2.2 | Şifre sıfırlama bağlantısı eklendi | ✅ Tamamlandı |
| 2.3 | SM-2'ye zorluk derecesi — Zor / Tamam / Kolaydı butonu | ✅ Tamamlandı |
| 3.1 | Etiket birleştirme toplu istek | ❌ Yapılmadı — hâlâ `for` döngüsü |
| 3.2 | Çevrimdışı çakışma koruması (`updated_at` kontrolü) | ✅ Tamamlandı |
| 3.3 | Template lazy loading | ❌ Yapılmadı — hâlâ `Promise.all` ile toplu yükleme |
| 3.4 | EventBus / döngüsel bağımlılık temizliği | ❌ Yapılmadı — `eventBus.js` yok |
| 4.1 | Dashboard / ana özet ekranı | ✅ Tamamlandı (`dashboard.html`) |
| 4.2 | Zincir görsel haritası | ✅ Tamamlandı (`_renderChainMap` mevcut) |
| 4.3 | Pratik seans geçmişi tablosu (`practice_sessions` + `sessionHistory.js`) | ✅ Tamamlandı |
| 4.4 | Video kart üç nokta menüsü | ✅ Tamamlandı |
| 4.5 | Küçük UX iyileştirmeleri (7 madde) | ⚠️ Kısmen — 5 madde yapıldı, 2 eksik (aşağıda) |
| 5.1 | Video izleme ilerlemesi ("Kaldığın yerden devam et") | ❌ Yapılmadı |
| 5.2 | Gerçek tarayıcı geri/ileri navigasyonu (History API) | ✅ Tamamlandı (`pushState`) |
| 5.3 | Resim sıkıştırma — yükleme sırasında otomatik | ✅ Tamamlandı |
| 5.4 | Sunucu taraflı sayfalama (tam) | ❌ Yapılmadı — V1/4.3 ile aynı sorun |
| 5.5 | Rastgele keşfet butonu | ✅ Tamamlandı |
| 5.6 | Quiz modu | ❌ Yapılmadı |

---

### V5 — Pratik Sistemi Yeniden Yapılandırması ✅

| Adım | Açıklama | Durum |
|------|----------|-------|
| 1 | "Pratik Listem" → "Favoriler" yeniden adlandırma | ✅ Tamamlandı |
| 2 | Yeni "Pratik Listem" sayfası — `practice_list` tablosu + `practiceListManager.js` | ✅ Tamamlandı |
| 3 | Video kartlarına Pratik Listesi ikonu (Dumbbell) | ✅ Tamamlandı |
| 4 | SM-2 algoritması devre dışı — pratik artık Pratik Listesi'nden çekiyor | ✅ Tamamlandı |
| 5 | Pratik Başlat → sadece Pratik Listesi videoları; boş liste uyarısı | ✅ Tamamlandı |
| 6 | Video kartlarına çalışma sayacı (`practice_count`) | ✅ Tamamlandı |
| 7 | Sayacı sıfırlama özelliği (modal + onay) | ✅ Tamamlandı |
| 8 | Öğrenme Yolu Önerisi (`learningPathAdvisor.js`) devre dışı bırakıldı | ✅ Tamamlandı |
| 9 | Kombinasyon zinciri 1-çok ilişkisi | ❌ Yapılmadı |
| 10 | Rozet & Hedef Takibi sistemi | ✅ Tamamlandı (`badgeSystem.js` + `monthly_stats`) |

---

### Yapılmış Diğer İşler (Yol Haritaları Dışında)

| Açıklama | Ne Zaman |
|----------|----------|
| `ui/navigation.js` → `ui/viewRouter.js` yeniden adlandırması (çift `navigation.js` çakışması çözüldü) | V3 sonrası |
| `videoCardRenderer.js` liste görünüm modu hatası düzeltildi | V3 sonrası |
| `statsUI.js` bölündü: `chartRenderers.js` + `heatmapRenderer.js` + `sessionHistory.js` | V3 sonrası |
| `instructorProfile.js` bölündü: `instructorProfile.js` + `instructorsList.js` | V3 sonrası |
| Tüm `db/` doğrudan importları `tangoVeritabani.js` üzerinden geçecek şekilde taşındı | V3 sonrası |

---

## VAZGEÇİLEN ADIMLAR

Bunlar planlanmış ama bilinçli olarak vazgeçilmiş adımlardır.

| Adım | Neden Vazgeçildi |
|------|-----------------|
| **SM-2 Algoritması** (V2/2.2 ile eklendi, V5/4 ile kapatıldı) | Haftada 1-2 saatlik pratik ritmi için gereksiz karmaşıklık. Kullanıcı kendi pratik listesini manuel yönetmeyi tercih ediyor. `spacedRepetition.js` ve `practice_sessions` tablosu korunuyor ama algoritma kapalı. |
| **AI Öğrenme Yolu Önerisi** (V2/4.3 ile planlandı, dosya oluşturuldu, V5/8 ile kapatıldı) | Kullanıcı bu özelliği gereksiz buldu. `learningPathAdvisor.js` dosyası silinmedi, sadece çağrılmıyor. |

---

## BEKLEYEN ADIMLAR

### Grup A — Teknik Borç (Kod çalışıyor ama mimari zayıf)

---

#### A1 — Server-Side Filtering (Tam Uygulama)
**Kaynak:** V1/4.3, V2/3.1  
**Mevcut Durum:** `dbFetchVideosPage()` sayfalama yapıyor ama filtreler (eğitmen, platform, öğrenme durumu, etiket) hâlâ istemci tarafında uygulanıyor.  
**Ne Gerekiyor:**
- `dbFetchVideosPage(page, pageSize, filters)` imzası güncellenmeli
- `filters: { instructorId, platform, learningStatus, tag }` Supabase'e PostgREST parametre olarak gönderilmeli
- `tangoFilters.js`'teki `getFilteredVideos()` sunucu filtreleme aktifken istemci filtresini atlamalı
- Fuse.js metin araması hâlâ istemcide kalabilir

**Şart:** 800+ videoya ulaşıldığında bu adım kritik hale gelir. Şu anki mimaride 800 video = tümü belleğe çekiliyor, sonra istemcide filtreleniyor. Bu hem yavaş hem de bellek sorununa yol açar.

**Etkilenen dosyalar:** `db/videos.js` (tangoVeritabani.js üzerinden), `tangoFilters.js`, `dataManager.js`, `videoHandlers.js`

---

#### A2 — Etiket Birleştirme Toplu İstek
**Kaynak:** V4/3.1  
**Mevcut Durum:** `dbMergeTagsNormalized()` hâlâ iç içe `for` döngüsüyle video başına ayrı istek gönderiyor. 60 video = 60 ayrı Supabase isteği.  
**Ne Gerekiyor:**
- Supabase'in `IN` filtresi kullanılarak tek sorguda toplu güncelleme
- Orta koleksiyonda fark edilmez ama 500+ video ve sık etiket birleştirme yapılırsa sorun çıkar

**Etkilenen dosyalar:** `db/tagsNormalized.js` (tangoVeritabani.js üzerinden)

---

#### A3 — Template Lazy Loading
**Kaynak:** V4/3.3  
**Mevcut Durum:** `loadTemplates()` tüm 10 şablonu başlangıçta `Promise.all` ile eş zamanlı yüklüyor.  
**Ne Gerekiyor:**
- Başlangıçta sadece `library.html` ve kritik modalleri yükle
- `navigation.js`'te sayfa geçişi yapıldığında, o sayfanın şablonu henülü değilse yükle
- Yüklenmiş şablonları önbelleğe al

**Etkilenen dosyalar:** `app.js` (`loadTemplates()`), `ui/viewRouter.js`

---

#### A4 — EventBus / Döngüsel Bağımlılık Temizliği
**Kaynak:** V4/3.4  
**Mevcut Durum:** `dataManager.js` ↔ `videoHandlers.js` döngüsel import bağımlılığı var. ES Modules'da döngüsel bağımlılık sessiz hataya yol açabilir; şimdiye kadar sorun çıkarmamış ama ilerleyen geliştirmelerde çıkarabilir.  
**Ne Gerekiyor:**
- Yeni `eventBus.js` dosyası: `trigger(event, data)` ve `listen(event, fn)` metodları
- `dataManager.js`, `videoHandlers.js`'den doğrudan fonksiyon çağırmak yerine event yayınlamalı
- `videoHandlers.js`, event'i dinleyip tepki vermeli

**Etkilenen dosyalar:** `eventBus.js` (yeni), `dataManager.js`, `videoHandlers.js`

---

### Grup B — Eksik Özellikler (İşlevsellik)

---

#### B1 — Kombinasyon Zinciri 1-Çok İlişkisi
**Kaynak:** V5/9  
**Mevcut Durum:** `addLink()` hâlâ tek hedefle çalışıyor. UI'da çoklu kombinasyon seçimi yok. Kod içinde yalnızca açıklama satırı var.  
**Ne Gerekiyor:**
- `chainManager.js`'teki `addLink()` çoklu hedefi desteklemeli
- Video modal'ında zincir ekleme UI'ı çoklu seçime izin vermeli
- `videoCardRenderer.js`'te kart üzerindeki zincir gösterimi çoklu linkleri göstermeli
- `video_links` tablo yapısı yeterli (değişmesi gerekmiyor)

**Not:** Gerçek tango akışı lineer değil, dallanma yapısı dans esnasındaki karar ağacını doğru modelliyor. Bu özellik zincir haritası görselleştirmesini de zenginleştirecek.

**Etkilenen dosyalar:** `chainManager.js`, `video-modal.html`, `videoCardRenderer.js`, `cards.css`

---

#### B2 — AI Otomatik Etiket Önerisi
**Kaynak:** V2/4.2  
**Mevcut Durum:** Hiç uygulanmamış. `aiTagSuggester.js` yok, `api/suggest-tags.js` Vercel fonksiyonu yok.  
**Ne Gerekiyor:**
- Vercel `api/suggest-tags.js` serverless fonksiyonu
- Anthropic API entegrasyonu (sistem promptu Arjantin Tango terminolojisi odaklı)
- `aiTagSuggester.js` dosyası: önerileri chip olarak render etmeli
- Video ekleme formunda AI öneri container'ı

**Teknik Şart:** Vercel projesi aktif olmalı, `ANTHROPIC_API_KEY` environment variable olarak tanımlanmalı.  
**Pratik Şart:** Bu özellik zaten YouTube metadata tam çekme (V2/4.1 — tamamlandı) üzerine inşa ediliyor. Başlık ve açıklamanın otomatik çekilmesi AI önerisi için girdi sağlayacak.

**Etkilenen dosyalar:** `api/suggest-tags.js` (yeni), `aiTagSuggester.js` (yeni), `formHandlers.js`, `views/add-video.html`, `styles/forms.css`

---

#### B3 — Herkese Açık Playlist Paylaşım Linki
**Kaynak:** V2/5.1  
**Mevcut Durum:** Hiç uygulanmamış.  
**Ne Gerekiyor:**
- Supabase'de `shared_playlists` tablosu (token bazlı, 30 günlük süre)
- `db/sharedPlaylists.js`: token oluşturma, token ile playlist çekme
- `views/shared-playlist.html`: auth gerektirmeyen salt okunur görünüm
- `sharedPlaylistViewer.js`: URL'den token okuyup playlist render etmeli

**Pratik Şart:** Bu özelliğin gerçek değeri öğrencilere pratik listesi gönderebilmek. Tek kullanıcı projesi olduğundan aciliyeti düşük.

**Etkilenen dosyalar:** `db/sharedPlaylists.js` (yeni), `views/shared-playlist.html` (yeni), `sharedPlaylistViewer.js` (yeni), `playlistManager.js`, `index.html`

---

#### B4 — PWA Manifest Tamamlama
**Kaynak:** V2/2.4  
**Mevcut Durum:** İkonlar `assets/logo/` altında ama `manifest.json`'da `shortcuts` ve `screenshots` alanları yok.  
**Ne Gerekiyor:**
- `manifest.json`'a `shortcuts` alanı: "Pratik Başlat" kısayolu
- `manifest.json`'a `screenshots` alanı
- İkon yollarının doğrulanması

**Etkilenen dosyalar:** `manifest.json`

---

#### B5 — Supabase Storage RLS Politikaları
**Kaynak:** V2/1.2  
**Mevcut Durum:** Kod tarafında doğrulanamıyor; panel ayarı.  
**Ne Gerekiyor:**
- Supabase Dashboard → Storage → Policies
- `covers` bucket için SELECT, INSERT, DELETE politikaları (`auth.uid() IS NOT NULL` şartıyla)

**Not:** Tek kullanıcı projesi için kritiklik düşük ama iyi pratik. Çok kullanıcıya geçilirse zorunlu hale gelir.

---

### Grup C — Gelecek Özellikler (Büyük Yatırımlar)

---

#### C1 — Quiz Modu
**Kaynak:** V4/5.6  
**Mevcut Durum:** Hiç uygulanmamış.  
**Ne Gerekiyor:**
- Yeni view: `views/quiz.html`
- Rastgele kombinasyon göster, kullanıcı adını/kategorisini tahmin etsin
- `practice_sessions` altyapısıyla entegre edilebilir
- Yeni sayfa + mantık gerektiriyor

---

#### C2 — Video İzleme İlerlemesi ("Kaldığın Yerden Devam Et")
**Kaynak:** V4/5.1  
**Mevcut Durum:** Hiç uygulanmamış.  
**Ne Gerekiyor:**
- Her 10 saniyede bir oynatma konumu kaydedilmeli (IndexedDB)
- Video tekrar açılınca "2:35'ten devam et" butonu

---

#### C3 — Etiket Ağ Haritası Görsel Render
**Kaynak:** V1/5.2  
**Mevcut Durum:** `computeTagNetwork()` fonksiyonu `computeStats.js`'te mevcut. Veri hesaplanıyor ama ekrana basılmıyor. `renderTagNetwork()` fonksiyonu ve `vis-network` CDN eklenmemiş.  
**Ne Gerekiyor:**
- `index.html`'e vis-network CDN eklenmeli
- `stats/` altına (veya mevcut bir dosyaya) `renderTagNetwork(networkData)` fonksiyonu
- `stats.html`'e ağ haritası container'ı

**Not:** `vis-network` zaten zincir haritası için projede kullanılıyor — CDN zaten var olabilir. Kontrol et.

---

#### C4 — Çok Kullanıcı Altyapısı
**Kaynak:** V2/5.2  
**Mevcut Durum:** Hiç başlanmamış. Uzun vade planı.  
**Ne Gerekiyor:**
- Tüm tablolara `user_id UUID` sütunu eklenmeli
- Mevcut veriler tek kullanıcıya atanmalı
- RLS politikaları "kendi verisini gör/yaz" mantığına güncellenmeli

**Şart:** B3 (Playlist paylaşım) ve auth tam stabil çalışıyor olmalı. Büyük migration riski — en sona bırakılmalı.

---

## ŞARTLı GÖREVLER

Bu bölüm, belirli şartlar oluştuğunda uygulanacak adımları tanımlar. Claude bu bölümü okuyarak hangi şart gerçekleştiğinde ne yapacağını anlayacak.

---

### ŞART: 800 Videoya Ulaşıldığında

**Tetikleyici:** Video koleksiyonu 800 adede ulaştı.

**Claude bu şartı duyduğunda şu adımları uygulayacak:**

**Önce A1 (Server-Side Filtering) — Zorunlu:**

Mevcut mimari 800 videoda belleği ve render'ı zorlayacak. Filtreler istemcide çalıştığı sürece her sayfa açılışında 800 video belleğe çekiliyor ve JavaScript'te filtreleniyor.

Yapılacaklar:
1. `tangoVeritabani.js` üzerinden `dbFetchVideosPage()` fonksiyonuna `filters` parametresi eklenmeli: `{ instructorId, platform, learningStatus, tag }`
2. Supabase'e PostgREST query parametre olarak gönderilmeli: `instructor_id=eq.{id}`, `platform=eq.{platform}`, `learning_status=eq.{status}`, `tags=ilike.*{tag}*`
3. `tangoFilters.js`'teki `getFilteredVideos()` sunucu filtreleme aktifken istemci filtresini atlamalı (sadece Fuse.js metin araması istemcide kalabilir)
4. `dataManager.js`'teki `fetchVideos()` aktif filtreleri sunucuya göndermeli
5. `videoHandlers.js`'teki `applyFiltersAndSearch()` filtre değiştiğinde sunucudan yeni çekim yapmalı

**Ardından A3 (Template Lazy Loading) — Önerilir:**

800 videoda açılış yüklemesi ağırlaşacak. 10 şablonun eş zamanlı yüklenmesi bunu daha da ağırlaştırıyor.

**Ardından A2 (Etiket Birleştirme Toplu İstek) — Kontrol Et:**

Etiket sayısı fazlaysa ve normalizasyon işlemi sık yapılıyorsa, 800 video × for döngüsü = çok fazla Supabase isteği.

**Dikkat:** A1 uygulanırken `tangoVeritabani.js` üzerinden çalış. `db/` altına doğrudan dokunma. Değişiklik öncesi hangi dosyaların etkileneceğini listele ve onay al.

---

### ŞART: Çok Kullanıcıya Geçiş Kararı Alındığında

**Tetikleyici:** Orhan "uygulamayı başkalarına açmak istiyorum" dedi.

**Claude bu şartı duyduğunda:**

1. Önce C4 (Çok Kullanıcı Altyapısı) için tam plan sun — hiçbir kod yazmadan
2. Tablolara eklenmesi gereken `user_id` sütunlarını listele
3. Mevcut tek kullanıcı verisinin yeni yapıya nasıl migration yapılacağını açıkla
4. RLS politika değişikliklerini listele
5. Orhan onayladıktan sonra başla

**Uyarı:** Bu değişiklik her tabloyu etkiliyor. Önce tam bir git commit al, Vercel preview deploy üzerinde test et, sonra production'a geçir.

---

### ŞART: Vercel Fonksiyonu Aktif Edildiğinde

**Tetikleyici:** Orhan "Vercel fonksiyonu kuralım" veya "AI etiket önerisini aktif et" dedi.

**Claude bu şartı duyduğunda B2 (AI Otomatik Etiket Önerisi) için:**

1. Vercel Dashboard → Settings → Environment Variables'da `ANTHROPIC_API_KEY` tanımlı mı kontrol et
2. `api/suggest-tags.js` serverless fonksiyonu oluştur
3. `aiTagSuggester.js` istemci dosyasını oluştur
4. Video ekleme formuna AI öneri container'ı ekle

**Not:** API anahtarı asla `www/` altındaki dosyalara gönderilmemeli. Sadece `api/` klasöründeki Vercel fonksiyonları bu değişkene erişebilir.

---

## BEKLEYEN ADIMLAR — ÖZET TABLO

| Kod | Grup | Açıklama | Değer | Şart |
|-----|------|----------|-------|------|
| A1 | Teknik Borç | Server-side filtering | 8/10 | 800 video eşiğinde zorunlu |
| A2 | Teknik Borç | Etiket birleştirme toplu istek | 6/10 | 500+ video + sık normalizasyon |
| A3 | Teknik Borç | Template lazy loading | 5/10 | 800 video eşiğinde önerilir |
| A4 | Teknik Borç | EventBus / döngüsel bağımlılık | 7/10 | Büyük özellik eklemeden önce |
| B1 | Eksik Özellik | Kombinasyon zinciri 1-çok | 7/10 | — (bağımsız) |
| B2 | Eksik Özellik | AI otomatik etiket önerisi | 7/10 | Vercel fonksiyonu aktif olmalı |
| B3 | Eksik Özellik | Playlist paylaşım linki | 5/10 | — (bağımsız) |
| B4 | Eksik Özellik | PWA manifest tamamlama | 4/10 | — (bağımsız, kolay) |
| B5 | Eksik Özellik | Supabase Storage RLS | 7/10 | Panel ayarı (kod değil) |
| C1 | Gelecek | Quiz modu | 6/10 | Diğer A ve B grubu bittikten sonra |
| C2 | Gelecek | Video izleme ilerlemesi | 5/10 | — |
| C3 | Gelecek | Etiket ağ haritası görsel | 6/10 | vis-network CDN kontrolü yap |
| C4 | Gelecek | Çok kullanıcı altyapısı | 2/10 | B3 + auth stabil + açık karar |

---

## ÇALIŞMA PROTOKOLÜ

Bu bölüm Claude'un her geliştirme oturumunda uyacağı kurallardır.

1. **Model ve efor tavsiyesi:** Her görev başında Sonnet/Opus ve Low/Medium/High/Max tavsiye et. Orhan onayladıktan sonra başla.
2. **Git commit hatırlatması:** Kodlamaya başlamadan önce Orhan'a commit almasını hatırlat.
3. **Dosyayı oku, satır sayısını kaydet:** Değişiklik öncesi dosyayı oku ve satır sayısını raporla. Değişiklik sonrası yeni satır sayısını raporla. "Öncesi: X satır → Sonrası: Y satır"
4. **Tek adım:** Bir adımda bir iş. Adım sonrası test kontrol listesi sun, onay al, sonraki adıma geç.
5. **Kapsam disiplini:** Sadece istenen değişikliği yap. Alakasız dosyaya dokunma.
6. **tangoVeritabani.js kuralı:** DB işlemleri için her zaman bu facade'ı kullan. `db/` altından doğrudan import yapma.
7. **Büyük kararlarda onay:** Birden fazla dosyayı etkileyen değişikliklerde önce karşılaştırma tablosu sun, satır satır onay al, sonra uygula.

### Model/Efor Rehberi

| Seviye | Ne Zaman |
|--------|----------|
| Sonnet Low | Kozmetik veya izole değişiklikler (1-5 satır) |
| Sonnet Medium | Orta düzey JS işleri (5-20 satır, tek dosya) |
| Sonnet High | Çok dosyalı mantık değişiklikleri (20+ satır) |
| Opus | Mimari kararlar, büyük refaktör |
