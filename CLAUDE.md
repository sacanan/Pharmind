# Pharmind — Claude Code proje kuralları

Eczacılık öğrenme uygulaması (çalışma adı: Pharmind). Kullanıcı bir eczacıdır (eczane sahibi); Python biliyor, mobil/web geliştirmede yeni. Dil: Türkçe konuş, kod ve dosya adları İngilizce olabilir.

## Çalışma şekli

- Önce kısa bir plan söyle, sonra yap. Büyük kararları (teknoloji, veri şeması, mekanik değişikliği) yapmadan önce sor.
- Planlama kararları `docs/v1-spec.md` içindedir. Spesifikasyonla çelişen bir şey yapman gerekiyorsa önce söyle.
- V1 kapsamı dışındaki özellikleri ekleme (AI Patient, leaderboard, time attack, simülatör, haber modülü, diğer konu alanları).

## Ürün ilkeleri

- Asıl ilerleme ölçüsü **mastery** (kavram bazında). XP ve level yalnızca görsel geri bildirimdir.
- Oturumlar **sonludur**: sonsuz kaydırma yok, "bugün bitti" hissi var.
- Streak günlük değil **haftalık hedefe** dayanır, dondurma hakkı vardır.
- Profesyonel oyunlaştırma: yetişkin ve ciddi bir ton, çocuk oyunu görünümü yok.

## Tasarım ilkeleri

Yön: **klinik, hümanist, modern, fonksiyonel.** Bauhaus'tan grid, geometri, negatif alan, güçlü tipografi ve kontrollü renk alınır; poster estetiği alınmaz.

Yapma:
- Gradient, glassmorphism, mor/mavi "AI" estetiği, büyük yüzen blob'lar
- Her şeyi kart içine koymak, kart içinde kart
- Aşırı yuvarlak köşeler
- Jenerik veya yapay zekâ ürettiği izlenimi veren illüstrasyon

Yap:
- İki-üç renk kullan, her birine işlevsel anlam ver (doğru / yanlış / dikkat); süs olarak kullanma
- Tipografi ana öğe olsun
- Görsel dil için eczane nesnelerinden ilham al (ilaç kutusu tipografisi, reçete düzeni, blister geometrisi)
- Hareket az ve anlamlı olsun
- Tasarım, bir insan tarafından yönlendirilmiş (art-directed) hissi versin

Yeni bir arayüz yazarken `frontend-design` skill'ini kullan.

## İçerik kuralları (tıbbi güvenlik)

- Her kartın ve vakanın bir **kaynağı** ve **son gözden geçirme tarihi** olmalı.
- Yapay zekâ ile üretilen içerik yalnızca **taslaktır**; yayına girmeden önce eczacı (kullanıcı) onaylar. Uygulama içinde canlı AI içerik üretimi yok.
- Etkileşim, kontrendikasyon gibi konuları "A+B kesinlikle kötü" gibi ikili anlatma; şiddet derecesi ve ne yapılacağı ile birlikte ver.
- İlaç dozu, etkileşim veya klinik bilgi konusunda emin değilsen uydurma, işaretle ve kullanıcıya sor.

## Teknik tercihler (değişebilir, karar öncesi sor)

- Mobil: Expo (React Native, TypeScript) önerilen yön
- Aralıklı tekrar: `ts-fsrs`
- Arka uç: Supabase (karar verilmedi)

## Git

- Küçük, açıklayıcı commit'ler. Commit mesajları Türkçe veya İngilizce olabilir, tutarlı ol.
- Gizli bilgi (anahtar, şifre) commit'leme. Repo özeldir ama yine de koyma.
