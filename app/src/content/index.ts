import type { Card, Concept, ContentStatus, PatientCase } from '../core/types';
import { validateCard, validateCase } from '../core/validate';
import { demoCards, demoConcepts } from './demo';
import { demoCase } from './demo-case';

/**
 * Gerçek içerik gelene kadar demo kartları göstermek için true.
 * Gerçek içerik eklendiğinde false yapın: yalnızca 'onaylı' kartlar oynanır.
 */
export const ALLOW_DEMO_CONTENT = true;

export const concepts: Concept[] = [...demoConcepts];
export const allCards: Card[] = [...demoCards];

/** Kullanıcıya gösterilebilecek kartlar: onaylı, ve izin varsa demo. Taslak asla gösterilmez. */
export function playable<T extends { status: ContentStatus }>(
  items: T[],
  allowDemo: boolean = ALLOW_DEMO_CONTENT,
): T[] {
  return items.filter((c) => c.status === 'onaylı' || (allowDemo && c.status === 'demo'));
}

/**
 * Oynanabilir içerik: izinli durumda ve yapısal olarak geçerli olanlar. Bozuk bir içerik
 * (boş kaynak, aralık dışı doğru cevap vb.) uygulamayı çökertmek yerine sessizce dışarıda kalır;
 * testler bunu yüksek sesle yakalar.
 */
export const playableCards: Card[] = playable(allCards).filter((c) => validateCard(c).length === 0);

export const allCases: PatientCase[] = [demoCase];
export const playableCases: PatientCase[] = playable(allCases).filter(
  (c) => validateCase(c).length === 0,
);

export const hasDemoContent: boolean =
  playableCards.some((c) => c.status === 'demo') || playableCases.some((c) => c.status === 'demo');
