import { isLegacyConfidentError, isShakyRight, type AnswerLike } from './records';
import type { Progress } from './types';
import { dayKey } from './weekly';

/**
 * Blister dizisindeki bir gözün durumu.
 * - correct: doğru (yeni kayıtlarda bildirim yoksa da; "emin" iddiası taşımaz. Eski kayıtlarda: doğru ve emin)
 * - shaky: doğru ama kullanıcı "Tahmin ettim" dedi (eski kayıtlarda: kararsız veya tahmin)
 * - wrong: yanlış
 */
export type CellState = 'pending' | 'current' | 'correct' | 'wrong' | 'shaky';

type Answer = AnswerLike;

export function cellFor(answer: Answer): CellState {
  if (!answer.correct) return 'wrong';
  return isShakyRight(answer) ? 'shaky' : 'correct';
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
  /** Doğru cevap sayısı (tahmin işaretli doğrular dahil) */
  right: number;
  wrong: number;
  /** Doğru ama "Tahmin ettim" işaretli cevaplar (eski kayıtlarda: emin olmayanlar) */
  shaky: number;
  /**
   * Emin olduğu halde yanlış yapılan cevaplar. YALNIZCA eski (V1) güven bildirimlerinden hesaplanır;
   * yeni kayıtlarda güven bildirimi toplanmadığı için bu sayı yeni cevaplardan türetilmez.
   */
  legacyConfidentErrors: number;
}

export function summarize(results: Answer[]): SessionSummary {
  return {
    total: results.length,
    right: results.filter((r) => r.correct).length,
    wrong: results.filter((r) => !r.correct).length,
    shaky: results.filter(isShakyRight).length,
    legacyConfidentErrors: results.filter(isLegacyConfidentError).length,
  };
}

/** Ana ekranın ihtiyaç duyduğu, bellekteki oturum görünümü. */
export interface SessionView {
  cardIds: string[];
  results: Answer[];
  /** Oturumu tamamlayan cevabın yerel günü; yalnızca tamamlanmış oturumda vardır. */
  completedDay?: string;
}

/**
 * Devam eden oturum: tüm kartlar cevaplanmadıysa. Gün karşılaştırması YAPILMAZ; gece yarısını geçen
 * yarım oturum, ana sayfaya dönülünce de devam eder (M2-2).
 */
export function isSessionActive(session: SessionView | null): boolean {
  return !!session && session.results.length < session.cardIds.length;
}

/**
 * Ana ekrandaki blister. `now` her değerlendirmede verilir; zamanlayıcı gerekmez.
 * - Devam eden oturum: oturumun TÜM cevapları (bellekteki `results`), sıradaki göz boş görünür.
 * - Bugün tamamlanmış oturum: oturumun tüm cevapları. Önceki gün tamamlanmış oturum bugüne taşınmaz.
 * - Aksi halde bugün tamamlandıysa (örn. uygulama yeniden açıldı; oturum bellekte yok): yalnızca
 *   bugüne ait geçmiş kayıtları (`todaysCells`). Yarım oturum kalıcı değildir.
 * - Hiçbiri: boş gözler.
 */
export function homeCells(
  session: SessionView | null,
  progress: Progress,
  now: Date,
  size: number,
  doneToday: boolean,
): CellState[] {
  if (session && isSessionActive(session)) {
    return sessionCells(session.cardIds.length, session.results).map((c) => (c === 'current' ? 'pending' : c));
  }
  if (session && session.completedDay === dayKey(now)) {
    return sessionCells(session.cardIds.length, session.results);
  }
  if (doneToday) return todaysCells(progress, now, size);
  return Array<CellState>(size).fill('pending');
}
