# ATTK Yol Haritası Analiz Raporu

**Tarih:** 2026-08-07  
**Proje:** tango-reels-library (Arjantin Tango Kombinasyon Koleksiyonu)

---

## ATTK_Yol_Haritası_V1.md

Toplam **25 adım** incelendi. **23 adım yapılmış**, **2 adım yapılmamış**.

**Yapılmayan adımlar:**

- **4.3 — Server-Side Filtering (Tam):** `dbFetchVideosPage()` filtre parametresi almıyor. Eğitmen, platform, öğrenme durumu ve etiket filtreleri hâlâ istemci tarafında uygulanıyor; Supabase'e yalnızca sayfalama parametresi gönderiliyor.
- **5.2 — Etiket Ağ Haritası Görsel Render:** `computeTagNetwork()` fonksiyonu `computeStats.js`'te mevcut ancak `renderTagNetwork()` fonksiyonu yok ve `vis-network` CDN eklenmemiş. Veri hesaplanıyor ama görsel olarak ekrana basılmıyor.

---

## ATTK_Yol_Haritası_V2.md

Toplam **15 adım** incelendi. **10 adım yapılmış**, **5 adım yapılmamış**.

**Yapılmayan adımlar:**

- **1.2 — Supabase Storage RLS Politikaları:** Panel üzerinden yapılması gereken bir ayar; kod tarafında doğrulanamıyor ama belgelenmiş bir adım olarak eksik kalmış.
- **2.4 — PWA Manifest Eksiklikleri:** `manifest.json`'da `shortcuts` ve `screenshots` alanları yok. İkonlar mevcut ama yol haritasında belirtilen `/icons/` yerine `assets/logo/` altında.
- **4.2 — AI Otomatik Etiket Önerisi:** `aiTagSuggester.js` dosyası yok. Vercel'de `api/suggest-tags.js` endpoint'i yok. Form alanında AI öneri container'ı yok.
- **5.1 — Herkese Açık Playlist Paylaşım Linki:** `db/sharedPlaylists.js`, `views/shared-playlist.html` ve `sharedPlaylistViewer.js` dosyaların hiçbiri yok.
- **5.2 — Çok Kullanıcı Altyapısı:** Tablolarda `user_id` sütunu yok. (Uzun vadeli adım olarak işaretlenmiş.)

---

## ATTK_Yol_Haritası_V3.md

Toplam **18 adım** incelendi. V3 içeriği büyük ölçüde V4 ile örtüşüyor; çakışan adımlar V4 kapsamında değerlendirildi. Bağımsız olarak değerlendirilen adımların tamamı ya uygulanmış ya da V4 altında raporlanmış durumda.

**Yapılmayan adım: 0** (V4 ile çakışan adımlar V4 raporunda yer alıyor.)

---

## ATTK_Yol_Haritası_V4.md

Toplam **22 adım** incelendi. **17 adım yapılmış**, **5 adım yapılmamış**.

**Yapılmayan adımlar:**

- **3.1 — Etiket Birleştirme Toplu İstek:** `dbMergeTagsNormalized()` hâlâ iç içe `for` döngüsüyle video başına ayrı Supabase isteği gönderiyor. Toplu `IN` sorgusu uygulanmamış.
- **3.3 — Template Lazy Loading:** `loadTemplates()` tüm 10 şablonu başlangıçta `Promise.all` ile eş zamanlı yüklüyor. Sayfa geçişinde yükle (lazy) yaklaşımı uygulanmamış.
- **3.4 — EventBus / Döngüsel Bağımlılık Temizliği:** `eventBus.js` dosyası yok. `dataManager.js` ↔ `videoHandlers.js` döngüsel bağımlılığı devam ediyor.
- **4.5 — Küçük UX İyileştirmeleri (2 madde):** Navigation menüsünde playlist başlığının yanında video sayısı gösterilmiyor. Çevrimdışı kuyrukta bekleyen işlem varsa simge/rozet gösterilmiyor.
- **5.6 — Quiz Modu:** Hiçbir dosyada iz yok; tamamen uygulanmamış.

---

## ATTK_Yol_Haritası_V5.md

Toplam **10 adım** incelendi. **9 adım yapılmış**, **1 adım yapılmamış**.

**Yapılmayan adım:**

- **9 — Kombinasyon Zinciri 1-Çok İlişkisi:** `addLink()` hâlâ tek hedefle çalışıyor. UI'da çoklu kombinasyon seçimi yok. Kod içinde yalnızca açıklama satırı ("multiple combinations can be added") mevcut; implementasyon yapılmamış.

