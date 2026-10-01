import { BACKUP_KEY, PROGRESS_KEY, deserializeProgress, loadProgress, serializeProgress } from '../storage';
import { emptyProgress, reviewCard } from '../scheduling';
import type { Card } from '../types';

const NOW = new Date('2026-10-01T09:00:00Z');
const card: Card = {
  id: 'c1',
  conceptIds: ['a'],
  prompt: 'p',
  options: ['A', 'B'],
  correctIndex: 0,
  explanation: '',
  source: 's',
  reviewedAt: '2026-10-01',
  status: 'demo',
};

function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: async (k: string) => data[k] ?? null,
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('bozuk kayıt dayanıklılığı', () => {
  it('tek bozuk kart girdisi tüm ilerlemeyi götürmez, diğer kartlar korunur', () => {
    const good = reviewCard(emptyProgress(), card, true, 'sure', NOW);
    const raw = JSON.parse(serializeProgress(good));
    raw.cards.bozuk = null;
    raw.cards.tarihsiz = { stability: 1 };
    raw.completedDays = ['2026-09-30'];
    const back = deserializeProgress(JSON.stringify(raw));
    expect(Object.keys(back.cards)).toEqual(['c1']);
    expect(back.completedDays).toEqual(['2026-09-30']);
  });

  it('okunamayan kayıt boş ilerlemeyle açılır ama ham kopyası yedeklenir', async () => {
    const store = memoryStore({ [PROGRESS_KEY]: '{bozuk json' });
    const p = await loadProgress(store);
    expect(p).toEqual(emptyProgress());
    expect(store.data[BACKUP_KEY]).toBe('{bozuk json');
  });

  it('sürümü uyumsuz kayıt da yedeklenir', async () => {
    const raw = JSON.stringify({ version: 2, cards: {} });
    const store = memoryStore({ [PROGRESS_KEY]: raw });
    await loadProgress(store);
    expect(store.data[BACKUP_KEY]).toBe(raw);
  });

  it('kayıt hiç yoksa yedek oluşmaz', async () => {
    const store = memoryStore();
    expect(await loadProgress(store)).toEqual(emptyProgress());
    expect(store.data[BACKUP_KEY]).toBeUndefined();
  });

  it('sağlam kayıt yedeklenmez', async () => {
    const good = reviewCard(emptyProgress(), card, true, 'sure', NOW);
    const store = memoryStore({ [PROGRESS_KEY]: serializeProgress(good) });
    const p = await loadProgress(store);
    expect(p.cards.c1.reps).toBe(1);
    expect(store.data[BACKUP_KEY]).toBeUndefined();
  });
});
