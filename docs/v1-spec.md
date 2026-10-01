# V1 spesifikasyonu (taslak)

> Durum: **taslak**. Çerçeve, planlama konuşmasından çıkarıldı. Kullanıcının kendi notlarıyla çatıştırılıp netleştirilecek. `[?]` işaretli yerler açık sorudur.

## 1. Ürün mimarisi

Dört modül ayrı uygulamalar değil, **aynı bilginin dört kullanım düzeyidir**; hepsi tek bir **kavram grafiği** üzerine kurulur.

- **Kavramlar:** etken madde, endikasyon, mekanizma, etkileşim, kırmızı bayrak, cilt problemi, danışmanlık noktası. Her kavramın bir **mastery** skoru vardır.
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

**Konu alanı:** yalnızca **dermokozmetik** (mevcut kartlar var, ticari değeri yüksek).

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

AI Patient, canlı AI içerik üretimi, leaderboard, time attack, Pharmacy Simulator, haber/bilimsel içerik modülü, Routine/Supplement/Magistral Builder, diğer konu alanları, eczane işletme araçları.

## 5. Sonraki sürümler

- **V2:** yanlış cevap analizi, kişiselleştirilmiş rota, ACT modu (hızlı vaka), Routine Builder, AI ile vaka *taslağı* (yayın öncesi onaylı)
- **V3:** diğer konu alanları, eczane ekibi modu, Supplement ve Magistral Builder, haber modülü (editör kontrollü)
- **V4+:** Pharmacy Simulator, işletme araçları

## 6. Signature feature

**"Hasta geri geldi"** (vaka sonucunun ertesi gün dönmesi) ve vakada **soru bütçesi**. Detay ve içerik maliyeti netleşecek.

## 7. İlerleme sistemi

- **Mastery:** kavram bazında, asıl ölçü
- **XP / level:** yalnızca görsel geri bildirim
- **Streak:** haftalık hedef, dondurma hakkı
- **Mastery haritası:** Learning DNA'nın V1 hali

## 8. Riskler

1. **İçerik darboğazı:** dallanan vakalar üstel maliyet getirir; çözüm "elmas yapısı".
2. **Tıbbi sorumluluk:** AI üretimi içerik yayından önce denetlenir.
3. **Sponsorluk:** içerik ile sponsor arasında net ayrım olmalı; ilaç tanıtım kuralları Türkiye'de hassastır.
4. **Özellik şişmesi:** V1'de her özellik ya alışkanlığı ya da öğrenmeyi doğrudan artırmalı.
5. **Güncellik:** her karta kaynak ve son gözden geçirme tarihi konur.
6. **İsim:** "Pharmind" çalışma adıdır. Alman bir yayıncı (pharmind dergisi) aynı adı kullanıyor; marka riski değerlendirilmeden logo ve tescil yatırımı yapılmaz.

## 9. Açık sorular

- `[?]` İçerik şeması: kavram / kart / vaka ilişkisi (Excel kartlarına bakılarak çıkarılacak)
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
- **Tekrar oynama:** içerik azken aynı vaka yeniden oynanırsa eski geri dönüş cevabı silinir, hasta yeniden döner.
- **İçerik maliyeti:** her vaka için 1 ek karar ve 3 kısa anlatım. `followUp` isteğe bağlıdır; yoksa hasta dönmez.
