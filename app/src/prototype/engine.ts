import { seededOrder } from './shuffle';
import type { LabActivity, LabCell, LabChoice, LabMatch, Outcome } from './types';

// ---------------------------------------------------------------------------
// Tek seçimli etkinlikler (doğru/yanlış, boşluk doldurma, çoktan seçmeli)
// ---------------------------------------------------------------------------

/** Geçersiz seçimde null. `flaggedGuess` yalnızca kullanıcı açıkça işaretlediyse true olur. */
export function answerChoice(
  activity: LabChoice,
  selectedIndex: number,
  flaggedGuess: boolean,
): Outcome | null {
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= activity.options.length) {
    return null;
  }
  return { correct: selectedIndex === activity.correctIndex, mistakes: 0, flaggedGuess };
}

// ---------------------------------------------------------------------------
// Dokunarak eşleştirme
// ---------------------------------------------------------------------------

export type MatchSide = 'left' | 'right';

export interface MatchState {
  /** `order[yuva]` = sağ sütunun o yuvasında görünen çiftin indeksi (sol sütun çift sırasındadır). */
  order: number[];
  /** Çift indeksine göre: eşleşti mi. */
  matched: boolean[];
  /** Seçili öğe (iki dokunuşun ilki). */
  picked: { side: MatchSide; index: number } | null;
  /** Yanlış eşleştirme denemesi sayısı. */
  mistakes: number;
  /** Son yanlış deneme (kısa görsel uyarı için); sonraki dokunuşta silinir. */
  lastWrong: { left: number; slot: number } | null;
}

export function startMatch(activity: LabMatch, seed: number): MatchState {
  return {
    order: seededOrder(activity.pairs.length, seed),
    matched: activity.pairs.map(() => false),
    picked: null,
    mistakes: 0,
    lastWrong: null,
  };
}

/**
 * Bir öğeye dokunur. Sol/sağ sırası serbesttir. Aynı sütunda ikinci dokunuş seçimi değiştirir
 * (aynı öğeye tekrar dokunmak seçimi kaldırır). Eşleşmiş veya geçersiz öğeye dokunmak hiçbir
 * şeyi değiştirmez. Girdiyi değiştirmez.
 */
export function pickItem(state: MatchState, side: MatchSide, index: number): MatchState {
  const n = state.matched.length;
  if (!Number.isInteger(index) || index < 0 || index >= n) return state;
  const pair = side === 'left' ? index : state.order[index];
  if (state.matched[pair]) return state;

  const { picked } = state;
  if (!picked || picked.side === side) {
    if (picked && picked.index === index) return { ...state, picked: null, lastWrong: null };
    return { ...state, picked: { side, index }, lastWrong: null };
  }

  const left = side === 'left' ? index : picked.index;
  const slot = side === 'right' ? index : picked.index;
  if (state.order[slot] === left) {
    const matched = state.matched.map((m, i) => m || i === left);
    return { ...state, matched, picked: null, lastWrong: null };
  }
  return { ...state, picked: null, mistakes: state.mistakes + 1, lastWrong: { left, slot } };
}

export function isMatchDone(state: MatchState): boolean {
  return state.matched.length > 0 && state.matched.every(Boolean);
}

/** Tamamlanmamış eşleştirme için null. Hatasız tamamlama "doğru" sayılır. */
export function matchOutcome(state: MatchState): Outcome | null {
  if (!isMatchDone(state)) return null;
  return { correct: state.mistakes === 0, mistakes: state.mistakes, flaggedGuess: false };
}

// ---------------------------------------------------------------------------
// Tur (beş etkinliğin sırayla oynanması)
// ---------------------------------------------------------------------------

export interface LabEntry {
  activityId: string;
  outcome: Outcome;
}

/** Sonuçlar etkinlik sırasıyla eklenir; sıradaki etkinlik `entries.length` ile bulunur. */
export interface LabRun {
  entries: LabEntry[];
}

export function startRun(): LabRun {
  return { entries: [] };
}

export function currentActivity(activities: LabActivity[], run: LabRun): LabActivity | null {
  return activities[run.entries.length] ?? null;
}

export function isRunDone(activities: LabActivity[], run: LabRun): boolean {
  return run.entries.length >= activities.length;
}

/**
 * Sıradaki etkinliğin sonucunu ekler. Başka bir etkinliğin kimliği veya tur bittikten sonraki çağrı
 * (örn. çift dokunuş) sessizce yok sayılır; böylece bir etkinlik iki kez sayılmaz.
 */
export function recordOutcome(
  activities: LabActivity[],
  run: LabRun,
  activityId: string,
  outcome: Outcome,
): LabRun {
  const expected = currentActivity(activities, run);
  if (!expected || expected.id !== activityId) return run;
  return { entries: [...run.entries, { activityId, outcome }] };
}

export function cellOf(outcome: Outcome): LabCell {
  if (!outcome.correct) return outcome.mistakes > 0 ? 'shaky' : 'wrong';
  return outcome.flaggedGuess ? 'shaky' : 'correct';
}

/** Blister gözleri: cevaplananlar sonucuyla dolu, sıradaki işaretli, kalanlar boş. */
export function runCells(activities: LabActivity[], run: LabRun): LabCell[] {
  return activities.map((_, i): LabCell => {
    const entry = run.entries[i];
    if (entry) return cellOf(entry.outcome);
    return i === run.entries.length ? 'current' : 'pending';
  });
}

/** Cevaptan sonra gösterilen kısa başlık. */
export function feedbackTitle(activity: LabActivity, outcome: Outcome): string {
  if (activity.kind === 'match') {
    if (outcome.mistakes === 0) return 'Hepsi eşleşti';
    return outcome.mistakes === 1 ? 'Eşleşti, 1 hata' : `Eşleşti, ${outcome.mistakes} hata`;
  }
  return outcome.correct ? 'Doğru' : 'Yanlış';
}

export interface RunSummary {
  total: number;
  answered: number;
  /** Seçimde doğru cevap, eşleştirmede hatasız tamamlama */
  correct: number;
  /** Kullanıcının açıkça "tahmin ettim" dediği etkinlikler. Diğerleri "emin" demek değildir. */
  flaggedGuesses: number;
  matchMistakes: number;
}

export function summarizeRun(activities: LabActivity[], run: LabRun): RunSummary {
  const outcomes = run.entries.map((e) => e.outcome);
  return {
    total: activities.length,
    answered: outcomes.length,
    correct: outcomes.filter((o) => o.correct).length,
    flaggedGuesses: outcomes.filter((o) => o.flaggedGuess).length,
    matchMistakes: outcomes.reduce((sum, o) => sum + o.mistakes, 0),
  };
}
