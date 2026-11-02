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
| M1 | İlk oynanabilir prototip (izole, demo içerik) | Bu PR |
| M2 | Güvenli öğrenme entegrasyonu: ayrı oturum durumları, isteğe bağlı güven, FSRS politikası, tek günlük tamamlanma, ayrı Temel/Derinleş mastery | Planlandı |
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

## FSRS değerlendirme politikası (kanıtlanmış değildir)

Güven bildirimi olmadan doğru/yanlış ve eşleştirme hatalarından `Hard/Good/Again` üretmenin güvenilir olduğu **kanıtlanmış kabul edilmez**. M2'de politika sürümlü, girdileriyle birlikte kaydedilen ve pilotta sonraki tekrar doğruluğuyla karşılaştırılan bir öneri olarak ele alınır. M1 prototipi FSRS'e hiçbir şey yazmaz.

## M1 prototipinin sınırları

- Tüm kod `app/src/prototype/` ve `app/src/app/lab.tsx` altındadır. Mevcut `progress`, FSRS, mastery, XP, seri, depolama ve `release-lock` dosyalarını içe aktaramaz (otomatik test).
- Hiçbir şey kalıcı değildir; sayfa yenilenince sıfırlanır.
- Rota yalnızca `EXPO_PUBLIC_LAB=1` ile derlenmiş bir yapıda açılır; aksi halde ana sayfaya yönlendirir.
- Beş etkinlik onaysız test içeriğidir ve gerçek eğitim havuzuna (`playableCards`, `masteryCards`, `release-lock`) girmez.

### Önizleme derlemesi

`EXPO_PUBLIC_LAB=1 npx expo export --clear --platform web --output-dir <klasör>` (`app/` dizininde). **`--clear` şarttır:** Metro, bayrağın değerini dönüştürülmüş modülde önbellekte tutar; bayrak değiştirilip `--clear` verilmezse bayraksız derleme de `/lab` rotasını açık bırakabilir (M1 doğrulamasında görüldü). Statik çıktı tek sayfa (`web.output: single`) olduğundan `/lab` yolunu `index.html`'e düşüren bir sunucu gerekir.
