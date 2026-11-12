import { parseRecord } from '../records';
import { emptyProgress, reviewCard } from '../scheduling';
import { deserializeProgress, loadProgress, saveProgress, serializeProgress, PROGRESS_KEY, type KeyValueStore } from '../storage';
import type { Card } from '../types';

const NOW = new Date('2026-10-05T09:00:00Z');

const card: Card = {
  id: 'c1',
  conceptIds: ['k1'],
  prompt: 'p',
  options: ['A', 'B', 'C', 'D'],
  correctIndex: 0,
  explanation: '',
  source: 'test',
  reviewedAt: '2026-10-01',
  status: 'demo',
};

/** M2-1 ÖNCESİ uygulamanın yazdığı biçimde (V1) elle yazılmış kayıt: `recordVersion`, `selfReport`, `policy` yok. */
const LEGACY_JSON = JSON.stringify({
  version: 1,
  cards: {
    c1: {
      due: '2026-10-04T09:00:00.000Z',
      stability: 3.17,
      difficulty: 4.9,
      elapsed_days: 0,
      scheduled_days: 1,
      reps: 1,
      lapses: 0,
      state: 2,
      last_review: '2026-10-03T09:00:00.000Z',
    },
  },
  history: [
    { cardId: 'c1', correct: true, confidence: 'sure', at: '2026-10-03T09:00:00.000Z' },
    { cardId: 'c2', correct: true, confidence: 'unsure', at: '2026-10-03T09:01:00.000Z' },
    { cardId: 'c3', correct: false, confidence: 'sure', at: '2026-10-03T09:02:00.000Z' },
    { cardId: 'c4', correct: false, confidence: 'guess', at: '2026-10-03T09:03:00.000Z' },
  ],
  completedDays: ['2026-10-03'],
  caseResults: {},
});

const memoryStore = (initial?: string): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PROGRESS_KEY, initial);
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
  };
};

describe('eski (V1) kayıtlarla uyumluluk', () => {
  const legacyHistory = JSON.parse(LEGACY_JSON).history;

  it('eski JSON yüklenir; V1 kayıtları AYNEN korunur (alan eklenmez, değer değişmez)', () => {
    const p = deserializeProgress(LEGACY_JSON);
    expect(p.history).toEqual(legacyHistory);
    for (const r of p.history) {
      expect(r.recordVersion).toBeUndefined();
      expect(r).not.toHaveProperty('selfReport');
      expect(r).not.toHaveProperty('policy');
      expect(r).not.toHaveProperty('optionCount');
    }
    expect(p.completedDays).toEqual(['2026-10-03']);
    expect(p.cards.c1.reps).toBe(1);
  });

  it('yeniden kaydedilince eski kayıtlar bayt düzeyinde aynı anlamı taşır ve ikinci turda sabit kalır', () => {
    const once = JSON.parse(serializeProgress(deserializeProgress(LEGACY_JSON)));
    expect(once.history).toEqual(legacyHistory);
    const twice = JSON.parse(serializeProgress(deserializeProgress(JSON.stringify(once))));
    expect(twice).toEqual(once);
  });

  it('eski ilerleme üzerine yeni cevap eklenince: eski kayıtlar değişmez, yeni kayıt V2 olur', async () => {
    const store = memoryStore(LEGACY_JSON);
    const loaded = await loadProgress(store);
    const next = reviewCard(loaded, card, true, 'none', NOW);
    await saveProgress(store, next);
    const saved = JSON.parse(store.data.get(PROGRESS_KEY) as string);
    expect(saved.history.slice(0, 4)).toEqual(legacyHistory);
    expect(saved.history).toHaveLength(5);
    expect(saved.history[4]).toMatchObject({
      recordVersion: 2,
      cardId: 'c1',
      correct: true,
      selfReport: 'none',
      optionCount: 4,
      policy: { version: 'v0-experimental', grade: 'Good' },
    });
    expect(saved.history[4]).not.toHaveProperty('confidence');
    // Yeniden yüklendiğinde iki tür yan yana okunur.
    const again = deserializeProgress(store.data.get(PROGRESS_KEY) as string);
    expect(again.history.map((r) => r.recordVersion)).toEqual([undefined, undefined, undefined, undefined, 2]);
  });

  it('eski kayıtlara politika sürümü yazılmaz: V1 kayıtlar hiçbir koşulda "policy" taşımaz', async () => {
    const store = memoryStore(LEGACY_JSON);
    let p = await loadProgress(store);
    for (let i = 0; i < 3; i++) p = reviewCard(p, card, i % 2 === 0, 'guess', new Date(NOW.getTime() + i * 86_400_000));
    await saveProgress(store, p);
    const saved = JSON.parse(store.data.get(PROGRESS_KEY) as string);
    for (const r of saved.history.slice(0, 4)) expect(r).not.toHaveProperty('policy');
  });
});

