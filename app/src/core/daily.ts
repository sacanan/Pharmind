import { conceptMastery } from './mastery';
import { retrievability } from './scheduling';
import type { Card, Progress } from './types';

export const DAILY_SIZE = 5;

/**
 * Günün 5 kartını seçer. Öncelik sırası:
 * 1. Tekrar zamanı gelmiş kartlar, hatırlanma olasılığı en düşük olan önce
 * 2. Hiç görülmemiş kartlar, kavramı en zayıf olan önce
 * 3. Hâlâ yer varsa, zamanı gelmemiş ama en çok unutulmaya yakın kartlar
 *
 * Aynı girdide aynı sonucu verir (rastgelelik yok), bu yüzden test edilebilir.
 *
 * `masteryCards`: kavram zayıflığı hesaplanırken kullanılan kart listesi. Vaka kararları da
 * kavram mastery'sine katıldığı için buraya eklenir; seçilen kartlar yine yalnızca `cards`'tandır.
 */
export function selectDaily(
  cards: Card[],
  progress: Progress,
  now: Date,
  size: number = DAILY_SIZE,
  masteryCards: Card[] = cards,
): Card[] {
  const seen = cards.filter((c) => progress.cards[c.id]);
  const unseen = cards.filter((c) => !progress.cards[c.id]);

  const byRetrievability = (a: Card, b: Card) =>
    retrievability(progress, a.id, now) - retrievability(progress, b.id, now) ||
    a.id.localeCompare(b.id);

  const due = seen
    .filter((c) => progress.cards[c.id].due.getTime() <= now.getTime())
    .sort(byRetrievability);

  const weakestConceptMastery = (card: Card) =>
    Math.min(...card.conceptIds.map((id) => conceptMastery(id, masteryCards, progress, now)));

  const fresh = [...unseen].sort(
    (a, b) => weakestConceptMastery(a) - weakestConceptMastery(b) || a.id.localeCompare(b.id),
  );

  const notDue = seen.filter((c) => !due.includes(c)).sort(byRetrievability);

  return [...due, ...fresh, ...notDue].slice(0, size);
}
