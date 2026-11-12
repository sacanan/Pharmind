import { decisionCardId, followUpCardId } from './case';
import type {
  Card,
  CaseDecision,
  CaseFollowUp,
  CaseQuestion,
  Claim,
  Concept,
  PatientCase,
  Source,
} from './types';

/**
 * İçerik özetleri. İKİ AYRI KAPSAM vardır ve amaçları farklıdır:
 *
 * 1. ONAY BÜTÜNLÜĞÜ — `contentHash` / `claimHash`. Bir öğenin (kart, vaka, geri dönüş) veya iddianın
 *    onaylandığı andaki tüm içeriğini kapsar. Onaydan sonra herhangi bir şey değişirse özet
 *    değişir ve `review` kaydı geçersiz olur → yeniden onay gerekir.
 *    Kapsam:
 *    - öğenin kendi içeriği (`status`, `review`, `reviewedAt`, `contentVersion` hariç; vakada
 *      `followUp` hariç, geri dönüşün ayrı onayı vardır; geri dönüşte ise ana vakanın sunumu,
 *      soru bütçesi ve soruları dahildir),
 *    - bağlı iddiaların tamamı (`autoCheck` ve `review` hariç) ve iddiaların dayandığı KAYNAK
 *      KAYITLARI (tür, başlık, yayıncı, yıl, URL, erişim tarihi): kaynak künyesi değişirse o
 *      kaynağa dayanan iddianın ve o iddiaya dayanan her öğenin onayı düşer,
 *    - öğenin bağlı olduğu KAVRAMLARIN kimliği ve adı.
 *
 * 2. ÖĞRENME KİMLİĞİ (çekirdek) — `coreHash`. Kart kimliği cihazdaki ilerlemenin (FSRS durumu)
 *    anahtarıdır; çekirdek değişirse aynı kimlik altındaki eski ilerleme artık başka bir bilgiyi
 *    veya başka bir kavramı ölçer. Bu yüzden onaylı bir öğenin çekirdeği `release-lock.json` ile
 *    kilitlenir (bkz. validate-pack.ts): çekirdek değiştiyse YENİ KİMLİK verilir, eski kimlik
 *    emekli olur (kilitte kalır; ilerleme kaydı yetim kalır ve mastery/Daily 5 tarafından yok
 *    sayılır). Kapsam:
 *    - kart: soru, seçenek metinleri (sıradan bağımsız), doğru cevabın metni, `conceptIds`, seviye
 *      (yalnızca 'derinles' yazılır; 'temel' ve seviyesiz aynıdır);
 *    - vaka kararı: karar metni, seçenek metni + derecesi, `conceptIds` VE vakanın bağlamı
 *      (hasta sunumu, soru bütçesi, soruların kimliği/metni/cevabı/`critical` alanı);
 *    - geri dönüş: karar çekirdeği + üç anlatım (iyi/karışık/zayıf) + ANA VAKANIN bağlamı (sunum,
 *      soru bütçesi, sorular; karar çekirdeğiyle aynı bağlam);
 *    - bağlı iddialar: kimlik, `kind`, `risk`, `text`, `severity`, `action`.
 *    Kapsam dışı (cila): açıklama, gerekçe, sonuç notu, kaynak etiketi, durum, seçenek sırası,
 *    iddianın `evidence`/`sourceRefs`'i, vakanın başlığı ve kapanış metni, KAVRAM ADI.
 *    Kavram adı çekirdek değildir. Bir kavramın ANLAMI değişiyorsa (yalnızca adı değil) kavrama
 *    YENİ KAVRAM KİMLİĞİ verilir ve bağlı öğeler yeni kimliğe taşınır; `conceptIds` çekirdekte
 *    olduğundan bu, bağlı onaylı öğelere de yeni öğrenme kimliği gerektirir.
 *
 * UYARI: Bu özetler kriptografik değildir (bağımlılıksız, basit bir FNV-1a çifti). Kazara
 * değişikliği yakalamak içindir; kötü niyete karşı koruma veya gerçek insan onayının kanıtı
 * DEĞİLDİR. Hash'i bilen biri `review` kaydını elle üretebilir; bu yüzden model çıktısındaki
 * `review` alanları doğrulama katmanında reddedilir (bkz. validateDraftPack).
 */