---

## Yapılmayan Tüm Adımlar — Birleşik Liste ve Değerlendirme

| # | Kaynak | Adım | Açıklama | Değer Puanı (1-10) |
|---|--------|------|----------|-------------------|
| 1 | V1 | 4.3 | Server-side filtering | 8 |
| 2 | V1 | 5.2 | Etiket ağ haritası görsel | 6 |
| 3 | V2 | 1.2 | Supabase Storage RLS | 7 |
| 4 | V2 | 2.4 | PWA manifest (shortcuts/screenshots) | 4 |
| 5 | V2 | 4.2 | AI otomatik etiket önerisi | 7 |
| 6 | V2 | 5.1 | Herkese açık playlist paylaşım linki | 5 |
| 7 | V2 | 5.2 | Çok kullanıcı altyapısı | 2 |
| 8 | V4 | 3.1 | Etiket birleştirme toplu istek | 6 |
| 9 | V4 | 3.3 | Template lazy loading | 5 |
| 10 | V4 | 3.4 | EventBus / döngüsel bağımlılık | 7 |
| 11 | V4 | 4.5a | Playlist menüsünde video sayısı | 3 |
| 12 | V4 | 4.5b | Çevrimdışı kuyruk simgesi | 3 |
| 13 | V4 | 5.6 | Quiz modu | 6 |
| 14 | V5 | 9 | Kombinasyon zinciri 1-çok | 7 |

---

## Detaylı Değerlendirme

### 1. Server-Side Filtering — Değer: 8/10

**Ne:** Filtreleme işleminin istemciden Supabase'e taşınması.

**Artıları:**
- Video sayısı arttıkça (800+) istemci tarafı filtreleme bellek ve render sorununa yol açacak.
- Ağ üzerinden gereksiz veri çekilmiyor; yalnızca eşleşen kayıtlar geliyor.
- Sayfalama ile birleşince gerçek anlamda ölçeklenebilir hale geliyor.

**Eksileri:**
- `dbFetchVideosPage()` imzası değişeceği için tüm çağıran yerler güncellenmeli.
- Supabase sorgu karmaşıklığı artıyor; test etmek zaman alıyor.

---

### 2. Etiket Ağ Haritası Görsel — Değer: 6/10

**Ne:** `computeTagNetwork()` verisi üzerinden `vis-network` ile interaktif graf çizimi.

**Artıları:**
- Hangi etiketlerin hangi kombinasyonlarda birlikte göründüğü görsel olarak anlaşılıyor.
- Eğitim planlamasında hangi tekniklerin birbiriyle bağlantılı olduğunu görmek işe yarıyor.

**Eksileri:**
- `vis-network` CDN bağımlılığı geliyor; sayfa yük ağırlığı artıyor.
- Etiket sayısı fazlaysa graf okunaksız hale gelebilir; filtreleme/kümeleme gerektirebilir.

---

### 3. Supabase Storage RLS — Değer: 7/10

**Ne:** Kapak görseli yükleme bucket'ına Row Level Security politikası eklenmesi.

**Artıları:**
- Kötü niyetli isteklerin başka kullanıcıların dosyalarını silmesini/değiştirmesini engeller.
- Tek kullanıcılı projede bile iyi pratik; ileride çok kullanıcıya geçilirse zorunlu.

**Eksileri:**
- Panel ayarı olduğu için kod tarafında izlenemez; unutulması kolay.

---

### 4. PWA Manifest (Shortcuts/Screenshots) — Değer: 4/10

**Ne:** Android ve masaüstü için kısayol eylemleri ve mağaza ekran görüntüleri eklenmesi.

**Artıları:**
- `shortcuts` ile ana ekrana uzun basınca hızlı eylem menüsü çıkıyor (örn. "Pratik Başlat").
- `screenshots` Play Store / PWA mağazalarında daha profesyonel görünüm sağlıyor.

**Eksileri:**
- Tek kullanıcı projesi olduğu için mağaza görünümü anlamsız.
- `shortcuts` faydalı ama düşük öncelikli.

---

### 5. AI Otomatik Etiket Önerisi — Değer: 7/10

**Ne:** Video başlığı/açıklamasından Vercel serverless fonksiyon aracılığıyla otomatik etiket önerisi.

**Artıları:**
- Yeni video eklerken etiket seçme süresini kısaltıyor.
- Etiket tutarlılığını artırıyor (benzer içerikler aynı etiketleri alıyor).

**Eksileri:**
- Vercel fonksiyonu + dış AI API maliyeti ve gecikme getiriyor.
- Tango terminolojisi spesifik; genel AI modeli yanlış etiket önerebilir, her önerinin manuel onayı gerekli.

