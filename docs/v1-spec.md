# V1 spesifikasyonu (taslak)

> Durum: **taslak**. Çerçeve, planlama konuşmasından çıkarıldı. Kullanıcının kendi notlarıyla çatıştırılıp netleştirilecek. `[?]` işaretli yerler açık sorudur.
>
> **Karar kaydı (2026-11-02):** V1'in konu alanı dermokozmetikten **vitamin, mineral ve seçilmiş takviye edici gıdalara** alındı; ilk gerçek içerik konusu **magnezyum**. Dermokozmetik başlangıç kapsamından çıktı, ileride ayrı bir kategori olarak eklenebilir. Ayrıntı: §3 ve "Kapsam kararı" bölümü.

## 1. Ürün mimarisi

Dört modül ayrı uygulamalar değil, **aynı bilginin dört kullanım düzeyidir**; hepsi tek bir **kavram grafiği** üzerine kurulur.

- **Kavramlar:** etken madde, endikasyon, mekanizma, etkileşim, kırmızı bayrak, danışmanlık noktası (konuya göre başka kavram türleri de eklenebilir). Her kavramın bir **mastery** skoru vardır.
- **KNOW:** kavramları kart olarak çalıştırır (FSRS).
- **THINK / ACT:** kavramları bir vakada birleştirir. THINK yavaş ve gerekçeli, ACT hızlı. Aynı vaka motorunu kullanırlar. (V1'de yalnızca THINK.)
- **BUILD:** kavramları üretim görevinde sınar. (V2+)
- Her cevap ilgili kavramların mastery skorunu günceller; Daily 5 bu skorlara göre seçilir.

Learning DNA ayrı bir özellik değil, bu grafiğin çıktısıdır. V1'de **mastery haritası** olarak başlar.

## 2. Core loop (5 dakika)

1. **Açılış (0:00):** tek ekran, tek eylem: "Bugünkü oturum".
2. **Isınma (~2 dk):** 5 kart; her cevaptan önce güven seçimi (emin / kararsız / tahmin).
3. **Günün vakası (~2,5 dk):** kısa bir hasta, 3–4 karar noktası, soru bütçesi.
4. **Kapanış (~30 sn):** "Tezgahta ne derdin?" tek cümlelik danışmanlık özeti ve yarına bir kanca.
5. **Bitiş:** oturum sonludur.

## 3. V1 kapsamı

**Konu alanı:** **vitaminler, mineraller ve seçilmiş takviye edici gıdalar.** İlk gerçek içerik konusu **magnezyum**. Sonrasında D vitamini, kalsiyum, demir, B12, çinko ve benzeri eczane ürünleriyle genişlenir. Eğitim **bilimsel kavram merkezlidir**; marka veya ticari ürün merkezli değildir. Dermokozmetik başlangıç kapsamında **yoktur** (ileride ayrı kategori olarak eklenebilir).

**Öncelikli katmanlar:** V1'de KNOW ve THINK. ACT ve BUILD vizyonda kalır (§5).

**Durum (dürüst özet):** uygulama mekanikleri çalışıyor; uygulamadaki içerik hâlâ yalnızca demo. İçerik şeması ve doğrulama sistemi (Stage 1) tamamlandı; **bilimsel içerik paketleri henüz uygulamaya yüklenmiyor, uygulamada oynanamaz.** Magnezyum içeriği henüz üretilmedi.

| Özellik | Not |
|---|---|
| Daily 5 | FSRS aralıklı tekrar + güven seçimi |
| Günün vakası | Elle yazılmış, "elmas yapısı" (dallanıp aynı noktada birleşen), sınırlı dallanma |
| Soru bütçesi | Vakada hastaya sınırlı sayıda soru sorulur; hangi bilgiyi istediği puanlanır |
| Mastery haritası | Kavram bazında renkli harita |
| Haftalık streak | Haftalık hedef + dondurma hakkı |
| "Cevabı açıkla" | Önceden hazırlanmış, denetlenmiş açıklamalar |
| "Hasta geri geldi" | Dünkü vakanın sonucu ertesi gün döner (V1'e alındı, uygulandı) |

## 4. V1 dışı (bilerek yok)

AI Patient, canlı AI içerik üretimi, leaderboard, time attack, Pharmacy Simulator, haber/bilimsel içerik modülü, Routine/Supplement/Magistral Builder, vitamin, mineral ve takviye dışındaki konu alanları (dermokozmetik dahil), eczane işletme araçları.

Not: Supplement Builder (bir **araç**) V1 dışıdır; takviye **içeriği** (kavram, kart, vaka) ise V1 kapsamındadır. İkisi aynı şey değildir.

## 5. Sonraki sürümler

- **V2:** yanlış cevap analizi, kişiselleştirilmiş rota, ACT modu (hızlı vaka), Routine Builder, AI ile vaka *taslağı* (yayın öncesi onaylı)
- **V3:** diğer konu alanları (dermokozmetik ayrı kategori olarak dahil), eczane ekibi modu, Supplement ve Magistral Builder, haber modülü (editör kontrollü)
- **V4+:** Pharmacy Simulator, işletme araçları

## 6. Signature feature

**"Hasta geri geldi"** (vaka sonucunun ertesi gün dönmesi) ve vakada **soru bütçesi**. Detay ve içerik maliyeti netleşecek.

## 7. İlerleme sistemi

- **Mastery:** kavram bazında, asıl ölçü
- **XP / level:** yalnızca görsel geri bildirim
- **Streak:** haftalık hedef, dondurma hakkı
- **Mastery haritası:** Learning DNA'nın V1 hali

## 8. Riskler

1. **İçerik darboğazı:** dallanan vakalar üstel maliyet getirir; çözüm "elmas yapısı". Asıl darboğaz eczacı incelemesidir; yapay zekâ taslağı üretimi ucuzdur, bilimsel doğrulama değildir.
2. **Tıbbi sorumluluk:** AI üretimi içerik yayından önce denetlenir. Takviyelerde ek riskler: kanıt kalitesi iddiadan iddiaya çok değişir; doz ifadelerinde tuz ile elemental dayanak karışabilir; etkileşim ve özel grup güvenliği ikili ("iyi/kötü") anlatılmaz, şiddet ve yapılacakla verilir.
3. **Sponsorluk ve mevzuat:** içerik ile sponsor arasında net ayrım olmalı; ilaç tanıtım kuralları Türkiye'de hassastır. Gıda takviyesi ilaç değildir; içerik tedavi vaadi veya marka tanıtımı gibi okunmamalı. Eğitim marka değil bilimsel kavram merkezlidir.
4. **Özellik şişmesi:** V1'de her özellik ya alışkanlığı ya da öğrenmeyi doğrudan artırmalı.
5. **Güncellik:** her karta kaynak ve son gözden geçirme tarihi konur.
6. **İsim:** "Pharmind" çalışma adıdır. Alman bir yayıncı (pharmind dergisi) aynı adı kullanıyor; marka riski değerlendirilmeden logo ve tescil yatırımı yapılmaz.

## 9. Açık sorular

- ~~İçerik şeması~~ Stage 1'de konudan bağımsız olarak tanımlandı ("İçerik paketleri ve yayın kilidi" bölümü). Excel kartlarına bağlı değildir.
- `[?]` Paket dosyalarının depodaki konumu ve uygulamaya yüklenme biçimi (paket yükleyicisi, ayrı aşama)
- `[?]` Konular arasında ortak kavramların tekrar kullanımı
- `[?]` Yüksek riskli iddialar için ikinci bir eczacı onaycısı gerekir mi
- `[?]` Mobil teknoloji: Expo mu Flutter mı (öneri: Expo)
- `[?]` Arka uç: Supabase mi, başka bir şey mi
- `[?]` Gelir modeli ve sponsorluk zamanlaması

## Mastery tanımı (uygulandı)

- **Kart mastery'si** = `min(1, stability / 30 gün) × şu anki hatırlanma olasılığı` (FSRS). Hedef gün sayısı `MASTERY_TARGET_STABILITY_DAYS` ile ayarlanır.
- **Kavram mastery'si** = kavramı test eden kartların ortalaması; hiç görülmeyen kart 0 sayılır.
- Sonuç: yanlış cevap ~0, tek seferlik doğru cevap düşük, aralıklı tekrarlarla yükselir, tekrar edilmezse zamanla düşer.
- FSRS notu: doğru ve emin → Good; doğru ama kararsız/tahmin → Hard; yanlış → Again; Easy V1'de kullanılmaz.
- `[?]` 30 gün hedefi ilk tahmin; gerçek kullanımla ayarlanacak.

## Haftalık seri ve dondurma hakkı (uygulandı)

- Hedefi (haftada 5 oturum) tutturan hafta seriyi 1 artırır.
- **Otomatik dondurma:** biten bir hafta hedefi tutturamadıysa ve hak varsa hak kendiliğinden harcanır; seri korunur ama artmaz. Hak yoksa seri 0'a düşer. Hiç oturum olmayan haftalar da aynı kurala tabidir.
- **Kazanma:** her 4 başarılı haftada 1 hak, en fazla 2 birikir.
- İçinde bulunulan hafta bitmeden başarısız sayılmaz.
- Seri ayrı saklanmaz, `completedDays`'ten her seferinde hesaplanır (`streakStatus`).
- `[?]` 4 hafta ve 2 hak üst sınırı ilk tahmin; kullanımla ayarlanır.

## Günün vakası, THINK (uygulandı)

- **Akış:** hasta sunumu, en fazla 3 soru (sabit bütçe), 3 doğrusal karar noktası, sonuç. Her kararın ardından seçeneğin gerekçesi ve hastanın durumundaki değişiklik gösterilir.
- **Soru bütçesi:** vakada 5–6 hazır soru vardır; bazıları `critical` (atlanırsa güvenli karar verilemez), kalanı değildir. Sonuçta "kritik bilgiden kaçını sordun", "gereksiz soru", ve sormadığın kritik sorunun cevabı gösterilir.
- **Puanlama:** üç kademe, `uygun` / `kabul` / `uygunDegil`. İkili doğru-yanlış değil; her seçeneğin gerekçesi (şiddet ve ne yapılacağı) vardır.
- **Dallanma:** V1'de doğrusal. Elmas yapısı `[?]` içerik yazım maliyeti görülünce eklenebilir.
- **Mastery bağlantısı:** her karar noktası bir veya birkaç kavrama bağlıdır ve FSRS'te "kart" gibi işlenir (uygun → Good, kabul → Hard, uygunDegil → Again). Günlük 5 seçimine girmez, kavram mastery'sine katılır.
- **Hedef ilişkisi:** vaka, günlük oturum hedefine (haftalık seri) sayılmaz; yalnızca Daily 5 sayılır. `[?]` karar bekliyor.
- **Günün vakası seçimi:** bugün tamamlanan varsa o; yoksa oynanmamış ilk vaka; hepsi oynandıysa en eskisi tekrar.
- **İçerik şeması:** `PatientCase` (`src/core/types.ts`): kaynak, son gözden geçirme tarihi ve durum (`taslak`/`onaylı`/`demo`) zorunludur. Şu an yalnızca tıbbi bilgi içermeyen bir demo vaka var.

## Hasta geri geldi (uygulandı)

- **Ne zaman:** vakayı çözdükten sonraki gün Home'da "Hasta geri geldi" görünür. Kaçırılırsa kaybolmaz, ceza yok; en eski bekleyen önce gelir. Aynı gün dönmez.
- **Ne olur:** hastanın kısa anlatımı ve **tek yeni karar** (aynı üç kademeli puanlama, gerekçe ve sonuç notu).
- **Kişiselleştirme:** anlatımın 3 varyantı vardır: `iyi` / `karisik` / `zayif`. Varyant, vaka kararlarının ortalamasından gelir (uygun 2, kabul 1, uygun değil 0): 1,5 ve üstü iyi, 0,75 ve üstü karışık, altı zayıf. Sorulan sorular varyanta etki etmez `[?]`.
- **Mastery:** geri dönüş kararı da ilgili kavramlara bağlı bir karttır (uygun → Good, kabul → Hard, uygun değil → Again). Hasta dönene kadar işlenmediği için ilgili kavramın skorunda "görülmemiş" sayılır.
- **Hedef ilişkisi:** günlük oturum hedefine (haftalık seri) sayılmaz.
- **Tekrar oynama:** içerik azken, hastası cevaplanmış vaka yeniden oynanırsa eski geri dönüş cevabı silinir ve hasta yeniden döner. Hastası bekleyen vaka tekrar sunulmaz (aşağıdaki kararlara bakın).
- **İçerik maliyeti:** her vaka için 1 ek karar ve 3 kısa anlatım. `followUp` isteğe bağlıdır; yoksa hasta dönmez. Kendi kaynağı, tarihi ve durumu vardır.

## Kod incelemesinden çıkan kararlar (uygulandı)

- **Tekrar zamanı:** FSRS kısa öğrenme adımları kapalıdır (`enable_short_term: false`). Aralıklar gün bazlıdır: yeni kartta yanlış +1 gün, doğru ama kararsız +2 gün, doğru ve emin +3 gün. Hiçbir cevap kartı aynı gün tekrar sorulacak hale getirmez.
- **Daily 5 ve vaka:** Daily 5, kavram zayıflığını vaka kararlarını (ve geri dönüş kararını) da sayarak hesaplar; seçilen kartlar yine yalnızca normal kartlardır. Ana ekrandaki harita aynı listeyi kullanır.
- **Vakayı tekrar oynama:** Hastası geri dönmeyi bekleyen vaka tekrar sunulmaz. Önce hasta geri döner ve cevaplanır; hasta ötelenmez, kararlar iki kez işlenmez. Başka sunulacak vaka yoksa "Günün vakası" bölümü görünmez, yalnızca "Hasta geri geldi" kalır. Hasta cevaplandıktan sonra vaka (içerik azsa) tekrar sunulabilir; tekrar oynanınca yeni bir geri dönüş doğar.
- **Geri dönüşün onayı:** `followUp` kendi `source`, `reviewedAt` ve `status` alanlarını taşır; vakanınkini miras almaz. Onaysız (taslak) veya bozuk geri dönüş oynanmaz ve mastery'ye katılmaz, ama vakanın kendisi oynanmaya devam eder.

## Kapsam kararı (2026-11-02)

- **İlk gerçek içerik konusu magnezyum.** Ardından vitaminler, mineraller ve seçilmiş takviye edici gıdalarla genişleme (D vitamini, kalsiyum, demir, B12, çinko ve benzeri).
- **Dermokozmetik** başlangıç kapsamından çıktı; gelecekte ayrı bir içerik kategorisi olarak eklenebilir. Depoda gerçek dermokozmetik içerik hiç bulunmuyordu (yalnızca demo), bu yüzden uygulamadan bir şey kaldırılmadı.
- **Vizyon değişmedi:** eczacılık öğrencileri, yeni mezunlar ve eczacılar için bilimsel temelli, oyunlaştırılmış, modüler bir mesleki öğrenme platformu. KNOW, THINK, ACT, BUILD yaklaşımı korunur; V1'de KNOW ve THINK öncelikli.
- **Korunanlar:** Daily 5, mastery, haftalık seri, günün vakası, soru bütçesi, "hasta geri geldi" ve mastery tanımı aynen geçerlidir.
- **Bilimsel kavram merkezlilik:** kartlar ve vakalar markaya veya ticari ürüne değil, kavrama (etken madde, form, etkileşim, özel grup, danışmanlık noktası vb.) dayanır.

## İçerik paketleri ve yayın kilidi (Stage 1, tamamlandı)

Stage 1 konudan bağımsız bir içerik paketi biçimi ve doğrulama sistemi getirdi. **Paketler henüz uygulamaya yüklenmez; bu aşamada yalnızca doğrulayıcılar ve testlerde kullanılırlar.** Magnezyum için gerçek paket henüz yoktur; mevcut tek paket, tıbbi içerik taşımayan sentetik bir test paketidir.

- **Paket:** kavramlar, kaynaklar, iddialar (claim), kartlar ve vakalar. İddialar kaynak kayıtlarına bağlanır; onaylı bir iddia kaynaktan birebir alıntı ve konum da taşımalıdır. Biçim kapalıdır, bilinmeyen alan reddedilir. Şema `app/src/core/types.ts` içindedir.
- **Durum ve onay:** içerik `taslak` veya `onaylı` olur. `onaylı` içerik, insan onay kaydı (`review`) ve otomatik kaynak denetimi sonucu taşımalıdır. Onay kaydı, onaylanan içeriğin özetine bağlıdır; içerik sonradan değişirse onay düşer.
- **Yüksek riskli iddialar** (doz, etkileşim, kontrendikasyon) alıntılı bir birincil kaynak ister; etkileşimde şiddet derecesi ve ne yapılacağı zorunludur.
- **Öğrenme kimliği ve yayın kilidi:** kart ve karar kimlikleri cihazdaki ilerlemenin anahtarıdır. Onaylı bir öğenin doğru cevabı, bağlamı veya bilimsel çekirdeği değişirse **yeni kimlik** verilir; eski kimlik emekli olur. `app/src/content/release-lock.json` bu çekirdek özetlerini tutar ve yalnızca büyüyebilir.
- **Paketler arası kimlik:** her paketin zorunlu bir `idPrefix`'i vardır; kart ve vaka kimlikleri bu önekle başlar. Paketler arası kimlik çakışması doğrulayıcıyla yakalanır.
- **CI:** her pull request'te GitHub Actions hem kalite kapısını (tür denetimi, lint, testler) hem de kilidin yalnızca büyüdüğünü denetler.
- **Sınır:** özetler kriptografik değildir ve gerçek insan onayının kanıtı değildir. Güvence sürecin kendisidir (aşağıdaki ilkeler).

## İçerik üretim ve bilimsel onay ilkeleri

Akış: bilimsel kaynak → iddia → eğitim hedefi → KNOW/THINK taslağı → otomatik kontrol → eczacı onayı → yayın. Ayrıntılı süreç Stage 2A'da tasarlanıp uygulanır; burada yalnızca ilkeler sabitlenir.

1. **Yapay zekâ taslak üretebilir, bilimsel onay veremez.** Onay yalnızca eczacı tarafından, insan eliyle verilir. Model çıktısı onay belirtisi taşıyamaz.
2. **GitHub PR onayı tek başına bilimsel içerik onayı değildir.** PR onayı kod ve süreç incelemesidir; bilimsel onay ayrı, izlenebilir bir eczacı kaydıdır.
3. **Alıntının kaynakta bulunması bilimsel doğruluğun otomatik kanıtı değildir.** Otomatik denetim yalnızca alıntının gerçekten var olduğunu ve iddiadaki sayıların ondan geldiğini gösterebilir. Kaynağın iddiayı gerçekten, bu bağlamda ve bu popülasyon için destekleyip desteklemediğine eczacı karar verir.
4. **Kanıt kesinliği ile klinik karar uygunluğu ayrı değerlendirilir.** Bir iddianın kanıtının sınırlı olması, ona dayanan bir seçeneğin otomatik olarak "kabul" ya da "uygun değil" sayılacağı anlamına gelmez. Her seçeneğin derecesi, gerekçesi ve ne yapılacağıyla birlikte eczacı tarafından ayrıca değerlendirilir. Bilimsel belirsizlik içerikte açıkça ifade edilir.
5. **Eczacı onay arayüzü zorunlu değildir.** İlk pilotta izlenebilir, insan tarafından verilmiş bir onay kaydı ve okunabilir bir inceleme raporu yeterlidir. Özel bir onay arayüzü ileride eklenebilir.
6. **Şema ihtiyaç doğdukça genişler.** Yeni alanlar yalnızca gerçek bir ihtiyaçla gerekçelendirildiğinde eklenir.
7. **Belirsiz bilgi uydurulmaz.** Doz, etkileşim veya klinik bilgiden emin olunmayan yer işaretlenir ve eczacıya sorulur.

## Sonraki aşamalar (içerik tarafı)

- **Stage 2A:** içerik üretim sürecinin tasarlanıp uygulanması ve magnezyum pilotu (küçük, kaynaklı, bilimsel doğrulama ile eczacı onayını uçtan uca sınayan).
- **Stage 2B:** onaylı paketlerin uygulamaya yüklenmesi (paket yükleyicisi) ve öğrenme kimliğinin paketler arası ad alanı kararı. Bu, ilerleme yapısıyla ilgili olduğu için ayrı ve açık onay gerektirir.
- Sonraki konular (D vitamini, kalsiyum, demir, B12, çinko) pilotun ardından, ortak kavramların ve paketler arası kimliğin nasıl yönetileceği netleştirilerek eklenir.
