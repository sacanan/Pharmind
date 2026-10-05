import {
  allCards,
  allCases,
  concepts,
  playable,
  playableCaseView,
  playableCards,
  playableCases,
} from '../../content';
import { demoCase } from '../../content/demo-case';
import { validateCard, validateCase } from '../validate';
import type { Card, PatientCase } from '../types';

const baseCard: Card = {
  id: 'k1',
  conceptIds: ['a'],
  prompt: 'Soru',
  options: ['A', 'B'],
  correctIndex: 1,
  explanation: '',
  source: 'Kaynak',
  reviewedAt: '2026-10-01',
  status: 'onaylı',
};

describe('gerçek içerik paketi', () => {
  it('tüm kartlar yapısal olarak geçerli', () => {
    for (const card of allCards) expect({ id: card.id, problems: validateCard(card) }).toEqual({ id: card.id, problems: [] });
  });

  it('tüm vakalar yapısal olarak geçerli', () => {
    for (const c of allCases) expect({ id: c.id, problems: validateCase(c) }).toEqual({ id: c.id, problems: [] });
  });

  it('kimlikler benzersiz', () => {
    const ids = [...allCards.map((c) => c.id), ...allCases.map((c) => c.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(concepts.map((c) => c.id)).size).toBe(concepts.length);
  });

  it('kartların ve kararların kavramları tanımlı kavramlardır', () => {
    const known = new Set(concepts.map((c) => c.id));
    const used = [
      ...allCards.flatMap((c) => c.conceptIds),
      ...allCases.flatMap((c) => [
        ...c.decisions.flatMap((d) => d.conceptIds),
        ...(c.followUp?.decision.conceptIds ?? []),
      ]),
    ];
    expect(used.filter((id) => !known.has(id))).toEqual([]);
  });

  it('oynanabilir içeriğin hepsi onaylı veya demo; taslak asla', () => {
    for (const c of [...playableCards, ...playableCases]) {
      expect(['onaylı', 'demo']).toContain(c.status);
    }
  });
});

describe('durum süzgeci', () => {
  const items = (['taslak', 'onaylı', 'demo'] as const).map((status) => ({ status }));

  it('taslak hiçbir ayarda oynanmaz', () => {
    expect(playable(items, true).map((i) => i.status)).toEqual(['onaylı', 'demo']);
    expect(playable(items, false).map((i) => i.status)).toEqual(['onaylı']);
  });
});

describe('validateCard', () => {
  it('geçerli kartta sorun yok', () => {
    expect(validateCard(baseCard)).toEqual([]);
  });

  it.each([
    ['boş kaynak', { source: '  ' }],
    ['geçersiz tarih', { reviewedAt: '2026-13-40' }],
    ['tarih biçimi', { reviewedAt: '1 Ekim 2026' }],
    ['aralık dışı doğru cevap', { correctIndex: 2 }],
    ['negatif doğru cevap', { correctIndex: -1 }],
    ['tek seçenek', { options: ['A'], correctIndex: 0 }],
    ['yedi seçenek', { options: ['1', '2', '3', '4', '5', '6', '7'], correctIndex: 0 }],
    ['boş seçenek metni', { options: ['A', ''] }],
    ['kavramsız', { conceptIds: [] }],
    ['boş soru', { prompt: '' }],
    ['bilinmeyen durum', { status: 'yayında' as never }],
  ])('%s yakalanır', (_name, patch) => {
    expect(validateCard({ ...baseCard, ...patch }).length).toBeGreaterThan(0);
  });

  it('bozuk onaylı kart oynanabilir listeye girmez', () => {
    const broken: Card = { ...baseCard, source: '' };
    expect(playable([broken]).filter((c) => validateCard(c).length === 0)).toEqual([]);
  });
});

describe('validateCase', () => {
  const clone = (): PatientCase => JSON.parse(JSON.stringify(demoCase));

  it('demo vaka geçerli', () => {
    expect(validateCase(demoCase)).toEqual([]);
  });

  it('geri dönüşsüz vaka geçerli (followUp isteğe bağlı)', () => {
    const c = clone();
    delete c.followUp;
    expect(validateCase(c)).toEqual([]);
  });

  it('kararsız vaka yakalanır (ekranda çökerdi)', () => {
    const c = clone();
    c.decisions = [];
    expect(validateCase(c).length).toBeGreaterThan(0);
  });

  it('bütçe soru sayısından büyükse yakalanır', () => {
    const c = clone();
    c.questionBudget = c.questions.length + 1;
    expect(validateCase(c)).toContain('soru bütçesi soru sayısından büyük');
  });

  it('"uygun" seçeneği olmayan karar yakalanır', () => {
    const c = clone();
    c.decisions[0].options = c.decisions[0].options.map((o) => ({ ...o, rating: 'kabul' as const }));
    expect(validateCase(c).join(' ')).toContain('"uygun" dereceli');
  });

  it('boş gerekçe ve sonuç notu yakalanır', () => {
    const c = clone();
    c.decisions[1].options[0].rationale = '';
    c.decisions[1].options[0].consequence = ' ';
    expect(validateCase(c).length).toBe(2);
  });

  it('eksik geri dönüş varyantı ve bozuk geri dönüş kararı yakalanır', () => {
    const c = clone();
    c.followUp!.returns.zayif = '';
    c.followUp!.decision.options = [];
    const problems = validateCase(c).join(' | ');
    expect(problems).toContain('"zayif" anlatımı boş');
    expect(problems).toContain('geri dönüş kararı');
  });

  it('tekrar eden soru kimliği ve kaynaksız vaka yakalanır', () => {
    const c = clone();
    c.questions[1].id = c.questions[0].id;
    c.source = '';
    const problems = validateCase(c);
    expect(problems).toContain('soru kimlikleri tekrar ediyor');
    expect(problems).toContain('kaynak boş');
  });
});

describe('geri dönüşün ayrı onayı', () => {
  const clone = (): PatientCase => JSON.parse(JSON.stringify(demoCase));
  const approved = (): PatientCase => {
    const c = clone();
    c.status = 'onaylı';
    c.followUp!.status = 'onaylı';
    return c;
  };

  it('onaylı vaka ve onaylı geri dönüş birlikte oynanır', () => {
    expect(playableCaseView(approved(), false)?.followUp).toBeDefined();
  });

  it('onaylı vakaya eklenen taslak geri dönüş oynanmaz, vaka oynanır', () => {
    const c = approved();
    c.followUp!.status = 'taslak';
    const view = playableCaseView(c, false);
    expect(view).not.toBeNull();
    expect(view?.followUp).toBeUndefined();
  });

  it('demo geri dönüş, demo izni kapalıyken düşer', () => {
    const c = approved();
    c.followUp!.status = 'demo';
    expect(playableCaseView(c, false)?.followUp).toBeUndefined();
    expect(playableCaseView(c, true)?.followUp).toBeDefined();
  });

  it('taslak vaka hiçbir ayarda oynanmaz', () => {
    const c = approved();
    c.status = 'taslak';
    expect(playableCaseView(c, true)).toBeNull();
    expect(playableCaseView(c, false)).toBeNull();
  });

  it('bozuk (kaynaksız) geri dönüş düşer, vaka oynanır', () => {
    const c = approved();
    c.followUp!.source = '';
    const view = playableCaseView(c, false);
    expect(view).not.toBeNull();
    expect(view?.followUp).toBeUndefined();
  });

  it('geri dönüşün kaynağı, tarihi ve durumu doğrulanır', () => {
    const c = clone();
    c.followUp!.source = ' ';
    c.followUp!.reviewedAt = 'dün';
    c.followUp!.status = 'yayında' as never;
    const problems = validateCase(c).join(' | ');
    expect(problems).toContain('geri dönüş: kaynak boş');
    expect(problems).toContain('geri dönüş: gözden geçirme tarihi');
    expect(problems).toContain('geri dönüş: durum geçersiz');
  });

  it('oynanabilir vakaların geri dönüşü yalnızca izinli durumdadır', () => {
    for (const c of playableCases) {
      if (c.followUp) expect(['onaylı', 'demo']).toContain(c.followUp.status);
    }
  });
});