---

### 6. Herkese Açık Playlist Paylaşım Linki — Değer: 5/10

**Ne:** Bir playlist'i benzersiz URL ile paylaşılabilir kılmak; görüntüleyen login gerektirmeden açabiliyor.

**Artıları:**
- Öğrencilere veya diğer eğitmenlere pratik listesi göndermek kolaylaşıyor.

**Eksileri:**
- Şu an tek kullanıcı projesi; paylaşım ihtiyacı sınırlı.
- `shared-playlist.html` + backend logic önemli geliştirme süresi gerektiriyor.

---

### 7. Çok Kullanıcı Altyapısı — Değer: 2/10

**Ne:** Tablolara `user_id` ekleyerek birden fazla kullanıcıyı desteklemek.

**Artıları:**
- İleride uygulamayı başkalarına açmak isterse temel altyapı hazır olur.

**Eksileri:**
- Şu an tek kullanıcı; tüm tabloları değiştirmek büyük migration riski.
- Önce diğer tüm adımlar tamamlanmalı.

---

### 8. Etiket Birleştirme Toplu İstek — Değer: 6/10

**Ne:** `dbMergeTagsNormalized()` içindeki `for` döngüsünü toplu Supabase sorgusuna çevirmek.

**Artıları:**
- Çok sayıda video etiket normalizasyonunda ciddi hız farkı yaratıyor.
- Supabase istek limitine çarpma riski azalıyor.

**Eksileri:**
- Nadir kullanılan bir işlem; aciliyet düşük.

---

### 9. Template Lazy Loading — Değer: 5/10

**Ne:** 10 HTML şablonunun başlangıçta yüklenmesi yerine ihtiyaç anında yüklenmesi.

**Artıları:**
- İlk yükleme süresi kısalıyor.
- Kullanılmayan şablonlar ağ isteği harcamıyor.

**Eksileri:**
- Şablon boyutları küçükse ve `Promise.all` paralel yüklüyorsa pratik fark minimal.
- Lazy loading hatalı uygulanırsa sayfa geçişlerinde görünür gecikme çıkabiliyor.

---

### 10. EventBus / Döngüsel Bağımlılık Temizliği — Değer: 7/10

**Ne:** `dataManager.js` ↔ `videoHandlers.js` döngüsel import bağımlılığını `eventBus.js` ile çözmek.

**Artıları:**
- Döngüsel bağımlılıklar ES Modules'da sessiz hataya yol açabiliyor; temizlenmesi kararlılığı artırıyor.
- Uzun vadede kod tabanını genişletmek kolaylaşıyor.

**Eksileri:**
- Mevcut kod çalışıyor; refaktör riski taşıyor.
- EventBus pattern'i yanlış uygulanırsa hata izlemeyi zorlaştırıyor.

---

### 11 & 12. Playlist Video Sayısı ve Çevrimdışı Kuyruk Simgesi — Değer: 3/10

**Ne:** Navigation'da küçük UX iyileştirmeleri.

**Artıları:**
- Kullanıcıya anlık durum bilgisi veriyor (playlist'te kaç video var, çevrimdışı kuyruğu dolu mu).

**Eksileri:**
- Küçük kozmetik değişiklikler; işlevsellik üzerinde sıfır etkisi.

---

### 13. Quiz Modu — Değer: 6/10

**Ne:** Kombinasyonları rastgele gösterip kullanıcının adını/kategorisini tahmin ettiği oyunlaştırma modu.

**Artıları:**
- Kombinasyon ismini/kategorisini ezberlemek için etkili öğrenme aracı.
- Mevcut `practice_sessions` altyapısıyla entegre edilebilir.

**Eksileri:**
- Önemli geliştirme süresi gerektiriyor (yeni view + mantık).
- Tek kullanıcı projesi; oyunlaştırma motivasyonu sınırlı.

---

### 14. Kombinasyon Zinciri 1-Çok İlişkisi — Değer: 7/10

**Ne:** Bir kombinasyondan birden fazla farklı kombinasyona zincir bağlantısı kurabilmek.

**Artıları:**
- Gerçek tango akışı lineer değil; dallanma yapısı dans esnasındaki karar ağacını doğru modelliyor.
- Zincir haritası görselleştirmesi çok daha zengin hale geliyor.

**Eksileri:**
- `addLink()` ve ilişkili UI'ın yeniden yazılması gerekiyor.
- `video_links` tablo yapısının değişmesi gerekebilir.