describe('kayıt doğrulaması (parseRecord)', () => {
  const v2 = {
    recordVersion: 2,
    cardId: 'c1',
    correct: true,
    selfReport: 'guess',
    optionCount: 4,
    at: '2026-10-05T09:00:00.000Z',
    policy: { version: 'v0-experimental', grade: 'Hard' },
  };

  it('geçerli V1 ve V2 aynı nesneyle döner', () => {
    const v1 = { cardId: 'c', correct: false, confidence: 'sure', at: '2026-10-03T09:00:00.000Z' };
    expect(parseRecord(v1)).toBe(v1);
    expect(parseRecord(v2)).toBe(v2);
  });

  it.each<[string, unknown]>([
    ['nesne değil', 'metin'],
    ['V1: güven yok (eski şemada zorunluydu)', { cardId: 'c', correct: true, at: '2026-10-03T09:00:00.000Z' }],
    ['V1: bilinmeyen güven değeri', { cardId: 'c', correct: true, confidence: 'maybe', at: '2026-10-03T09:00:00.000Z' }],
    ['tanınmayan kayıt sürümü (3)', { ...v2, recordVersion: 3 }],
    ['V2: selfReport "sure" (eski değer yeni türde geçersiz)', { ...v2, selfReport: 'sure' }],
    ['V2: politika sürümü yok', { ...v2, policy: { grade: 'Good' } }],
    ['V2: Easy derecesi (v0 üretmez)', { ...v2, policy: { version: 'v0-experimental', grade: 'Easy' } }],
    ['V2: optionCount kesirli', { ...v2, optionCount: 2.5 }],
    ['geçersiz tarih', { ...v2, at: 'dün' }],
  ])('%s → null', (_name, input) => {
    expect(parseRecord(input)).toBeNull();
  });

  it('depodaki geçersiz kayıtlar atlanır, geçerliler korunur', () => {
    const raw = JSON.stringify({
      version: 1,
      cards: {},
      history: [
        { cardId: 'a', correct: true, confidence: 'sure', at: '2026-10-03T09:00:00.000Z' },
        { bozuk: true },
        v2,
        { ...v2, recordVersion: 3 },
      ],
      completedDays: [],
      caseResults: {},
    });
    const p = deserializeProgress(raw);
    expect(p.history).toHaveLength(2);
    expect(p.history[1]).toEqual(v2);
  });
});

describe('geçmiş sınırı', () => {
  it('politika sürümü kayıtlı olsa da geçmiş sınırlıdır: eski kayıtlar düşer (tam yeniden oynatma yok)', () => {
    let p = emptyProgress();
    for (let i = 0; i < 520; i++) p = reviewCard(p, card, true, 'none', new Date(NOW.getTime() + i * 1000));
    expect(p.history).toHaveLength(500);
    expect(p.history[0].at).toBe(new Date(NOW.getTime() + 20 * 1000).toISOString());
  });
});
