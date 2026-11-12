import { createEmptyCard, fsrs } from 'ts-fsrs';
import { POLICY_VERSION, decideGrade, toFsrsGrade } from './policy';
import type { Card, PolicyGrade, Progress, ReviewRecordV2, SelfReport, SessionKind } from './types';

/**
 * Günlük oturum mantığı: kısa öğrenme adımları (dakikalar) kapalıdır, aralıklar gün bazlıdır.
 * Aksi halde yeni karta cevap verdikten 10 dakika sonra kart "vadesi gelmiş" sayılır ve
 * aynı gün açılan yeni oturumda aynı kartlar yeniden sorulabilirdi.
 */
const scheduler = fsrs({ request_retention: 0.9, enable_short_term: false });

/**
 * Geçmişte tutulan en fazla kayıt sayısı. UYARI: bu sınır yüzünden eski kayıtlar silinir; bu nedenle
 * (politika sürümü kaydedilse bile) FSRS durumu geçmişten eksiksiz yeniden hesaplanamaz. Tam yeniden
 * hesaplama ve saklama mimarisi ayrı bir karardır (bkz. docs/product-decisions.md).
 */
export const HISTORY_LIMIT = 500;

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, history: [], completedDays: [], caseResults: {} };
}

/**
 * Bir kartın FSRS durumunu verilen derece ile ilerletir; geçmişe kayıt EKLEMEZ. Derecenin nereden
 * geldiği çağırana aittir (kart cevapları için `decideGrade`, vaka kararları için karar derecesi).
 */
export function scheduleCard(progress: Progress, card: Card, grade: PolicyGrade, now: Date): Progress {
  const current = progress.cards[card.id] ?? createEmptyCard(now);
  const when =
    current.last_review && now.getTime() < current.last_review.getTime() ? current.last_review : now;
  const { card: next } = scheduler.next(current, when, toFsrsGrade(grade));
  return { ...progress, cards: { ...progress.cards, [card.id]: next } };
}

/**
 * Bir kart cevabını işler ve yeni bir Progress döndürür (girdiyi değiştirmez). Derece deneysel politikadan
 * gelir (bkz. policy.ts); yeni türdeki (V2) kayıt politika sürümünü, dereceyi ve girdileri taşır.
 */
export function reviewCard(
  progress: Progress,
  card: Card,
  correct: boolean,
  selfReport: SelfReport,
  now: Date,
  kind: SessionKind = 'temel',
): Progress {
  const grade = decideGrade({ correct, selfReport });
  const scheduled = scheduleCard(progress, card, grade, now);
  const record: ReviewRecordV2 = {
    recordVersion: 2,
    cardId: card.id,
    correct,
    selfReport,
    optionCount: card.options.length,
    at: now.toISOString(),
    policy: { version: POLICY_VERSION, grade },
    sessionKind: kind,
  };
  return { ...scheduled, history: [...progress.history, record].slice(-HISTORY_LIMIT) };
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
