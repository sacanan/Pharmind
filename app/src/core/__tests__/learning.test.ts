import { selectDaily } from '../daily';
import { conceptMastery, masteryMap } from '../mastery';
import { emptyProgress, gradeFor, retrievability, reviewCard } from '../scheduling';
import { Rating } from 'ts-fsrs';
import type { Card } from '../types';

const NOW = new Date('2026-10-01T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function card(id: string, conceptId: string): Card {
  return {
    id,
    conceptIds: [conceptId],
    prompt: id,
    options: ['A', 'B'],
    correctIndex: 0,
    explanation: '',
    source: 'test',
    reviewedAt: '2026-10-01',
    status: 'demo',
  };
}

describe('gradeFor', () => {
  it('yanlış cevap her zaman Again', () => {
    expect(gradeFor(false, 'sure')).toBe(Rating.Again);
    expect(gradeFor(false, 'unsure')).toBe(Rating.Again);
    expect(gradeFor(false, 'guess')).toBe(Rating.Again);
  });

  it('doğru ve emin Good, doğru ama kararsız veya tahmin Hard', () => {
    expect(gradeFor(true, 'sure')).toBe(Rating.Good);
    expect(gradeFor(true, 'unsure')).toBe(Rating.Hard);
    expect(gradeFor(true, 'guess')).toBe(Rating.Hard);
  });
});

describe('reviewCard', () => {
  const c = card('c1', 'k1');

  it('girdiyi değiştirmeden yeni ilerleme döndürür ve kaydı tutar', () => {
    const before = emptyProgress();
    const after = reviewCard(before, c, true, 'sure', NOW);
    expect(before.cards).toEqual({});
    expect(after.cards.c1.reps).toBe(1);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({ cardId: 'c1', correct: true, confidence: 'sure' });
  });

  it('emin ve doğru cevap, yanlış cevaptan daha geç tekrar planlar', () => {
    const good = reviewCard(emptyProgress(), c, true, 'sure', NOW);
    const bad = reviewCard(emptyProgress(), c, false, 'sure', NOW);
    expect(good.cards.c1.due.getTime()).toBeGreaterThan(bad.cards.c1.due.getTime());
  });

  it('hiç görülmemiş kartın hatırlanma olasılığı 0', () => {
    expect(retrievability(emptyProgress(), 'c1', NOW)).toBe(0);
  });

  it('telefon saati geri alınsa bile hata vermez', () => {
    const first = reviewCard(emptyProgress(), c, true, 'sure', NOW);
    const earlier = new Date(NOW.getTime() - DAY);
    expect(() => reviewCard(first, c, true, 'sure', earlier)).not.toThrow();
    expect(reviewCard(first, c, true, 'sure', earlier).cards.c1.reps).toBe(2);
  });
});

