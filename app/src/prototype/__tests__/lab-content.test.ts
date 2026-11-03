import { LAB_ACTIVITIES, LAB_NOTICE, LAB_SOURCE } from '../lab-content';
import type { LabActivity } from '../types';

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** Kullanıcıya görünen bütün metinler. */
function visibleTexts(a: LabActivity): string[] {
  return a.kind === 'match'
    ? [a.prompt, a.explain, ...a.pairs.flatMap((p) => [p.left, p.right])]
    : [a.prompt, a.explain, ...a.options];
}

describe('prototip test içeriği', () => {
  it('beş etkinlik var ve dört oyun türünün hepsini içerir', () => {
    expect(LAB_ACTIVITIES).toHaveLength(5);
    expect(new Set(LAB_ACTIVITIES.map((a) => a.kind))).toEqual(new Set(['tf', 'cloze', 'choice', 'match']));
  });

  it('kimlikler benzersiz ve hepsi "lab-" ile başlar (gerçek kimliklerle karışmaz)', () => {
    const ids = LAB_ACTIVITIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('lab-'))).toBe(true);
    expect(LAB_ACTIVITIES.every((a) => a.conceptId.startsWith('lab-'))).toBe(true);
  });

  it('her etkinliğin metinleri dolu ve kısa geri bildirimi var', () => {
    for (const a of LAB_ACTIVITIES) {
      expect({ id: a.id, ok: visibleTexts(a).every((t) => t.trim().length > 0) }).toEqual({ id: a.id, ok: true });
    }
  });

  it('seçimli etkinlikler: doğru cevap aralıkta, seçenekler benzersiz', () => {
    for (const a of LAB_ACTIVITIES) {
      if (a.kind === 'match') continue;
      expect(Number.isInteger(a.correctIndex) && a.correctIndex >= 0 && a.correctIndex < a.options.length).toBe(true);
      expect(new Set(a.options.map(norm)).size).toBe(a.options.length);
      expect(a.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('doğru/yanlış tam iki seçenek taşır; boşluk doldurma tam bir boşluk içerir', () => {
    for (const a of LAB_ACTIVITIES) {
      if (a.kind === 'tf') expect(a.options).toEqual(['Doğru', 'Yanlış']);
      if (a.kind === 'cloze') expect(a.prompt.split('___')).toHaveLength(2);
      if (a.kind === 'choice') expect(a.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('eşleştirme: 3 çift, sol ve sağ ifadeler benzersiz', () => {
    const m = LAB_ACTIVITIES.find((a) => a.kind === 'match');
    if (!m || m.kind !== 'match') throw new Error('eşleştirme etkinliği yok');
    expect(m.pairs).toHaveLength(3);
    expect(new Set(m.pairs.map((p) => norm(p.left))).size).toBe(3);
    expect(new Set(m.pairs.map((p) => norm(p.right))).size).toBe(3);
  });

  it('ihtiyatlı dil: "daha tam emilir" ifadesi kullanılmaz; test uyarısı mevcut', () => {
    const all = LAB_ACTIVITIES.flatMap(visibleTexts).join(' ').toLowerCase();
    expect(all).not.toContain('daha tam');
    expect(LAB_NOTICE.toLowerCase()).toContain('onaysız');
  });

  it('içerikte onay/doğrulama iddiası yok', () => {
    const all = LAB_ACTIVITIES.flatMap(visibleTexts).join(' ').toLowerCase();
    expect(all).not.toMatch(/onaylı|doğrulandı|eczacı onay/);
  });

  it('kaynak izlenebilir; inceleme yapılmadığı için inceleyen ve tarih boş', () => {
    expect(LAB_SOURCE.url).toMatch(/^https:\/\/ods\.od\.nih\.gov\//);
    expect(LAB_SOURCE.publisher).toContain('NIH');
    expect(LAB_SOURCE.claimIds.length).toBeGreaterThan(0);
    expect(LAB_SOURCE.reviewer).toBeNull();
    expect(LAB_SOURCE.reviewedAt).toBeNull();
    expect(LAB_SOURCE.status).toContain('bekliyor');
  });

  it('eşleştirmedeki karşılaştırma "küçük çalışmalarda" bağlamıyla verilir', () => {
    const m = LAB_ACTIVITIES.find((a) => a.kind === 'match');
    if (!m || m.kind !== 'match') throw new Error('eşleştirme etkinliği yok');
    const comparison = m.pairs.find((p) => p.right.includes('biyoyararlı'));
    expect(comparison?.left.toLowerCase()).toContain('küçük çalışmalarda');
  });
});
