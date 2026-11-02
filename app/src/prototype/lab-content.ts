import type { LabActivity } from './types';

/**
 * TEST İÇERİĞİ (onaysız). Eczacı incelemesinden geçmemiştir; gerçek eğitim havuzuna girmez,
 * hiçbir kayda yazılmaz. İfadeler, NIH Office of Dietary Supplements "Magnesium – Health
 * Professional Fact Sheet" (bölüm: Sources of Magnesium > Dietary supplements) metninin
 * özetine dayanan taslak iddialarla (mgform-c-001, mgform-c-002) sınırlıdır ve bilerek ihtiyatlıdır:
 * genel eğilimi anlatır, belirli bir ürün veya klinik sonuç hakkında hüküm vermez.
 * Kaynak metni doğrudan doğrulanmamıştır (bkz. docs/product-decisions.md).
 */
export const LAB_NOTICE = 'TEST içeriği: onaysız, tıbbi bilgi olarak kullanılmaz.';

export const LAB_ACTIVITIES: LabActivity[] = [
  {
    id: 'lab-mg-1',
    kind: 'tf',
    conceptId: 'lab-mg-formlar',
    prompt: 'Tüm magnezyum tuzları aynı oranda emilir.',
    options: ['Doğru', 'Yanlış'],
    correctIndex: 1,
    explain: 'Kaynağa göre magnezyum takviyelerinin emilimi forma göre değişir.',
  },
  {
    id: 'lab-mg-2',
    kind: 'cloze',
    conceptId: 'lab-mg-formlar',
    prompt: 'Sıvıda iyi çözünen magnezyum formlarının emilimi genel olarak ___ olma eğilimindedir.',
    options: ['daha yüksek', 'daha düşük', 'birbirinin aynısı'],
    correctIndex: 0,
    explain:
      'Genel bir eğilim: iyi çözünen formlar çoğunlukla daha iyi emilir. Bu, belirli bir ürünün emilimini tek başına söylemez.',
  },
  {
    id: 'lab-mg-3',
    kind: 'choice',
    conceptId: 'lab-mg-formlar',
    prompt:
      'Kaynak, sitratın oksit ve sülfattan daha biyoyararlı bulunduğunu aktarıyor. Bu bulgular neye dayanıyor?',
    options: ['Küçük çalışmalara', 'Büyük randomize klinik çalışmalara', 'Ürün etiketlerine'],
    correctIndex: 0,
    explain:
      'Kaynak bu karşılaştırmayı küçük çalışmalara dayandırır. Doz, kişi sayısı ve ölçüt bu özette verilmez.',
  },
  {
    id: 'lab-mg-4',
    kind: 'match',
    conceptId: 'lab-mg-formlar',
    prompt: 'Cümleleri tamamlayın.',
    pairs: [
      { left: 'Sıvıda iyi çözünen formların emilimi', right: 'genel olarak daha yüksektir' },
      { left: 'Sitrat, oksit ve sülfata göre', right: 'daha biyoyararlı bulunmuştur' },
      { left: 'Bu karşılaştırma', right: 'küçük çalışmalara dayanır' },
    ],
    explain:
      'Üçü de kaynağın özetinden. Hepsi genel eğilimdir; belirli bir ürünün emilim oranını vermez.',
  },
  {
    id: 'lab-mg-5',
    kind: 'tf',
    conceptId: 'lab-mg-formlar',
    prompt: 'Bir formun daha iyi emilmesi, hastada daha etkili olduğunu tek başına kanıtlar.',
    options: ['Doğru', 'Yanlış'],
    correctIndex: 1,
    explain:
      'Kaynak emilim ve biyoyararlanımı aktarır; formlar arasında klinik etkinlik farkı bu özette bildirilmiyor. Emilim ile klinik sonuç ayrı sorulardır.',
  },
];
