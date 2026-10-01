import { cardMastery } from './scheduling';
import type { Card, Concept, Progress } from './types';

/**
 * Bir kavramın mastery skoru (0..1): kavramı test eden kartların mastery katkısının
 * ortalaması (bkz. cardMastery). Hiç görülmeyen kart 0 sayılır; yani bir kavramı
 * "bilmek" için tüm kartlarını görmüş ve kalıcı hale getirmiş olmak gerekir.
 */
export function conceptMastery(
  conceptId: string,
  cards: Card[],
  progress: Progress,
  now: Date,
): number {
  const related = cards.filter((c) => c.conceptIds.includes(conceptId));
  if (related.length === 0) return 0;
  const total = related.reduce((sum, c) => sum + cardMastery(progress, c.id, now), 0);
  return total / related.length;
}

export interface MasteryEntry {
  concept: Concept;
  mastery: number;
  /** Kavramı test eden kart sayısı */
  cardCount: number;
  /** Bunlardan en az bir kez cevaplanmış olanlar */
  seenCount: number;
}

/** Mastery haritasının verisi: kavram başına skor, en zayıf kavram önce. */
export function masteryMap(
  concepts: Concept[],
  cards: Card[],
  progress: Progress,
  now: Date,
): MasteryEntry[] {
  return concepts
    .map((concept) => {
      const related = cards.filter((c) => c.conceptIds.includes(concept.id));
      return {
        concept,
        mastery: conceptMastery(concept.id, cards, progress, now),
        cardCount: related.length,
        seenCount: related.filter((c) => progress.cards[c.id]?.reps).length,
      };
    })
    .sort((a, b) => a.mastery - b.mastery || a.concept.id.localeCompare(b.concept.id));
}
