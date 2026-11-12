import { describe as describeCells } from '../../ui/Blister';
import { sessionCells, todaysCells } from '../session';
import { emptyProgress } from '../scheduling';
import type { Progress, ReviewRecord } from '../types';

const NOW = new Date('2026-11-12T10:00:00Z');
const base = { cardId: 'c', at: NOW.toISOString() };

const legacyUnsure = { ...base, correct: true, confidence: 'unsure' } as unknown as ReviewRecord;
const newGuess = {
  ...base,
  recordVersion: 2,
  correct: true,
  selfReport: 'guess',
  optionCount: 4,
  policy: { version: 'v0-experimental', grade: 'Hard' },
} as unknown as ReviewRecord;

function cellsOf(record: ReviewRecord) {
  const progress: Progress = { ...emptyProgress(), history: [record] };
  return todaysCells(progress, NOW, 1);
}

describe('Blister erişilebilirlik açıklaması', () => {
  it('eski "unsure" ve yeni "guess" aynı işaretli gözü verir', () => {
    expect(cellsOf(legacyUnsure)).toEqual(['shaky']);
    expect(cellsOf(newGuess)).toEqual(['shaky']);
  });

  it('açıklama eski kararsızlığı "tahmin işaretli" diye adlandırmaz', () => {
    for (const record of [legacyUnsure, newGuess]) {
      const text = describeCells(cellsOf(record));
      expect(text).toContain('1 doğru ama işaretli');
      expect(text).toContain('eski kararsız bildirimi');
      expect(text).not.toMatch(/tahmin işaretli doğru/);
    }
  });

  it('karışık eski ve yeni kayıtlar birlikte sayılır', () => {
    const progress: Progress = { ...emptyProgress(), history: [legacyUnsure, newGuess] };
    expect(describeCells(todaysCells(progress, NOW, 3))).toContain('2 doğru ama işaretli');
  });

  it('oturum gözleri yeni tahmin cevabını işaretli gösterir', () => {
    expect(sessionCells(1, [{ correct: true, selfReport: 'guess' }])).toEqual(['shaky']);
  });
});
