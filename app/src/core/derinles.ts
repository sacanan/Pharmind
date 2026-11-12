import { selectDaily } from './daily';
import { cardLevel } from './level';
import type { Card, Progress } from './types';

/** Bir Derinleş oturumundaki en fazla kart sayısı. Ürün tercihidir; bilimsel olarak doğrulanmış bir eşik değildir. */
export const DERINLES_SIZE = 5;

/** Verilen kavramı test eden, Derinleş seviyesindeki kartlar. */
export function derinlesCardsFor(cards: Card[], conceptId: string): Card[] {
  return cards.filter((c) => cardLevel(c) === 'derinles' && c.conceptIds.includes(conceptId));
}

/**
 * Seçilen kavram için en fazla DERINLES_SIZE farklı Derinleş kartı. Sıralama Daily 5 ile aynıdır
 * (`selectDaily`: zamanı gelmiş, görülmemiş, sonra unutulmaya yakın); seçilen kavram ve Derinleş
 * seviyesi dışındaki kart sete girmez. 0 kart: boş dizi (oturum açılmaz, gün tamamlanmaz).
 * `masteryCards`: kavram zayıflığı için kullanılan liste (Derinleş mastery listesi).
 */
export function selectDerinles(
  cards: Card[],
  conceptId: string,
  progress: Progress,
  now: Date,
  masteryCards: Card[] = cards,
): Card[] {
  return selectDaily(derinlesCardsFor(cards, conceptId), progress, now, DERINLES_SIZE, masteryCards);
}
