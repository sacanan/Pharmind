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

/**
 * Bu haftaki ilerleme. Streak günlük değil haftalık hedefe dayanır
 * (eczane vardiyaları yüzünden günlük seri kolay kırılır).
 * Dondurma hakkı henüz yok; sonraki dilimde eklenecek.
 */
export function weeklyProgress(
  progress: Progress,
  now: Date,
  goal: number = WEEKLY_GOAL,
): { done: number; goal: number } {
  return { done: weekDays(progress, now).filter((d) => d.done).length, goal };
}
