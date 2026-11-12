# Pharmind — Onaylanan ürün kararları

Bu belge geliştirme sürecinin **bağlayıcı ürün ilkelerini** kaydeder. Teknik bir tercih bu kararları sessizce değiştiremez; değişiklik gerekiyorsa önce söylenir. Ayrıntılı V1 kapsamı için `docs/v1-spec.md`.

**Vizyon: Oyna · Keşfet · Ustalaş.** Amaç mevcut bilgi sisteminin üzerine oyun süsü eklemek değil; bilimsel altyapısı sağlam, doğrudan oynanmak için tasarlanmış bir eczacılık öğrenme uygulaması.

## Kesinleşen kararlar

1. Ana ekran kişisel öğrenme merkezi ile konu haritasını birleştirir.
2. Mini oyun çeşitliliği ana deneyimdir. Kısa çoktan seçmeli sorular ve eczane senaryoları destekleyicidir.
3. **Derinleş** her zaman erişilebilir. Kullanıcının gelişimine göre önerilebilir; asla zorunlu veya kilitli değildir.
4. Ana motivasyon merak ve ustalaşmadır. XP, rozet ve koleksiyon güçlü destekleyicidir. Rekabet ve ligler sonraki sürümlere kalır.
5. İlk oynanabilir sürüm soru bankası gibi hissettirmez; farklı mini oyunlar gerçekten oynanır.
6. İlk prototip magnezyum temalı **demo** içerikle yapılır. Bu içerik onaysız/test içeriğidir, gerçek kullanıcıya yayınlanmaz ve üretim öğrenme kayıtlarını değiştirmez.
7. Güven bildirimi zorunlu değildir; kullanıcı isteğe bağlı olarak tahmin ettiğini belirtebilir. **Bildirim yokluğu otomatik `sure` sayılmaz.**
8. Daily 5 **veya** anlamlı biçimde tamamlanmış bir Derinleş oturumu günlük hedefi tamamlar. Aynı günde ikisi günlük tamamlanmayı iki kez işletmez.
9. Temel bilgi ve Derinleş mastery ölçümleri ayrıdır. Arayüzde sade göstergeler ve ustalık unvanlarıyla sunulur.
10. XP katılım ile küçük bir doğruluk bonusunu birlikte ödüllendirir. Hız bonusu yoktur; tekrar oynayarak sınırsız XP toplanamaz. XP bilgi mastery ölçümünü etkilemez.

## Geliştirme sırası

