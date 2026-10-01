import type { Card, Concept } from '../core/types';
import { demoCards, demoConcepts } from './demo';

/**
 * Gerçek içerik gelene kadar demo kartları göstermek için true.
 * Gerçek içerik eklendiğinde false yapın: yalnızca 'onaylı' kartlar oynanır.
 */
export const ALLOW_DEMO_CONTENT = true;

export const concepts: Concept[] = [...demoConcepts];
export const allCards: Card[] = [...demoCards];

/** Kullanıcıya gösterilebilecek kartlar: onaylı, ve izin varsa demo. Taslak asla gösterilmez. */
export function playable(cards: Card[], allowDemo: boolean = ALLOW_DEMO_CONTENT): Card[] {
  return cards.filter((c) => c.status === 'onaylı' || (allowDemo && c.status === 'demo'));
}

export const playableCards: Card[] = playable(allCards);

export const hasDemoContent: boolean = playableCards.some((c) => c.status === 'demo');
