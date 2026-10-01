import type { Confidence, Progress, ReviewRecord } from './types';
import { dayKey } from './weekly';

/**
 * Blister dizisindeki bir gözün durumu.
 * - correct: doğru ve emin
 * - shaky: doğru ama kararsız veya tahmin (bilgi henüz oturmamış)
 * - wrong: yanlış
 */
export type CellState = 'pending' | 'current' | 'correct' | 'wrong' | 'shaky';

type Answer = Pick<ReviewRecord, 'correct' | 'confidence'>;

export function cellFor(answer: Answer): CellState {
  if (!answer.correct) return 'wrong';
  return answer.confidence === 'sure' ? 'correct' : 'shaky';
}

/** Oturum sırasındaki gözler: cevaplananlar dolu, sıradaki işaretli, kalanlar boş. */
export function sessionCells(total: number, results: Answer[]): CellState[] {
  return Array.from({ length: total }, (_, i): CellState => {
    if (i < results.length) return cellFor(results[i]);
    return i === results.length ? 'current' : 'pending';
  });
}

/** Bugün cevaplanan son `size` kartın durumu; kalan gözler boş. Ana ekran için. */
export function todaysCells(progress: Progress, now: Date, size: number): CellState[] {
  const today = dayKey(now);
  const todays = progress.history
    .filter((r) => dayKey(new Date(r.at)) === today)
    .slice(-size)
    .map(cellFor);
  return [...todays, ...Array<CellState>(size - todays.length).fill('pending')];
}

export interface SessionSummary {
  total: number;
  /** Doğru cevap sayısı (kararsız doğrular dahil) */
  right: number;
  wrong: number;
  /** Doğru ama emin olmadığı cevaplar */
  shaky: number;
  /** Emin olduğu halde yanlış yaptığı cevaplar: en değerli hata türü */
  confidentErrors: number;
}

export function summarize(results: Answer[]): SessionSummary {
  const confidence = (c: Confidence) => results.filter((r) => r.confidence === c);
  return {
    total: results.length,
    right: results.filter((r) => r.correct).length,
    wrong: results.filter((r) => !r.correct).length,
    shaky: results.filter((r) => r.correct && r.confidence !== 'sure').length,
    confidentErrors: confidence('sure').filter((r) => !r.correct).length,
  };
}
