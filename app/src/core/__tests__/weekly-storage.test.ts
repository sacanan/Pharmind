import { markSessionComplete, completedToday, dayKey, weekStart, weeklyProgress } from '../weekly';
import { deserializeProgress, loadProgress, saveProgress, type KeyValueStore } from '../storage';
import { emptyProgress, reviewCard } from '../scheduling';
import type { Card } from '../types';

const card: Card = {
  id: 'c1',
  conceptIds: ['k1'],
  prompt: 'p',
  options: ['A', 'B'],
  correctIndex: 0,
  explanation: '',
  source: 'test',
  reviewedAt: '2026-10-01',
  status: 'demo',
};

// 1 Ekim 2026 Perşembe (yerel saat)
const THURSDAY = new Date(2026, 9, 1, 10, 0, 0);

describe('hafta hesabı', () => {
  it('hafta Pazartesi başlar', () => {
    expect(dayKey(weekStart(THURSDAY))).toBe('2026-09-28');
    // Pazar günü bir önceki Pazartesiye ait
    expect(dayKey(weekStart(new Date(2026, 9, 4, 12)))).toBe('2026-09-28');
    // Pazartesi kendi haftasının başı
    expect(dayKey(weekStart(new Date(2026, 9, 5, 12)))).toBe('2026-10-05');
  });

  it('aynı gün iki kez eklenmez', () => {
    let p = markSessionComplete(emptyProgress(), THURSDAY);
    p = markSessionComplete(p, new Date(2026, 9, 1, 22, 0, 0));
    expect(p.completedDays).toEqual(['2026-10-01']);
    expect(completedToday(p, THURSDAY)).toBe(true);
  });

  it('yalnızca bu haftanın günlerini sayar', () => {
    let p = emptyProgress();
    for (const day of [new Date(2026, 8, 27), new Date(2026, 8, 28), new Date(2026, 9, 1), new Date(2026, 9, 5)]) {
      p = markSessionComplete(p, day);
    }
    // 27 Eylül (Pazar, önceki hafta) ve 5 Ekim (sonraki hafta) sayılmaz
    expect(weeklyProgress(p, THURSDAY)).toEqual({ done: 2, goal: 5 });
  });
});

describe('depolama', () => {
  function memoryStore(): KeyValueStore & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
      data,
      getItem: async (k) => data[k] ?? null,
      setItem: async (k, v) => {
        data[k] = v;
      },
    };
  }

  it('kaydet ve yükle: tarihler Date olarak geri gelir', async () => {
    const store = memoryStore();
    let p = reviewCard(emptyProgress(), card, true, 'sure', THURSDAY);
    p = markSessionComplete(p, THURSDAY);
    await saveProgress(store, p);

    const loaded = await loadProgress(store);
    expect(loaded.cards.c1.due).toBeInstanceOf(Date);
    expect(loaded.cards.c1.due.getTime()).toBe(p.cards.c1.due.getTime());
    expect(loaded.cards.c1.last_review).toBeInstanceOf(Date);
    expect(loaded.history).toEqual(p.history);
    expect(loaded.completedDays).toEqual(['2026-10-01']);
  });

  it('kayıt yoksa veya bozuksa boş ilerlemeye düşer', () => {
    expect(deserializeProgress(null)).toEqual(emptyProgress());
    expect(deserializeProgress('{bozuk json')).toEqual(emptyProgress());
    expect(deserializeProgress('{"version":2}')).toEqual(emptyProgress());
  });
});
