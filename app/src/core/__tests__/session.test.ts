import { cellFor, sessionCells, summarize, todaysCells } from '../session';
import { emptyProgress, reviewCard } from '../scheduling';
import { markSessionComplete, weekDays } from '../weekly';
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

const THURSDAY = new Date(2026, 9, 1, 10, 0, 0);

describe('blister hücreleri', () => {
  it('cevap ve güven, hücre durumuna çevrilir', () => {
    expect(cellFor({ correct: true, confidence: 'sure' })).toBe('correct');
    expect(cellFor({ correct: true, confidence: 'unsure' })).toBe('shaky');
    expect(cellFor({ correct: true, confidence: 'guess' })).toBe('shaky');
    expect(cellFor({ correct: false, confidence: 'sure' })).toBe('wrong');
    expect(cellFor({ correct: false, confidence: 'guess' })).toBe('wrong');
  });

  it('oturumda cevaplananlar dolu, sıradaki işaretli, kalanlar boş', () => {
    expect(sessionCells(5, [])).toEqual(['current', 'pending', 'pending', 'pending', 'pending']);
    expect(
      sessionCells(5, [
        { correct: true, confidence: 'sure' },
        { correct: false, confidence: 'unsure' },
      ]),
    ).toEqual(['correct', 'wrong', 'current', 'pending', 'pending']);
  });

  it('tüm kartlar cevaplanınca işaretli göz kalmaz', () => {
    const results = Array(5).fill({ correct: true, confidence: 'sure' });
    expect(sessionCells(5, results)).toEqual(Array(5).fill('correct'));
  });

  it('ana ekran için bugünün cevapları, kalanı boş', () => {
    // dünkü cevap sayılmamalı (zaman sırasıyla işlenir)
    let p = reviewCard(emptyProgress(), card, true, 'guess', new Date(2026, 8, 30, 11, 0, 0));
    p = reviewCard(p, card, true, 'sure', THURSDAY);
    p = reviewCard(p, card, false, 'sure', new Date(2026, 9, 1, 11, 0, 0));
    expect(todaysCells(p, THURSDAY, 5)).toEqual(['correct', 'wrong', 'pending', 'pending', 'pending']);
  });
});

describe('oturum özeti', () => {
  it('doğru, yanlış, kararsız ve güvenle yanlış sayılarını verir', () => {
    const s = summarize([
      { correct: true, confidence: 'sure' },
      { correct: true, confidence: 'unsure' },
      { correct: true, confidence: 'guess' },
      { correct: false, confidence: 'sure' },
      { correct: false, confidence: 'guess' },
    ]);
    expect(s).toEqual({ total: 5, right: 3, wrong: 2, shaky: 2, confidentErrors: 1 });
  });
});

describe('haftanın günleri', () => {
  it('Pazartesiden Pazara 7 gün verir, tamamlananları ve bugünü işaretler', () => {
    const p = markSessionComplete(emptyProgress(), THURSDAY);
    const days = weekDays(p, THURSDAY);
    expect(days.map((d) => d.label)).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
    expect(days[0].key).toBe('2026-09-28');
    expect(days[3]).toMatchObject({ key: '2026-10-01', done: true, isToday: true });
    expect(days.filter((d) => d.done)).toHaveLength(1);
  });
});
