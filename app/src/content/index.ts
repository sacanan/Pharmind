import type { Card, Concept, ContentStatus, PatientCase } from '../core/types';
import { decisionCards } from '../core/case';
import { validateCard, validateCase, validateFollowUp } from '../core/validate';
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
/**
 * Bir vakanın oynanabilir görünümü: vaka izinli durumda ve geçerli değilse null. Geri dönüş
 * ("Hasta geri geldi") ayrıca onaylanır; onaysız (taslak) veya bozuk geri dönüş yalnızca
 * geri dönüşü düşürür, vakanın kendisi oynanmaya devam eder.
 */
export function playableCaseView(
  c: PatientCase,
  allowDemo: boolean = ALLOW_DEMO_CONTENT,
): PatientCase | null {
  if (playable([c], allowDemo).length === 0) return null;
  const followUpOk =
    !!c.followUp &&
    playable([c.followUp], allowDemo).length === 1 &&
    validateFollowUp(c.followUp).length === 0;
  const view = followUpOk ? c : { ...c, followUp: undefined };
  return validateCase(view).length === 0 ? view : null;
}

export const playableCases: PatientCase[] = allCases
  .map((c) => playableCaseView(c))
  .filter((c): c is PatientCase => c !== null);

/**
 * Kavram mastery'sine katılan her şey: oynanabilir kartlar ve vaka kararları.
 * Ana ekrandaki harita ve Daily 5 seçimi aynı listeyi kullanır.
 */
export const masteryCards: Card[] = [...playableCards, ...decisionCards(playableCases)];

export const hasDemoContent: boolean =
  playableCards.some((c) => c.status === 'demo') || playableCases.some((c) => c.status === 'demo');