/** Anahtarları sıralı, `undefined` değerleri atlanmış kararlı JSON. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(compareCodeUnits)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const hex8 = (n: number): string => n.toString(16).padStart(8, '0');

/** Özet biçimi: algoritma sürümü öneki (`h1:`) + 16 küçük harfli onaltılık hane. */
export const HASH_FORMAT = /^h1:[0-9a-f]{16}$/;

/** Algoritma sürümü önekli (`h1:`) 64 bitlik, kriptografik olmayan özet. */
export function hashString(s: string): string {
  return `h1:${hex8(fnv1a(s, 0x811c9dc5))}${hex8(fnv1a(s, 0x9747b28c))}`;
}

type ClaimsById = ReadonlyMap<string, Claim>;
type Reviewable = Card | PatientCase | CaseFollowUp;

/** Bütünlük özetlerinin hesaplandığı bağlam: iddialar, kaynak kayıtları ve kavramlar. */
export interface HashContext {
  claims: ClaimsById;
  sources: ReadonlyMap<string, Source>;
  concepts: ReadonlyMap<string, Concept>;
}

export function claimsMap(claims: readonly Claim[] | undefined): ClaimsById {
  return new Map((claims ?? []).map((c) => [c.id, c]));
}

export function hashContext(src: {
  claims?: readonly Claim[];
  sources?: readonly Source[];
  concepts?: readonly Concept[];
}): HashContext {
  return {
    claims: claimsMap(src.claims),
    sources: new Map((src.sources ?? []).map((s) => [s.id, s] as const)),
    concepts: new Map((src.concepts ?? []).map((c) => [c.id, c] as const)),
  };
}

/** Metin listesi değilse boş döner; sıralı ve tekilleştirilmiş. */
function idList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))].sort(compareCodeUnits) : [];
}

/**
 * İddianın onay özeti: `autoCheck` ve `review` hariç her şey, artı iddianın dayandığı kaynak
 * kayıtlarının tamamı (kaynak kaydı bulunamazsa "missing" işareti girer).
 */
export function claimHash(claim: Claim, ctx: HashContext): string {
  const { autoCheck: _a, review: _r, ...body } = claim;
  const refs = Array.isArray(claim.sourceRefs) ? claim.sourceRefs : [];
  const sourceIds = idList(refs.map((r) => (r as { sourceId?: unknown } | null)?.sourceId));
  const sources = sourceIds.map((id) => ctx.sources.get(id) ?? { id, missing: true });
  return hashString(canonicalJson({ body, sources }));
}

/** İddianın bilimsel çekirdeği (öğrenme kimliği için). */
function claimCore(id: string, claims: ClaimsById): unknown {
  const c = claims.get(id);
  return c
    ? { id, kind: c.kind, risk: c.risk, text: c.text, severity: c.severity, action: c.action }
    : { id, missing: true };
}

/** Bir öğenin (kart, vaka, geri dönüş) bağlı olduğu iddia kimlikleri, sıralı ve tekilleştirilmiş. */
export function claimIdsOf(item: Reviewable): string[] {
  const ids: string[] = [];
  if ('decisions' in item) {
    for (const d of item.decisions) ids.push(...idList(d.claimIds));
  } else if ('decision' in item) {
    ids.push(...idList(item.decision.claimIds));
  } else {
    ids.push(...idList(item.claimIds));
  }
  return [...new Set(ids)].sort(compareCodeUnits);
}

/** Bir öğenin bağlı olduğu kavram kimlikleri, sıralı ve tekilleştirilmiş. */
export function conceptIdsOf(item: Reviewable): string[] {
  const ids: string[] = [];
  if ('decisions' in item) {
    for (const d of item.decisions) ids.push(...idList(d.conceptIds));
  } else if ('decision' in item) {
    ids.push(...idList(item.decision.conceptIds));
  } else {
    ids.push(...idList(item.conceptIds));
  }
  return [...new Set(ids)].sort(compareCodeUnits);
}