| Aşama | Konu | Durum |
|---|---|---|
| M0 | Teknik doğrulama | Tamamlandı (aşağıda) |
| M1 | İlk oynanabilir prototip (izole, demo içerik) | Tamamlandı (PR #3; yalnızca web) |
| M2 | Güvenli öğrenme entegrasyonu: ayrı oturum durumları, isteğe bağlı güven, FSRS politikası, tek günlük tamamlanma, ayrı Temel/Derinleş mastery | Sürüyor: M2-1 (isteğe bağlı "Tahmin ettim", kayıt türleri, politika v0) bu PR; diğer parçalar sonraki PR'lar |
| M3 | Ana ekran ve keşif: Oyna / Keşfet / Ustalaş, magnezyum haritası | Planlandı |
| M4 | Ödüller: XP, rozet, idempotency ve istismar önlemleri | Planlandı |
| M5 | Bilimsel içerik entegrasyonu: yalnızca onaylı ContentPack hattından | Planlandı |
| M6 | Küçük pilotla kullanıcı testi | Planlandı |

## Geliştirme kuralları

- Küçük, incelenebilir PR'lar. Mevcut testler ve CI korunur.
- Demo ve gerçek içerik sınırı açık tutulur.
- Karmaşık soyutlama yerine çalışan deneyim önceliklidir; gereksiz bağımlılık eklenmez.
- Bilimsel onay ve release-lock güvenliği devre dışı bırakılmaz.
- Öğrenme başarısı yalnızca XP veya oyun tamamlama sayısıyla ölçülmez.
- Ürün kararları yeni teknik tercihler nedeniyle sessizce değiştirilmez.

## M0 bulguları (2026-11-03)

- Mevcut kod tabanı: 14 test paketi, **667 test** geçiyor; `tsc --noEmit` ve `eslint` temiz.
- Web dışa aktarım (`expo export --platform web`) ek bağımlılık olmadan çalışıyor (yaklaşık 2,6 MB, tek 1,2 MB paket) ve tarayıcıda oynanıyor.
- Mevcut oturum, seçenekten sonra zorunlu güven adımı ister ve ilk cevapta tarayıcıda `pharmind:v1:progress` anahtarını yazar. Prototip bu yola girmez.
- `ReviewRecord.confidence` zorunludur; `cellFor` ve `summarize` `sure` olmayanı "kararsız doğru" sayar. "Güven bildirilmedi" bilgisi bugün saklanamaz (M2 kararı).
- `answer()` son kartta günü kendiliğinden tamamlar; Derinleş için oturum türü gerekir (M2). `markSessionComplete` zaten gün başına tekildir.
- `conceptMastery` tüm kartları eşit ağırlıkla ortalar; görülmemiş derin kartlar Temel'i seyreltir. Temel ve Derinleş mastery ayrımı çağıran tarafta listeyi süzerek yapılabilir (M2).
- `Card.level` henüz onaylanmadı. Seçenekler (alan / kimlikte kodlama / pakette eşleme tablosu / yapıdan türetme) M2'de açık teknik karar olarak değerlendirilecek. Alanın `coreHash` kapsamında olmaması, yayınlanmış kartın sessizce yeniden sınıflanmasına izin verir; bu nedenle karar release-lock ilk dolmadan önce verilmelidir.
- `ALLOW_DEMO_CONTENT = true`: bugünkü üretim yolu demo kartları gösterir; gerçek içerik gelmeden önce kapatılmalıdır.

## M2-1: isteğe bağlı "Tahmin ettim", kayıt türleri, politika v0

**Davranış değişiklikleri (gerçek oturum):** cevap tek dokunuşla verilir; zorunlu ikinci "ne kadar eminsin" adımı kalktı. Cevaptan önce isteğe bağlı "Tahmin ettim" işaretlenebilir ve yalnızca o kart için geçerlidir. Aynı kartın hızlı çift dokunuşu tek cevap sayılır (sağlayıcı yalnızca oturumdaki sıradaki kartı kabul eder).

**Kayıt türleri (`Progress.history`):**
- **V1 (eski):** `recordVersion` alanı yok; `confidence: 'sure' | 'unsure' | 'guess'` zorunlu. Okunurken ve yeniden yazılırken **değiştirilmez**; alan eklenmez, ona politika sürümü yazılmaz. Anlamı eskisi gibidir (doğru ve `sure` değil → kararsız doğru).
- **V2 (yeni):** `recordVersion: 2`, `selfReport: 'guess' | 'none'`, `optionCount`, `policy: { version, grade }`. **`none` yalnızca "bildirim verilmedi" demektir**; emin veya kararsız olarak yorumlanmaz, `confidence` alanı hiç yazılmaz.
- Depodan okurken geçersiz, tanınmayan sürümlü veya eksik alanlı kayıtlar atlanır (tahmin edilerek yorumlanmaz). `Progress.version` 1 kalır.

**Politika v0 (`v0-experimental`, DENEYSEL):** yanlış → Again (tahmin işareti sonucu değiştirmez); doğru + tahmin işaretli → Hard; doğru + işaretsiz → Good; Easy yok. **Good, kullanıcının emin olduğu anlamına gelmez;** yalnızca zamanlama kararıdır. Politikanın öğrenme başarısını artırdığı **kanıtlanmış değildir**; pilotta sonraki tekrar doğruluğuyla karşılaştırılacaktır. Her V2 kayıt sürümü, uygulanan dereceyi ve girdileri (`correct`, `selfReport`, `optionCount`) taşır.

**Geçmiş sınırı:** `HISTORY_LIMIT = 500` korunur. Kayıtta politika sürümü bulunması, geçmişin eksiksiz yeniden oynatılabileceği anlamına **gelmez**: eski kayıtlar silinir ve kartların FSRS durumu eski (güven tabanlı) ve yeni politikayla karışık hesaplanmıştır; geçmişten yeniden türetilemez. Tam yeniden hesaplama ve saklama mimarisi ayrı bir karardır (bu PR'da yok).

**Özetler:** "emin olduğu halde yanlış" (`legacyConfidentErrors`) yalnızca eski V1 güven bildirimlerinden hesaplanır; yeni cevaplardan türetilmez ve oturum ekranında artık gösterilmez. Blister: ✓ doğru, ? doğru ama işaretli (yeni "Tahmin ettim" ya da eski kararsız/tahmin bildirimi; ekran okuyucu açıklaması ikisini birbirine eşitlemez), ✕ yanlış.

**Vaka (THINK) kararları değişmedi:** FSRS derecesi karar seçeneğinin içerik tanımlı derecesinden gelir (uygun → Good, kabul → Hard, uygun değil → Again); kart cevabı politikasına bağlı değildir ve geçmişe kayıt yazılmaz.

### Sonraki M2 PR'ları için kararlar (kodlanmadı)

- **`Card.level`:** Alan olarak ekleyip `coreHash`'e dahil etme yönü uygun bulundu; ancak alanın tek başına yeni öğrenme kimliği oluşturduğu varsayılmaz. Kimlik, yeniden sınıflandırma ve mevcut ilerleme politikası kodlamadan önce açıklanacak.
- **Derinleş seti:** Beş kartlık set yalnızca adaydır. Beşten az uygun kart olduğunda ne olacağı tanımlanmadan sabitlenmez.
- **Vakalar** şimdilik günlük hedefi tamamlamaz.
- **Gece yarısı:** "Tamamlayan cevabın günü sayılır" kararı, mevcut kodun oturumu geçersiz sayma davranışı (`session.day === dayKey(now)` ana ekranda) incelenmeden uygulanmaz.
- **Yarım oturumun kalıcılaştırılması** M2-1 dışındadır.

## Eski: FSRS değerlendirme politikası notu (M0)

Güven bildirimi olmadan doğru/yanlış ve eşleştirme hatalarından `Hard/Good/Again` üretmenin güvenilir olduğu **kanıtlanmış kabul edilmez**. Politika sürümlü, girdileriyle birlikte kaydedilen bir öneri olarak ele alınır; M1 prototipi FSRS'e hiçbir şey yazmaz.

## M1 prototipinin sınırları

- Prototip kodu `app/src/prototype/` ve `app/src/app/lab.tsx` altındadır. Mevcut `progress`, FSRS, mastery, XP, seri, depolama ve `release-lock` modüllerini içe aktaramaz (otomatik test).
- **Sağlayıcı duraklatılır, çıkarılmaz:** `ProgressProvider` kök yerleşimde her zaman aynı yerde kalır; bayrak açıkken `/lab` yolunda `paused` olur ve diskten okuma yapmaz (yedek yazma yolu da açılmaz). Sağlayıcıyı ağaçtan çıkarıp geri eklemek `Stack`'i yeniden kurar, gezinme yığınını ve süren oturumu sıfırlar; bu, gerçek Router ile yazılmış testle görüldü ve bu yüzden tasarım değişti. `progress-context.tsx`'e eklenen tek davranış `paused` özelliğidir.
- **Gerçek uygulamaya çıkış yoktur:** "Çık/Kapat" demo içinde kalan bir kapanış ekranı açar. Gerçek uygulama ilerleme kaydeden ayrı bir deneyimdir; prototipten ona geçiş verilmez.
- Hiçbir şey kalıcı değildir; sayfa yenilenince sıfırlanır.
- **Bayraksız derlemede prototip pakette yoktur:** `metro.config.js`, `EXPO_PUBLIC_LAB=1` değilken `src/prototype` ve `/lab` rotasını Metro'dan gizler; bayraksız yapıda `/lab` "Unmatched Route" sayfasını açar (yönlendirme yoktur). Üretim (`NODE_ENV=production`) derlemesinde bayrak açıkken `npm run export:lab` dışında derleme **durur**; `export:web`, ortamda bayrak herhangi bir değerle ayarlıysa reddeder.
- Beş etkinlik onaysız test içeriğidir ve gerçek eğitim havuzuna (`playableCards`, `masteryCards`, `release-lock`) girmez. `LAB_SOURCE` kaynağı ve inceleme durumunu izlenebilir tutar; bu üstveri **bilimsel onay değildir** (inceleyen ve tarih eczacı onayına kadar boştur).

### Doğrulama kapsamı (ne kanıtlanır, ne kanıtlanmaz)

- Jest: gerçek kök yerleşim + gerçek Expo Router + gerçek `ProgressProvider` ile `/lab` (boş, geçerli, bozuk kayıt); depolama çağrıları izlenir, hiçbiri olmamalıdır. Pozitif kontrol: aynı bozuk kayıt gerçek ana sayfada yedekleme yazar. Gerçek uygulama → `/lab` → geri akışında gezinme yığını ve oturum korunur. Taklit edilenler yalnızca depolama (AsyncStorage) ve yazı tipi yükleyicisidir.
- `npm run verify:lab-build` (CI'da `web-build`): açık → kapalı → açık → kapalı dört web derlemesi. **Hepsi `--clear` kullanır; bu, önbellek temizlenmeden bayrak değişiminin güvenli olduğunu kanıtlamaz.** Çıktıdaki tüm metin dosyaları, `src/prototype` altındaki kod içi metin değişmezleri ve kimlikler için (ham ve `\uXXXX` kaçışlı) taranır; bayrak kapalıyken hiçbiri bulunmamalıdır. Başsız Chrome ile `/lab`: açıkken prototip görünür, kapalıyken görünmez.
- **Android/iOS doğrulanmadı.** Tüm derleme ve tarayıcı denetimleri yalnızca web içindir.
- Tarayıcı oynanışı (beş etkinlik) CI'da değil, yerel elle çalıştırılan bir tarayıcı denemesinde gözlendi.

### Önizleme derlemesi

`npm run export:lab` (bayraklı) ve `npm run export:web` (bayraksız) `scripts/export-web.mjs` üzerinden çalışır; **`--clear` her zaman verilir**. Statik çıktı tek sayfa (`web.output: single`) olduğundan `/lab` yolunu `index.html`'e düşüren bir sunucu gerekir.
