import type { Card, CardLevel } from './types';

export const CARD_LEVELS: readonly CardLevel[] = ['temel', 'derinles'];

/** Seviyesi olmayan kart Temel'dir (mevcut kartlar ve vaka kararları). */
export function cardLevel(card: Pick<Card, 'level'>): CardLevel {
  return card.level ?? 'temel';
}

export function cardsOfLevel(cards: Card[], level: CardLevel): Card[] {
  return cards.filter((c) => cardLevel(c) === level);
}
