import { DERINLES_SIZE, selectDerinles } from '../derinles';
import { masteryMap } from '../mastery';
import { parseRecord, recordKind } from '../records';
import { emptyProgress, reviewCard } from '../scheduling';
import { temelCompletedToday, todaysCells } from '../session';
import { loadProgress, saveProgress } from '../storage';
import { cardsOfLevel } from '../level';
import type { Card, Progress, ReviewRecord } from '../types';

const NOW = new Date(2026, 10, 12, 10, 0);
const card = (id: string, concept: string, level?: Card['level']): Card => ({
  id,
  level,
  conceptIds: [concept],
  prompt: id,
  options: ['A', 'B', 'C'],
  correctIndex: 0,
  explanation: '',
  source: 'test',
  reviewedAt: '2026-11-01',
  status: 'demo',
});
const many = (concept: string, n: number, level: Card['level'] = 'derinles') =>
  Array.from({ length: n }, (_, i) => card(`${concept}-${i}`, concept, level));

describe('selectDerinles: kavram ve seviye ile sınırlı, en fazla 5 farklı kart', () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 4],
    [5, 5],
    [9, 5],
  ])('%i uygun kartla %i kart seçilir', (n, expected) => {
    const picked = selectDerinles(many('k1', n), 'k1', emptyProgress(), NOW);
    expect(picked).toHaveLength(expected);
    expect(new Set(picked.map((c) => c.id)).size).toBe(picked.length); // farklı kartlar
    expect(picked.length).toBeLessThanOrEqual(DERINLES_SIZE);
  });

  it('başka kavramın ve Temel seviyesindeki kartlar sete girmez', () => {
    const pool = [...many('k1', 3), ...many('k2', 4), ...many('k1', 4, 'temel').map((c) => ({ ...c, id: `t-${c.id}` })), card('plain', 'k1')];
    const picked = selectDerinles(pool, 'k1', emptyProgress(), NOW);
    expect(picked.map((c) => c.id).sort()).toEqual(['k1-0', 'k1-1', 'k1-2']);
  });

  it('sıralama Daily 5 ile aynı mantığı kullanır: zamanı gelmiş kart görülmemişten önce gelir', () => {
    const cards = many('k1', 3);
    const past = new Date(2026, 9, 1);
    const p = reviewCard(emptyProgress(), cards[2], false, 'none', past, 'derinles');
    expect(selectDerinles(cards, 'k1', p, NOW)[0].id).toBe('k1-2');
  });
});

describe('kayıt türü: yazma ve okuma kuralı', () => {
  const p = reviewCard(emptyProgress(), card('d', 'k1', 'derinles'), true, 'none', NOW, 'derinles');

  it('yeni kayıtlara tür açıkça yazılır; varsayılan çağrı Temel yazar', () => {
    expect(p.history[0]).toMatchObject({ recordVersion: 2, sessionKind: 'derinles' });
    expect(reviewCard(emptyProgress(), card('t', 'k1'), true, 'none', NOW).history[0]).toMatchObject({ sessionKind: 'temel' });
  });

  it('eski kayıtlar (V1 ve türsüz V2) Temel okunur; alan eklenmez, nesne değişmez', () => {
    const v1 = { cardId: 'a', correct: true, confidence: 'sure', at: NOW.toISOString() };
    const v2old = { recordVersion: 2, cardId: 'b', correct: true, selfReport: 'none', optionCount: 3, at: NOW.toISOString(), policy: { version: 'v0-experimental', grade: 'Good' } };
    const before = JSON.stringify([v1, v2old]);
    const parsed = [parseRecord(v1), parseRecord(v2old)] as ReviewRecord[];
    expect(parsed.map(recordKind)).toEqual(['temel', 'temel']);
    expect(JSON.stringify([v1, v2old])).toBe(before);
    expect(parsed[0]).toBe(v1);
    expect(parsed[1]).not.toHaveProperty('sessionKind');
  });

  it('geçersiz tür değeri olan kayıt atlanır', () => {
    expect(parseRecord({ ...p.history[0], sessionKind: 'uzman' })).toBeNull();
  });

  it('eski JSON ile yükleme ve yeniden kaydetme: kayıtlar aynen korunur', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
    };
    const legacy: Progress = {
      ...emptyProgress(),
      history: [{ cardId: 'a', correct: true, confidence: 'unsure', at: NOW.toISOString() } as ReviewRecord],
    };
    await saveProgress(storage as never, legacy);
    const loaded = await loadProgress(storage as never);
    await saveProgress(storage as never, loaded);
    const again = await loadProgress(storage as never);
    expect(again.history).toEqual(legacy.history);
    expect(again.history[0]).not.toHaveProperty('sessionKind');
  });
});