/**
 * Onay bütünlüğü özeti (bkz. dosya başı açıklaması). Vaka için `followUp` dahil değildir;
 * bağlı iddialar (ve onların kaynak kayıtları) ile bağlı kavramların kimlik+adı dahildir.
 */
export function contentHash(item: Reviewable, ctx: HashContext, caseCtx?: CaseContext): string {
  const { status: _s, review: _r, reviewedAt: _d, contentVersion: _v, ...rest } = item as Reviewable & {
    followUp?: unknown;
  };
  const { followUp: _f, ...body } = rest as Record<string, unknown>;
  const claims = claimIdsOf(item).map((id) => {
    const c = ctx.claims.get(id);
    return { id, hash: c ? claimHash(c, ctx) : 'missing' };
  });
  const concepts = conceptIdsOf(item).map((id) => {
    const k = ctx.concepts.get(id);
    return k ? { id, name: k.name } : { id, missing: true };
  });
  // Geri dönüş, ana vakanın bağlamına bağlıdır: sunum, soru bütçesi ve sorular değişirse onayı düşer.
  // Geri dönüş için bağlam verilmezse "missing" işareti girer; eşleşmeyen özet sessizce geçmez.
  const parent = isFollowUp(item) ? (caseCtx ? caseContextCore(caseCtx) : 'missing') : undefined;
  return hashString(canonicalJson({ body, claims, concepts, case: parent }));
}

/** Geri dönüş mü (karar + anlatımlar)? Vaka `decisions`, kart `options` taşır. */
function isFollowUp(item: Reviewable): item is CaseFollowUp {
  return 'decision' in item && 'returns' in item;
}

// ---------------------------------------------------------------------------
// Öğrenme kimliği (çekirdek)
// ---------------------------------------------------------------------------

/** Bir vaka kararının anlamını belirleyen vaka bağlamı. */
export interface CaseContext {
  presentation: string;
  questionBudget: number;
  questions: readonly CaseQuestion[];
}

/** Vakanın, karar ve geri dönüş anlamını belirleyen bağlamı. */
export function caseContextOf(c: PatientCase): CaseContext {
  return { presentation: c.presentation, questionBudget: c.questionBudget, questions: c.questions };
}

/**
 * Dil ve bölge ayarından BAĞIMSIZ karşılaştırıcı: UTF-16 kod birimlerine göre sıralar. `localeCompare`
 * ortama (ICU, dil, bölge) bağlıdır ve Unicode'da denk sayılan farklı kodlamalar için 0 döndürebilir
 * (sıra girdi sırasına kalır); bu, aynı içeriğin farklı ortamlarda farklı özet üretmesine yol açar.
 * Farklı metinler için asla 0 döndürmez.
 */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Öğeleri kanonik JSON'larına göre sıralar: girdi sırasından ve ortamdan bağımsız, kesin (toplam) sıra. */
function sortCanonical<T>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, key: canonicalJson(item) }))
    .sort((a, b) => compareCodeUnits(a.key, b.key))
    .map((x) => x.item);
}

function cardCore(card: Card, claims: ClaimsById): unknown {
  return {
    prompt: card.prompt,
    options: [...card.options].sort(compareCodeUnits),
    answer: card.options[card.correctIndex],
    conceptIds: idList(card.conceptIds),
    claims: idList(card.claimIds).map((id) => claimCore(id, claims)),
    // Seviye öğrenme kimliğinin parçasıdır (hangi mastery'ye saydığını belirler). Yalnızca 'derinles'
    // yazılır: seviyesiz ve 'temel' kartların özeti, bu alan eklenmeden önceki özetle AYNIDIR.
    ...(card.level === 'derinles' ? { level: 'derinles' } : {}),
  };
}

function caseContextCore(ctx: CaseContext): unknown {
  return {
    presentation: ctx.presentation,
    questionBudget: ctx.questionBudget,
    questions: sortCanonical(ctx.questions.map((q) => ({ id: q.id, ask: q.ask, reply: q.reply, critical: q.critical }))),
  };
}

