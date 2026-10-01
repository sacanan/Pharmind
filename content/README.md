# İçerik

Bu klasör kavram, kart ve vaka içeriklerini ve bunların şemalarını barındıracak.

## Planlanan yapı

```
content/
  schema/        # kavram, kart, vaka şemaları (henüz yazılmadı)
  derma/         # dermokozmetik içerik (V1)
```

## Şema (taslak fikir, kesin değil)

Şema, mevcut dermokozmetik Excel kartlarına bakılarak çıkarılacak. Beklenen üç varlık:

- **Kavram:** etken madde, endikasyon, cilt problemi, kırmızı bayrak vb.; her biri mastery skoru taşır
- **Kart:** bir veya birkaç kavramı test eden soru
- **Vaka:** birkaç kavramı birleştiren, karar noktalı senaryo

## Her içeriğin taşıması gerekenler

- Kaynak
- Son gözden geçirme tarihi
- Durum: `taslak` | `onaylı` (yalnızca onaylı içerik uygulamada gösterilir)