describe('Temel blister ve tamamlanma türe göre ayrılır', () => {
  const rec = (kind: 'temel' | 'derinles' | undefined, correct: boolean, at: Date): ReviewRecord =>
    ({ recordVersion: 2, cardId: `${kind}-${at.getTime()}`, correct, selfReport: 'none', optionCount: 3, at: at.toISOString(), policy: { version: 'v', grade: 'Good' }, ...(kind ? { sessionKind: kind } : {}) }) as ReviewRecord;
  const day = (m: number) => new Date(2026, 10, 12, 9, m);

  it('Derinleş kayıtları Temel blister\'a girmez; türsüz eski kayıtlar Temel sayılır', () => {
    const p: Progress = { ...emptyProgress(), history: [rec(undefined, true, day(1)), rec('derinles', false, day(2)), rec('temel', false, day(3))] };
    expect(todaysCells(p, NOW, 3)).toEqual(['correct', 'wrong', 'pending']);
    expect(todaysCells(p, NOW, 3, 'derinles')).toEqual(['wrong', 'pending', 'pending']);
  });

  it('temelCompletedToday: hedef Derinleş ile tamamlandıysa Temel tamam sayılmaz', () => {
    const p: Progress = { ...emptyProgress(), completedDays: ['2026-11-12'], history: [rec('derinles', true, day(1)), rec('temel', true, day(2))] };
    expect(temelCompletedToday(null, p, NOW, 5)).toBe(false);
  });

  it('temelCompletedToday: boyuta ulaşan Temel kayıtları veya Derinleş\'siz tamamlanmış gün (eski veri) tamam sayılır', () => {
    const five: Progress = { ...emptyProgress(), history: [1, 2, 3, 4, 5].map((m) => rec('temel', true, day(m))) };
    expect(temelCompletedToday(null, five, NOW, 5)).toBe(true);
    const legacy: Progress = { ...emptyProgress(), completedDays: ['2026-11-12'], history: [rec(undefined, true, day(1))] };
    expect(temelCompletedToday(null, legacy, NOW, 5)).toBe(true);
    expect(temelCompletedToday(null, emptyProgress(), NOW, 5)).toBe(false);
  });
});

describe('mastery izolasyonu: her iki yönde', () => {
  const concepts = [{ id: 'k1', name: 'K1' }];
  const temel = [card('t1', 'k1'), card('t2', 'k1')];
  const derin = [card('d1', 'k1', 'derinles'), card('d2', 'k1', 'derinles')];
  const all = [...temel, ...derin];
  const m = (p: Progress, level: 'temel' | 'derinles') => masteryMap(concepts, cardsOfLevel(all, level), p, NOW)[0].mastery;

  it('Derinleş cevabı Temel mastery\'yi değiştirmez; Derinleş mastery artar', () => {
    const before = emptyProgress();
    let p = before;
    for (let i = 0; i < 3; i++) p = reviewCard(p, derin[0], true, 'none', new Date(NOW.getTime() + i * 86_400_000), 'derinles');
    expect(m(p, 'temel')).toBe(m(before, 'temel'));
    expect(m(p, 'derinles')).toBeGreaterThan(m(before, 'derinles'));
  });

  it('Temel cevabı Derinleş mastery\'yi değiştirmez; Temel mastery artar', () => {
    const before = emptyProgress();
    let p = before;
    for (let i = 0; i < 3; i++) p = reviewCard(p, temel[0], true, 'none', new Date(NOW.getTime() + i * 86_400_000), 'temel');
    expect(m(p, 'derinles')).toBe(m(before, 'derinles'));
    expect(m(p, 'temel')).toBeGreaterThan(m(before, 'temel'));
  });
});
