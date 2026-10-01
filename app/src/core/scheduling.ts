import { Rating, createEmptyCard, fsrs, type Grade } from 'ts-fsrs';
import type { Card, Confidence, Progress, ReviewRecord } from './types';

const scheduler = fsrs({ request_retention: 0.9 });

export const HISTORY_LIMIT = 500;

/**
 * Cevap + güven seçimini FSRS puanına çevirir.
 *
 * - Yanlış cevap her zaman "Again" (güvenle yanlış yapmak ayrıca history'de görülebilir).
 * - Doğru ve emin: "Good".
 * - Doğru ama kararsız veya tahmin: "Hard"; bilgi henüz oturmamış.
 *
 * "Easy" V1'de kullanılmaz: hız ölçümü sonraki sürüme kalıyor.
 */
export function gradeFor(correct: boolean, confidence: Confidence): Grade {
  if (!correct) return Rating.Again;
  return confidence === 'sure' ? Rating.Good : Rating.Hard;
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, history: [], completedDays: [] };
}

/** Bir kartı cevaplanmış olarak işler ve yeni bir Progress döndürür (girdiyi değiştirmez). */
export function reviewCard(
  progress: Progress,
  card: Card,
  correct: boolean,
  confidence: Confidence,
  now: Date,
): Progress {
  const current = progress.cards[card.id] ?? createEmptyCard(now);
  // Telefonun saati geri alınırsa FSRS hata verir; son tekrar zamanından öncesine inmeyiz.
  const when =
    current.last_review && now.getTime() < current.last_review.getTime() ? current.last_review : now;
  const { card: next } = scheduler.next(current, when, gradeFor(correct, confidence));
  const record: ReviewRecord = {
    cardId: card.id,
    correct,
    confidence,
    at: now.toISOString(),
  };
  return {
    ...progress,
    cards: { ...progress.cards, [card.id]: next },
    history: [...progress.history, record].slice(-HISTORY_LIMIT),
  };
}

/** 0 ile 1 arası: kartın şu an hatırlanma olasılığı. Hiç görülmediyse 0. Tekrar sıralaması için. */
export function retrievability(progress: Progress, cardId: string, now: Date): number {
  const state = progress.cards[cardId];
  if (!state || state.reps === 0) return 0;
  return scheduler.get_retrievability(state, now, false);
}

/** Bir kart, kararlılığı bu kadar güne (FSRS stability) ulaştığında "oturmuş" sayılır. Ayarlanabilir. */
export const MASTERY_TARGET_STABILITY_DAYS = 30;

/**
 * 0 ile 1 arası: tek bir kartın mastery katkısı.
 *
 * Kararlılık (bilginin ne kadar kalıcı olduğu) hedefe oranlanır ve şu anki hatırlanma
 * olasılığıyla çarpılır. Böylece:
 * - yanlış cevaplı kart ~0, tek seferlik doğru cevap düşük kalır (bir kez görmek bilmek değildir)
 * - aralıklı tekrarlarla kararlılık artınca 1'e ulaşır
 * - tekrar edilmezse zamanla düşer
 *
 * Yalnızca "şu anki hatırlanma olasılığı" kullanılmaz: kart az önce görüldüyse cevap yanlış
 * bile olsa ~1 çıkardı.
 */
export function cardMastery(progress: Progress, cardId: string, now: Date): number {
  const state = progress.cards[cardId];
  if (!state || state.reps === 0) return 0;
  const durable = Math.min(1, state.stability / MASTERY_TARGET_STABILITY_DAYS);
  return durable * retrievability(progress, cardId, now);
}