describe('mastery', () => {
  const cards = [card('a1', 'a'), card('a2', 'a'), card('b1', 'b')];

  it('hiç görülmeyen kavram 0', () => {
    expect(conceptMastery('a', cards, emptyProgress(), NOW)).toBe(0);
  });

  it('yanlış cevaplanan kartın mastery katkısı, emin ve doğru cevaptan çok düşüktür', () => {
    const only = [cards[2]]; // yalnızca kavram b'nin tek kartı
    const wrong = reviewCard(emptyProgress(), cards[2], false, 'sure', NOW);
    const hard = reviewCard(emptyProgress(), cards[2], true, 'unsure', NOW);
    const good = reviewCard(emptyProgress(), cards[2], true, 'sure', NOW);
    const m = (p: typeof wrong) => conceptMastery('b', only, p, NOW);
    // Az önce cevaplanmış olsa bile yanlış cevap yüksek mastery vermemeli
    expect(m(wrong)).toBeLessThan(0.02);
    expect(m(wrong)).toBeLessThan(m(hard));
    expect(m(hard)).toBeLessThan(m(good));
    // Bir kez görmek bilmek değildir
    expect(m(good)).toBeLessThan(0.15);
  });

  it('aralıklı doğru tekrarlarla mastery 1e ulaşır', () => {
    let p = emptyProgress();
    let when = NOW;
    for (let i = 0; i < 5; i++) {
      p = reviewCard(p, cards[2], true, 'sure', when);
      // sonraki tekrar, kartın vade zamanında
      when = new Date(Math.max(p.cards.b1.due.getTime(), when.getTime() + 60_000));
    }
    const justAfter = new Date(p.cards.b1.last_review!.getTime() + 1000);
    expect(conceptMastery('b', [cards[2]], p, justAfter)).toBeGreaterThan(0.95);
  });

  it('tekrar edilmeden zaman geçtikçe mastery düşer', () => {
    const p = reviewCard(emptyProgress(), cards[2], true, 'sure', NOW);
    const later = new Date(NOW.getTime() + 30 * DAY);
    expect(conceptMastery('b', cards, p, later)).toBeLessThan(conceptMastery('b', cards, p, NOW));
  });

  it('kartların yalnızca bir kısmı görüldüyse tam mastery olmaz', () => {
    const p = reviewCard(emptyProgress(), cards[0], true, 'sure', NOW);
    const m = conceptMastery('a', cards, p, NOW);
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(0.6);
  });

  it('masteryMap en zayıf kavramı başa koyar', () => {
    const concepts = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    let p = reviewCard(emptyProgress(), cards[2], true, 'sure', NOW);
    p = reviewCard(p, cards[2], true, 'sure', new Date(NOW.getTime() + 1000));
    const map = masteryMap(concepts, cards, p, NOW);
    expect(map[0].concept.id).toBe('a');
    expect(map[1].concept.id).toBe('b');
    expect(map[1].seenCount).toBe(1);
  });
});

describe('selectDaily', () => {
  const cards = [
    card('a1', 'a'),
    card('a2', 'a'),
    card('b1', 'b'),
    card('b2', 'b'),
    card('c1', 'c'),
    card('c2', 'c'),
    card('c3', 'c'),
  ];

  it('boş ilerlemede 5 kart seçer, deterministiktir', () => {
    const first = selectDaily(cards, emptyProgress(), NOW).map((c) => c.id);
    const second = selectDaily(cards, emptyProgress(), NOW).map((c) => c.id);
    expect(first).toHaveLength(5);
    expect(first).toEqual(second);
  });

  it('kart sayısı 5ten azsa hepsini verir', () => {
    expect(selectDaily(cards.slice(0, 2), emptyProgress(), NOW)).toHaveLength(2);
  });

  it('zamanı gelmiş kartlar yeni kartlardan önce gelir', () => {
    const p = reviewCard(emptyProgress(), cards[0], false, 'sure', NOW);
    const later = new Date(NOW.getTime() + 2 * DAY);
    const picked = selectDaily(cards, p, later);
    expect(picked[0].id).toBe('a1');
  });

  it('zamanı gelmemiş kart, yeni kartlardan sonra gelir', () => {
    // a1 az önce cevaplandı; sonraki tekrarı henüz gelmedi
    const p = reviewCard(emptyProgress(), cards[0], true, 'sure', NOW);
    const now = new Date(NOW.getTime() + 1000);
    const picked = selectDaily(cards, p, now, 7).map((c) => c.id);
    expect(picked).toHaveLength(7);
    expect(picked[6]).toBe('a1');
  });

  it('yeni kartlarda en zayıf kavramdan başlar', () => {
    // b kavramının yalnızca b1 kartı görüldü; b2 görülmemiş ama b artık "daha az zayıf"
    const p = reviewCard(emptyProgress(), cards[2], true, 'sure', NOW);
    const picked = selectDaily(cards, p, NOW, 7).map((c) => c.id);
    expect(picked).toEqual(['a1', 'a2', 'c1', 'c2', 'c3', 'b2', 'b1']);
  });
});
