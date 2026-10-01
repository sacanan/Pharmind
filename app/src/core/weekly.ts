import type { Progress } from './types';

export const WEEKLY_GOAL = 5;

/** Yerel saate göre YYYY-MM-DD */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Haftanın başlangıcı: Pazartesi 00:00 (yerel saat). */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

/** Bugünkü oturumu tamamlanmış sayar (aynı gün iki kez eklenmez). */
export function markSessionComplete(progress: Progress, now: Date): Progress {
  const key = dayKey(now);
  if (progress.completedDays.includes(key)) return progress;
  return { ...progress, completedDays: [...progress.completedDays, key].sort() };
}

export function completedToday(progress: Progress, now: Date): boolean {
  return progress.completedDays.includes(dayKey(now));
}

function dayLabelFor(index: number): string {
  return ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][index];
}

export interface WeekDay {
  key: string;
  label: string;
  done: boolean;
  isToday: boolean;
}

/** Pazartesiden Pazara bu haftanın 7 günü ve hangilerinde oturum tamamlandığı. */
export function weekDays(progress: Progress, now: Date): WeekDay[] {
  const start = weekStart(now);
  const today = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => {
    const key = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    return {
      key,
      label: dayLabelFor(i),
      done: progress.completedDays.includes(key),
      isToday: key === today,
    };
  });
}

/** Her bu kadar başarılı haftada 1 dondurma hakkı kazanılır. */
export const FREEZE_EARN_EVERY = 4;
/** Aynı anda biriktirilebilecek en fazla dondurma hakkı. */
export const FREEZE_MAX = 2;

export interface StreakStatus {
  /** Üst üste başarılı (hedefi tutturan) hafta sayısı; dondurulan haftalar seriyi bozmaz ama saymaz. */
  streak: number;
  /** Eldeki dondurma hakkı */
  freezes: number;
  /** Bu hafta bitmeden önce hedefe tutturulmadıysa bir sonraki hak için kalan başarılı hafta */
  untilNextFreeze: number;
  /** Dondurma hakkıyla kurtarılan haftaların Pazartesi tarihleri (YYYY-MM-DD) */
  frozenWeeks: string[];
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Haftalık seri ve dondurma hakkı. Ayrı bir kayıt tutulmaz; her seferinde
 * `completedDays` üzerinden hesaplanır (saat/tarih değişse bile tutarlı kalır).
 *
 * Kurallar (otomatik dondurma):
 * - Hedefi (WEEKLY_GOAL oturum) tutturan hafta seriyi 1 artırır.
 * - Her FREEZE_EARN_EVERY başarılı haftada 1 hak kazanılır, en fazla FREEZE_MAX birikir.
 * - Biten bir hafta hedefi tutturamadıysa ve hak varsa hak harcanır, seri korunur.
 *   Hak yoksa seri 0'a düşer.
 * - İçinde bulunulan hafta bitmediği için başarısız sayılmaz; yalnızca hedef tutturulduysa eklenir.
 */
export function streakStatus(
  progress: Progress,
  now: Date,
  goal: number = WEEKLY_GOAL,
): StreakStatus {
  const empty: StreakStatus = {
    streak: 0,
    freezes: 0,
    untilNextFreeze: FREEZE_EARN_EVERY,
    frozenWeeks: [],
  };
  if (progress.completedDays.length === 0) return empty;

  const countsByWeek = new Map<string, number>();
  for (const key of progress.completedDays) {
    const [y, m, d] = key.split('-').map(Number);
    const wk = dayKey(weekStart(new Date(y, m - 1, d)));
    countsByWeek.set(wk, (countsByWeek.get(wk) ?? 0) + 1);
  }

  const first = [...countsByWeek.keys()].sort()[0];
  const [fy, fm, fd] = first.split('-').map(Number);
  let cursor = new Date(fy, fm - 1, fd);
  const currentWeek = dayKey(weekStart(now));

  let streak = 0;
  let freezes = 0;
  let sinceEarn = 0;
  const frozenWeeks: string[] = [];

  // Geçmiş saat ayarı yüzünden ilk hafta şimdiden sonra kalırsa boş döneriz.
  for (let guard = 0; guard < 2000; guard++) {
    const key = dayKey(cursor);
    if (key > currentWeek) break;
    const met = (countsByWeek.get(key) ?? 0) >= goal;
    if (met) {
      streak += 1;
      sinceEarn += 1;
      if (sinceEarn >= FREEZE_EARN_EVERY) {
        freezes = Math.min(FREEZE_MAX, freezes + 1);
        sinceEarn = 0;
      }
    } else if (key !== currentWeek) {
      if (freezes > 0) {
        freezes -= 1;
        frozenWeeks.push(key);
      } else {
        streak = 0;
        sinceEarn = 0;
      }
    }
    cursor = addDays(cursor, 7);
  }

  return { streak, freezes, untilNextFreeze: FREEZE_EARN_EVERY - sinceEarn, frozenWeeks };
}

/**
 * Bu haftaki ilerleme. Streak günlük değil haftalık hedefe dayanır
 * (eczane vardiyaları yüzünden günlük seri kolay kırılır). Seri için bkz. streakStatus.
 */
export function weeklyProgress(
  progress: Progress,
  now: Date,
  goal: number = WEEKLY_GOAL,
): { done: number; goal: number } {
  return { done: weekDays(progress, now).filter((d) => d.done).length, goal };
}
