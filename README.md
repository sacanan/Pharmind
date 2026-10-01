# Pharmind

> **Çalışma adı.** Ürün adı henüz kesinleşmedi; repo adı sonradan değiştirilebilir.

Eczacılık öğrencileri ve eczacılar için mobil öğrenme platformu. Amaç, bilgiyi yalnızca ezberletmek değil; **bilmeyi, düşünmeyi, eczanede karar vermeyi ve bir şey üretmeyi** geliştirmek.

**KNOW. THINK. ACT. BUILD.**

| Katman | Ne yapar |
|---|---|
| KNOW | Bilgi öğrenme ve aralıklı tekrar |
| THINK | Klinik düşünme, vaka çözme |
| ACT | Eczanede hızlı ve doğru karar verme |
| BUILD | Rutin, kombinasyon veya çözüm oluşturma |

Günlük kullanım: **5 dakika, her gün biraz daha iyi.**

## Durum

Uygulama iskeleti çalışıyor; **içerik henüz yok** (kartlar ve vaka tıbbi bilgi içermeyen demo yer tutuculardır). Gerçek içerik eklenene kadar ekranda "Demo içerik" uyarısı görünür.

Çalışanlar: Daily 5 (FSRS + güven seçimi), kavram bazında mastery, haftalık seri ve otomatik dondurma, günün vakası (soru bütçesi, 3 karar), "Hasta geri geldi". Veriler yalnızca cihazda saklanır (hesap ve sunucu yok).

Eksikler: gerçek içerik ve içerik şeması (dermokozmetik Excel bekleniyor), kapalı beta, bildirimler, ACT/BUILD katmanları.

## Yol haritası (V1)

1. Zemin: içerik şeması (kavram, kart, vaka) ve teknoloji seçimi
2. Dikey dilim: yalnızca dermokozmetik, Daily 5 (FSRS + güven seçimi)
3. Vaka motoru: elle yazılmış vakalar, soru bütçesi
4. Mastery haritası ve haftalık streak
5. "Hasta geri geldi" mekaniği
6. Kapalı beta (10–20 eczacı/öğrenci)

Ayrıntılar: [`docs/v1-spec.md`](docs/v1-spec.md)

## Çalıştırma

Node.js gerekir. Uygulama `app/` klasöründedir (Expo SDK 57, React Native, TypeScript).

```bash
cd app
npm install
npx expo start --web      # tarayıcıda: http://localhost:8081
npx expo start            # telefonda: Expo Go ile QR kodu okut (aynı Wi-Fi, Expo Go güncel olmalı)
```

Kalite kontrolleri (değişiklikten sonra üçü de temiz olmalı):

```bash
npm test                  # Jest (mantık ve içerik doğrulama testleri)
npm run typecheck         # TypeScript
npm run lint              # ESLint (eslint-config-expo)
```

Deneme ipuçları:
- Veriler cihazın saatine göre işler. "Hasta geri geldi" vakadan **bir gün sonra** çıkar; denemek için vakayı çözüp cihazın tarihini bir gün ileri al.
- Geliştirme sürümünde ana ekranın altında "İlerlemeyi sıfırla (geliştirici)" düğmesi vardır.
- Gerçek içerik eklendiğinde `app/src/content/index.ts` içinde `ALLOW_DEMO_CONTENT = false` yapılır; yalnızca `onaylı` içerik oynanır.

## Klasörler

- `docs/`: Ürün ve mekanik spesifikasyonları
- `content/`: Kavram, kart ve vaka içerikleri ve şemaları (henüz boş; şema Excel'e göre çıkarılacak)
- `app/src/core/`: Arayüzden bağımsız mantık ve testleri (zamanlama, mastery, seri, vaka, depolama, içerik doğrulama)
- `app/src/content/`: Uygulamaya gömülü içerik (şimdilik demo)
- `app/src/state/`: İlerleme deposu (cihazda saklanır)
- `app/src/ui/`, `app/src/app/`: Bileşenler ve ekranlar (Expo Router)
- `CLAUDE.md`: Claude Code için proje kuralları

## Notlar

Bu repo özel (private) tutulur. İçerik tıbbi bilgi içerir; yayına çıkmadan önce eczacı denetiminden geçmelidir.
