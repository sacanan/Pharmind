# İçerik

Bu klasör içerik üretimine ilişkin notları barındırır. **Henüz gerçek içerik yoktur.** Uygulamadaki kartlar ve vaka tıbbi bilgi içermeyen demo yer tutuculardır.

## Konu alanı

V1'in konu alanı **vitaminler, mineraller ve seçilmiş takviye edici gıdalar**dır; ilk gerçek konu **magnezyum**. Eğitim bilimsel kavram merkezlidir, marka veya ticari ürün merkezli değildir. Dermokozmetik başlangıç kapsamında değildir; ileride ayrı bir kategori olarak eklenebilir. Konu başlıkları için bkz. [`docs/content-topics.md`](../docs/content-topics.md).

## Şema

Şema Stage 1'de konudan bağımsız olarak tanımlandı ve kod tarafında durur: `app/src/core/types.ts` (`ContentPack`). Varlıklar:

- **Kavram:** mastery skoru taşıyan öğrenme birimi
- **Kaynak ve iddia:** iddialar kaynak kayıtlarına bağlanır; onaylı iddia birebir alıntı ve konum da taşır
- **Kart:** bir veya birkaç kavramı test eden soru
- **Vaka:** birkaç kavramı birleştiren, karar noktalı senaryo

Paketlerin bu klasörde mi başka yerde mi duracağı ve uygulamaya nasıl yükleneceği henüz kararlaştırılmadı (paket yükleyicisi ayrı bir aşamadır). Paketler şu an uygulamaya yüklenmez.

## Her içeriğin taşıması gerekenler

- Kaynak (iddia düzeyinde: kaynak kaydı, alıntı, konum)
- Son gözden geçirme tarihi
- Durum: `taslak` | `onaylı` (yalnızca onaylı içerik uygulamada gösterilir)
- Onaylı içerik için insan (eczacı) onay kaydı

## İlkeler

- Yapay zekâ taslak üretebilir, bilimsel onay veremez; onay eczacıdan gelir.
- GitHub PR onayı tek başına bilimsel içerik onayı değildir.
- Alıntının kaynakta bulunması bilimsel doğruluğun kanıtı değildir.
- Ayrıntı: [`docs/v1-spec.md`](../docs/v1-spec.md)
