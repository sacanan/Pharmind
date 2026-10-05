import type { PatientCase } from '../core/types';

/**
 * DEMO VAKA: yapıyı denemek için uydurma yer tutucu.
 * Hiçbir tıbbi veya klinik bilgi içermez; gerçek vaka gelince silinecek.
 */
export const demoCase: PatientCase = {
  id: 'demo-vaka-1',
  title: '[DEMO] Yer tutucu vaka',
  presentation:
    '[DEMO] Bir hasta eczaneye geliyor ve "bir sorunum var" diyor. Bu metin yer tutucudur ve bir klinik durum anlatmaz.',
  questionBudget: 3,
  questions: [
    { id: 'q1', ask: '[DEMO] Soru 1', reply: '[DEMO] Cevap 1. Bu soru kritiktir.', critical: true },
    { id: 'q2', ask: '[DEMO] Soru 2', reply: '[DEMO] Cevap 2. Bu soru kritiktir.', critical: true },
    { id: 'q3', ask: '[DEMO] Soru 3', reply: '[DEMO] Cevap 3. Bu soru kritik değildir.', critical: false },
    { id: 'q4', ask: '[DEMO] Soru 4', reply: '[DEMO] Cevap 4. Bu soru kritik değildir.', critical: false },
    { id: 'q5', ask: '[DEMO] Soru 5', reply: '[DEMO] Cevap 5. Bu soru kritik değildir.', critical: false },
  ],
  decisions: [
    {
      id: 'd1',
      prompt: '[DEMO] Birinci karar noktası: ne yaparsın?',
      conceptIds: ['demo-a'],
      options: [
        {
          text: 'Seçenek A',
          rating: 'uygun',
          rationale: '[DEMO] Bu seçenek "uygun" olarak işaretlendi. Gerçek bir gerekçe içermez.',
          consequence: '[DEMO] Hastanın durumu bu seçimle değişir.',
        },
        {
          text: 'Seçenek B',
          rating: 'kabul',
          rationale: '[DEMO] Bu seçenek "kabul edilebilir" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu kısmen değişir.',
        },
        {
          text: 'Seçenek C',
          rating: 'uygunDegil',
          rationale: '[DEMO] Bu seçenek "uygun değil" olarak işaretlendi; ne yapılması gerektiği gösterilir.',
          consequence: '[DEMO] Hastanın durumu bu seçimle kötüleşir.',
        },
      ],
    },
    {
      id: 'd2',
      prompt: '[DEMO] İkinci karar noktası: ne yaparsın?',
      conceptIds: ['demo-b'],
      options: [
        {
          text: 'Seçenek A',
          rating: 'kabul',
          rationale: '[DEMO] Bu seçenek "kabul edilebilir" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu kısmen değişir.',
        },
        {
          text: 'Seçenek B',
          rating: 'uygunDegil',
          rationale: '[DEMO] Bu seçenek "uygun değil" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu bu seçimle kötüleşir.',
        },
        {
          text: 'Seçenek C',
          rating: 'uygun',
          rationale: '[DEMO] Bu seçenek "uygun" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu bu seçimle değişir.',
        },
      ],
    },
    {
      id: 'd3',
      prompt: '[DEMO] Üçüncü karar noktası: ne yaparsın?',
      conceptIds: ['demo-a', 'demo-c'],
      options: [
        {
          text: 'Seçenek A',
          rating: 'uygunDegil',
          rationale: '[DEMO] Bu seçenek "uygun değil" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu bu seçimle kötüleşir.',
        },
        {
          text: 'Seçenek B',
          rating: 'uygun',
          rationale: '[DEMO] Bu seçenek "uygun" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu bu seçimle değişir.',
        },
        {
          text: 'Seçenek C',
          rating: 'kabul',
          rationale: '[DEMO] Bu seçenek "kabul edilebilir" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu kısmen değişir.',
        },
      ],
    },
  ],
  outcome: '[DEMO] Vaka kapandı. Bu metin yer tutucudur.',
  followUp: {
    source: 'Yer tutucu (tıbbi bilgi içermez)',
    reviewedAt: '2026-10-01',
    status: 'demo',
    returns: {
      iyi: '[DEMO] Hasta geri geldi ve durumunun iyi gittiğini söylüyor. Bu metin yer tutucudur.',
      karisik: '[DEMO] Hasta geri geldi; durumu kısmen değişmiş. Bu metin yer tutucudur.',
      zayif: '[DEMO] Hasta geri geldi ve durumunun kötüleştiğini söylüyor. Bu metin yer tutucudur.',
    },
    decision: {
      id: 'f1',
      prompt: '[DEMO] Hasta geri döndü: şimdi ne yaparsın?',
      conceptIds: ['demo-b'],
      options: [
        {
          text: 'Seçenek A',
          rating: 'kabul',
          rationale: '[DEMO] Bu seçenek "kabul edilebilir" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu kısmen değişir.',
        },
        {
          text: 'Seçenek B',
          rating: 'uygun',
          rationale: '[DEMO] Bu seçenek "uygun" olarak işaretlendi.',
          consequence: '[DEMO] Hastanın durumu bu seçimle değişir.',
        },
        {
          text: 'Seçenek C',
          rating: 'uygunDegil',
          rationale: '[DEMO] Bu seçenek "uygun değil" olarak işaretlendi; ne yapılması gerektiği gösterilir.',
          consequence: '[DEMO] Hastanın durumu bu seçimle kötüleşir.',
        },
      ],
    },
  },
  source: 'Yer tutucu (tıbbi bilgi içermez)',
  reviewedAt: '2026-10-01',
  status: 'demo',
};