function decisionCore(d: CaseDecision, claims: ClaimsById, caseCtx?: CaseContext): unknown {
  return {
    prompt: d.prompt,
    options: sortCanonical(d.options.map((o) => ({ text: o.text, rating: o.rating }))),
    conceptIds: idList(d.conceptIds),
    claims: idList(d.claimIds).map((id) => claimCore(id, claims)),
    case: caseCtx ? caseContextCore(caseCtx) : undefined,
  };
}

/** Bir kartın öğrenme kimliğini belirleyen çekirdek özeti. */
export function cardCoreHash(card: Card, claims: ClaimsById): string {
  return hashString(canonicalJson(cardCore(card, claims)));
}

/**
 * Bir vaka kararının çekirdek özeti. `caseCtx` verilirse vakanın sunumu, soru bütçesi ve soruları
 * da kapsanır (bu bağlam değişince iyi karar tanımı değişebilir).
 */
export function decisionCoreHash(d: CaseDecision, claims: ClaimsById, caseCtx?: CaseContext): string {
  return hashString(canonicalJson(decisionCore(d, claims, caseCtx)));
}

/** Geri dönüş çekirdeği: geri dönüş kararı + üç anlatım varyantı + ana vakanın bağlamı. */
export function followUpCoreHash(f: CaseFollowUp, claims: ClaimsById, caseCtx: CaseContext): string {
  return hashString(
    canonicalJson({
      decision: decisionCore(f.decision, claims, caseCtx),
      returns: { iyi: f.returns?.iyi, karisik: f.returns?.karisik, zayif: f.returns?.zayif },
    }),
  );
}

/**
 * Kaynağın ürettiği TÜM ilerleme kimlikleri (tekrarlar dahil, durumdan bağımsız): kart kimlikleri,
 * `case:<vaka>:<karar>` ve `case:<vaka>:followup`. Hata fırlatmaz.
 */
export function learningIdList(src: CoreSource): string[] {
  const ids: string[] = [];
  for (const card of src.cards) ids.push(String(card.id));
  for (const c of src.cases) {
    for (const d of c.decisions) ids.push(decisionCardId(String(c.id), String(d.id)));
    if (c.followUp) ids.push(followUpCardId(String(c.id)));
  }
  return ids;
}

/** Aynı ilerleme kimliğini birden fazla öğe üretiyorsa o kimlikler (örn. karar "followup", farklı ayraç dağılımı). */
export function learningIdCollisions(src: CoreSource): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const id of learningIdList(src)) {
    if (seen.has(id)) out.add(id);
    seen.add(id);
  }
  return [...out].sort(compareCodeUnits);
}

export interface CoreSource {
  cards: readonly Card[];
  cases: readonly PatientCase[];
  claims?: readonly Claim[];
}

/**
 * İlerleme kimliği → çekirdek özeti. Kimlikler uygulamadaki ilerleme anahtarlarıyla aynıdır:
 * kartın kendi kimliği, `case:<vaka>:<karar>` ve `case:<vaka>:followup`.
 * Varsayılan olarak yalnızca 'onaylı' öğeler girer (taslak serbestçe değişebilir, demo kilitlenmez);
 * geri dönüşün durumu vakadan bağımsız değerlendirilir.
 */
export function coreEntries(src: CoreSource, approvedOnly = true): Record<string, string> {
  const dupes = learningIdCollisions(src);
  if (dupes.length > 0) {
    // Sessizce üzerine yazmak yerine dur: aynı ilerleme anahtarı iki farklı içeriğe işaret ediyor.
    throw new Error(`öğrenme kimliği çakışması: ${dupes.join(', ')}`);
  }
  const claims = claimsMap(src.claims);
  const included = (status: string): boolean => !approvedOnly || status === 'onaylı';
  const out: Record<string, string> = {};
  for (const card of src.cards) {
    if (included(card.status)) out[card.id] = cardCoreHash(card, claims);
  }
  for (const c of src.cases) {
    if (included(c.status)) {
      for (const d of c.decisions) {
        out[decisionCardId(c.id, d.id)] = decisionCoreHash(d, claims, caseContextOf(c));
      }
    }
    if (c.followUp && included(c.followUp.status)) {
      out[followUpCardId(c.id)] = followUpCoreHash(c.followUp, claims, caseContextOf(c));
    }
  }
  return out;
}
