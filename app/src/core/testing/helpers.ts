import {
  caseContextOf,
  claimHash,
  contentHash,
  coreEntries,
  hashContext,
  type CaseContext,
  type HashContext,
} from '../contentHash';
import type { Card, CaseFollowUp, ContentPack, PatientCase } from '../types';
import type { ReleaseLock } from '../validate-pack';
import sentetik from './pack-magnezyum-sentetik.json';

/**
 * TEST YARDIMCILARI. Uygulama kodundan import edilmez.
 * Buradaki "onaylayıcı" gerçek bir kişi değildir; yalnızca doğrulayıcının onaylı yolunu sınamak
 * için üretilmiş sentetik bir kayıttır. Gerçek içerik eczacı tarafından insan eliyle onaylanır.
 */
export const SYNTHETIC_REVIEWER = 'Sentetik Test Onaylayıcı (gerçek kişi değil)';
export const APPROVAL_DATE = '2026-11-01';

/** Tamamen sentetik, "taslak" durumunda, [SENTETİK] işaretli paket (bu haliyle onaylanamaz). */
export function draftPack(): ContentPack {
  return JSON.parse(JSON.stringify(sentetik)) as ContentPack;
}

/** `[...]` biçimli yer tutucu işaretlerini siler (yalnızca onaylı yolu sınamak için). */
function stripMarkers<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\[[^\]]*\]\s*/g, '') as unknown as T;
  if (Array.isArray(value)) return value.map(stripMarkers) as unknown as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripMarkers(v)]),
    ) as T;
  }
  return value;
}

type Item = Card | PatientCase | CaseFollowUp;

function seal(item: Item, ctx: HashContext, caseCtx?: CaseContext): void {
  item.review = {
    by: SYNTHETIC_REVIEWER,
    on: APPROVAL_DATE,
    contentHash: contentHash(item, ctx, caseCtx),
  };
  item.reviewedAt = APPROVAL_DATE;
}

/**
 * Paketteki tüm onay kayıtlarını mevcut içeriğe göre yeniden üretir: `review`'u olan iddialar ve
 * durumu 'onaylı' olan öğeler. Testler önce paketi değiştirir, sonra mühürler; böylece yalnızca
 * sınanan kural başarısız olur ("özet eşleşmiyor" gürültüsü olmaz).
 */
export function sealPack(pack: ContentPack): ContentPack {
  const ctx = hashContext(pack);
  for (const c of pack.claims) {
    if (c.review) c.review = { by: SYNTHETIC_REVIEWER, on: APPROVAL_DATE, contentHash: claimHash(c, ctx) };
  }
  for (const card of pack.cards) if (card.status === 'onaylı') seal(card, ctx);
  for (const c of pack.cases) {
    if (c.status === 'onaylı') seal(c, ctx);
    if (c.followUp && c.followUp.status === 'onaylı') seal(c.followUp, ctx, caseContextOf(c));
  }
  return pack;
}

/** Yer tutucusuz, kaynakları tam, her şeyi 'onaylı' ve mühürlü sentetik paket (onaylı yolun sınanması için). */
export function approvedPack(): ContentPack {
  const pack = stripMarkers(draftPack());
  pack.sources.forEach((s) => {
    s.accessedAt = APPROVAL_DATE;
  });
  pack.claims.forEach((c) => {
    c.autoCheck = 'kaynak-eslesti';
    c.review = { by: SYNTHETIC_REVIEWER, on: APPROVAL_DATE, contentHash: '' };
  });
  pack.cards.forEach((c) => {
    c.status = 'onaylı';
  });
  pack.cases.forEach((c) => {
    c.status = 'onaylı';
    if (c.followUp) c.followUp.status = 'onaylı';
  });
  return sealPack(pack);
}

/** Paketteki onaylı içerikle birebir uyumlu, eksiksiz bir kilit (yayın kapısını geçmek için). */
export function lockFor(pack: ContentPack): ReleaseLock {
  return { lockVersion: 1, items: coreEntries(pack) };
}

export const EMPTY_LOCK: ReleaseLock = { lockVersion: 1, items: {} };
