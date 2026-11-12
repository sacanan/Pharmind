import {
  HASH_FORMAT,
  caseContextOf,
  claimHash,
  claimIdsOf,
  contentHash,
  coreEntries,
  hashContext,
  learningIdCollisions,
  learningIdList,
  type CaseContext,
  type HashContext,
} from './contentHash';
import { filled, validDate, validateCard, validateCase } from './validate';
import type {
  AutoCheck,
  Card,
  CaseFollowUp,
  Claim,
  ClaimKind,
  ContentPack,
  EvidenceLevel,
  PatientCase,
  Review,
  Severity,
  Source,
  SourceType,
} from './types';

/**
 * İçerik paketi doğrulaması. Katmanlar bilerek ayrı tutulur:
 *
 * 0. `shapeProblems`: bozuk girdiye karşı şekil denetimi. Kök nesne, tüm iç içe diziler ve liste
 *    alanları doğru türde mi? Diğer tüm doğrulayıcılar önce bunu çalıştırır; şekil bozuksa
 *    İSTİSNA FIRLATMAZ, hata listesi döndürür ve derin denetimleri atlar.
 * 1. `validatePack`: her durumda (taslak dahil) yapı, kimlik benzersizliği ve referans geçerliliği.
 *    Bilinmeyen alanları reddeder (paket biçimi kapalıdır). Taslak içerik burada eksik kaynaklı
 *    veya yer tutuculu olabilir.
 * 2. `validateApprovals`: YALNIZCA durumu 'onaylı' olan öğeler için ek kurallar (insan onay kaydı,
 *    kaynak ve kanıt, yüksek risk). Taslağa dokunmaz.
 * 3. `validateDraftPack`: model/Gemini çıktısı için. Katman 1'e ek olarak her türlü onay
 *    belirtisini REDDEDER ('onaylı' durum, `review`, 'beklemede' dışı `autoCheck`). Model onay
 *    üretemez; temizlemek yetmez, çıktı geçersiz sayılır.
 * 4. `validatePackForRelease(pack, lock)` = 1 + 2 + KİLİT. Kilit zorunludur: onaylı her öğenin
 *    çekirdek özeti `release-lock.json`'da bulunmalı ve eşleşmelidir. Boş veya eksik kilitle,
 *    onaylı içerik yayına hazır sayılmaz.
 *
 * Bu dosya ürün kodundan çağrılmaz; yalnızca testler ve ileride araçlar kullanır.
 */

const SOURCE_TYPES: SourceType[] = ['etiket', 'kilavuz', 'monograf', 'derleme', 'calisma', 'mevzuat'];
const CLAIM_KINDS: ClaimKind[] = [
  'mekanizma',
  'endikasyon',
  'formulasyon',
  'doz',
  'etkilesim',
  'yanetki',
  'kontrendikasyon',
  'mevzuat',
  'diger',
];
const EVIDENCE: EvidenceLevel[] = ['etiket', 'kilavuz', 'derleme', 'calisma', 'uzman'];
const SEVERITIES: Severity[] = ['hafif', 'orta', 'ciddi'];
const AUTO_CHECKS: AutoCheck[] = ['beklemede', 'kaynak-eslesti', 'itirazli'];

/** Bu türdeki iddialar her zaman yüksek risklidir; düşük işaretlenemez. */
export const HIGH_RISK_KINDS: ClaimKind[] = ['doz', 'etkilesim', 'kontrendikasyon'];
/** Yüksek riskli iddia, bunlardan birine alıntıyla dayanmak zorundadır. */
export const PRIMARY_SOURCE_TYPES: SourceType[] = ['etiket', 'kilavuz', 'monograf'];
/** Yüksek riskli iddianın kanıt düzeyi bunlardan biri olmalıdır. */
export const PRIMARY_EVIDENCE: EvidenceLevel[] = ['etiket', 'kilavuz'];

/** Paket biçimi kapalıdır: burada olmayan bir alan (örn. "verified", "eczaciOnayi") reddedilir. */
const ALLOWED_KEYS = {
  pack: ['schemaVersion', 'id', 'idPrefix', 'topic', 'title', 'concepts', 'sources', 'claims', 'cards', 'cases'],
  concept: ['id', 'name'],
  source: ['id', 'type', 'title', 'publisher', 'year', 'url', 'accessedAt'],
  sourceRef: ['sourceId', 'locator', 'quote'],
  claim: ['id', 'kind', 'text', 'evidence', 'risk', 'severity', 'action', 'sourceRefs', 'autoCheck', 'review'],
  review: ['by', 'on', 'contentHash'],
  card: [
    'id',
    'conceptIds',
    'prompt',
    'options',
    'correctIndex',
    'explanation',
    'source',
    'reviewedAt',
    'status',
    'level',
    'claimIds',
    'contentVersion',
    'review',
  ],
  case: [
    'id',
    'title',
    'presentation',
    'questions',
    'questionBudget',
    'decisions',
    'outcome',
    'followUp',
    'source',
    'reviewedAt',
    'status',
    'contentVersion',
    'review',
  ],
  question: ['id', 'ask', 'reply', 'critical'],
  decision: ['id', 'prompt', 'conceptIds', 'options', 'claimIds'],
  option: ['text', 'rating', 'rationale', 'consequence'],
  followUp: ['returns', 'decision', 'source', 'reviewedAt', 'status', 'contentVersion', 'review'],
  returns: ['iyi', 'karisik', 'zayif'],
} as const;

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

function unknownKeys(obj: unknown, allowed: readonly string[], label: string): string[] {
  if (!isObject(obj)) return [];
  return Object.keys(obj)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${label}: bilinmeyen alan "${k}"`);
}

/** Şekil denetiminden geçtikten sonra kullanılır; liste olmayan değer burada boş sayılmaz (önce reddedilmiş olur). */
const listOf = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

function dupes(ids: string[]): string[] {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) out.add(id);
    seen.add(id);
  }
  return [...out];
}

/** Beklenmeyen bir yapı yüzünden doğrulayıcı çökerse istisna yerine hata listesi döndürür. */
function safe(label: string, fn: () => string[]): string[] {
  try {
    return fn();
  } catch {
    return [`${label}: doğrulama tamamlanamadı (beklenmeyen yapı)`];
  }
}

/** Yer tutucu işaretleri: köşeli parantez içinde TASLAK, SENTETİK, doldurulacak vb. */
const PLACEHOLDER = /\[[^\]]*(taslak|sentetik|doldurulacak|aranacak|bulunacak|tbd|todo|demo|yer tutucu)[^\]]*\]/;

export function hasPlaceholder(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  // "İ" küçük harfe çevrilirken "i̇" olur; önce açıkça "i"ye indirgeriz.
  return PLACEHOLDER.test(text.replace(/İ/g, 'i').toLowerCase());
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (isObject(value)) Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

/** Onay kaydının kendisi ve vakanın ayrı onaylanan geri dönüşü, metin taramasının dışındadır. */
function textsOf(item: Card | PatientCase | CaseFollowUp): string[] {
  const { review: _r, followUp: _f, ...rest } = item as unknown as Record<string, unknown>;
  return collectStrings(rest);
}

function reviewShape(label: string, review: unknown): string[] {
  if (review === undefined) return [];
  if (!isObject(review)) return [`${label}: review biçimi geçersiz`];
  const p = unknownKeys(review, ALLOWED_KEYS.review, `${label} review`);
  if (!filled(review.by)) p.push(`${label}: review.by boş`);
  if (!validDate(review.on)) p.push(`${label}: review.on YYYY-AA-GG değil`);
  if (!filled(review.contentHash)) p.push(`${label}: review.contentHash boş`);
  else if (typeof review.contentHash !== 'string' || !HASH_FORMAT.test(review.contentHash)) {
    p.push(`${label}: review.contentHash biçimi geçersiz (h1: + 16 küçük harfli onaltılık hane olmalı)`);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Katman 0: şekil denetimi (bozuk girdide istisna yerine hata listesi)
// ---------------------------------------------------------------------------

/**
 * Kök nesne, iç içe diziler ve liste alanları doğru türde mi? `conceptIds` gibi liste alanları
 * yanlış türdeyse sessizce boş kabul edilmez, hata üretilir. Boş liste (`[]`) şekil olarak
 * geçerlidir; içeriğin anlamlı olup olmadığını (örn. "en az bir kavram") ilgili kurallar denetler.
 */
export function shapeProblems(pack: unknown): string[] {
  if (!isObject(pack)) return ['paket: kök nesne geçersiz (bir nesne olmalı)'];
  const p: string[] = [];

  const objects = (
    label: string,
    value: unknown,
    each?: (el: Record<string, unknown>, elLabel: string) => void,
  ): void => {
    if (!Array.isArray(value)) {
      p.push(`${label}: liste olmalı`);
      return;
    }
    value.forEach((el, i) => {
      const elLabel = `${label}[${i}]`;
      if (!isObject(el)) p.push(`${elLabel}: nesne olmalı`);
      else each?.(el, elLabel);
    });
  };
  const strings = (label: string, value: unknown, required: boolean): void => {
    if (value === undefined && !required) return;
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
      p.push(`${label}: metin listesi olmalı`);
    }
  };
  const decision = (value: unknown, label: string): void => {
    if (!isObject(value)) {
      p.push(`${label}: nesne olmalı`);
      return;
    }
    strings(`${label}.conceptIds`, value.conceptIds, true);
    strings(`${label}.claimIds`, value.claimIds, false);
    objects(`${label}.options`, value.options);
  };

  objects('concepts', pack.concepts);
  objects('sources', pack.sources);
  objects('claims', pack.claims, (c, l) => objects(`${l}.sourceRefs`, c.sourceRefs));
  objects('cards', pack.cards, (c, l) => {
    strings(`${l}.conceptIds`, c.conceptIds, true);
    strings(`${l}.options`, c.options, true);
    strings(`${l}.claimIds`, c.claimIds, false);
  });
  objects('cases', pack.cases, (c, l) => {
    objects(`${l}.questions`, c.questions);
    objects(`${l}.decisions`, c.decisions, (d, dl) => decision(d, dl));
    if (c.followUp !== undefined) {
      if (!isObject(c.followUp)) {
        p.push(`${l}.followUp: nesne olmalı`);
      } else {
        if (!isObject(c.followUp.returns)) p.push(`${l}.followUp.returns: nesne olmalı`);
        decision(c.followUp.decision, `${l}.followUp.decision`);
      }
    }
  });
  return p;
}

// ---------------------------------------------------------------------------
// Katman 1: yapı ve referanslar (her durumda)
// ---------------------------------------------------------------------------

/**
 * İsteğe bağlı kaynak adresi geçerliyse true: metin, hiçbir yerinde boşluk yok, `//` ile başlayan
 * bir yetki kısmı var, `new URL()` ayrıştırabiliyor, protokol yalnızca `http:` veya `https:` ve
 * `hostname` boş değil. Ayrıştırma hatası istisna olarak sızmaz.
 */
export function validHttpUrl(v: unknown): boolean {
  if (typeof v !== 'string' || v === '' || /\s/.test(v)) return false;
  // WHATWG ayrıştırıcı "https:///yol" ve "https:\\x" gibi biçimleri düzeltir; burada kabul edilmez.
  if (!/^https?:\/\/[^/?#\\]/i.test(v)) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
  } catch {
    return false;
  }
}

function validateSource(s: Source): string[] {
  const label = `kaynak ${s.id}`;
  const p = unknownKeys(s, ALLOWED_KEYS.source, label);
  if (!filled(s.id)) p.push('kaynak: kimlik boş');
  if (!SOURCE_TYPES.includes(s.type)) p.push(`${label}: tür geçersiz`);
  if (!filled(s.title)) p.push(`${label}: başlık boş`);
  if (!filled(s.publisher)) p.push(`${label}: yayıncı boş`);
  if (s.url !== undefined && !validHttpUrl(s.url)) {
    p.push(`${label}: url metin ve geçerli bir HTTP(S) adresi olmalı`);
  }
  if (s.year !== undefined && !Number.isInteger(s.year)) p.push(`${label}: yıl tam sayı olmalı`);
  if (s.accessedAt !== undefined && !validDate(s.accessedAt)) {
    p.push(`${label}: erişim tarihi YYYY-AA-GG değil`);
  }
  return p;
}

function validateClaim(c: Claim, sourceIds: ReadonlySet<string>): string[] {
  const label = `iddia ${c.id}`;
  const p = unknownKeys(c, ALLOWED_KEYS.claim, label);
  if (!filled(c.id)) p.push('iddia: kimlik boş');
  if (!CLAIM_KINDS.includes(c.kind)) p.push(`${label}: tür geçersiz`);
  if (!filled(c.text)) p.push(`${label}: metin boş`);
  if (!EVIDENCE.includes(c.evidence)) p.push(`${label}: kanıt düzeyi geçersiz`);
  if (c.risk !== 'normal' && c.risk !== 'yuksek') p.push(`${label}: risk geçersiz`);
  else if (HIGH_RISK_KINDS.includes(c.kind) && c.risk !== 'yuksek') {
    p.push(`${label}: "${c.kind}" iddiası düşük riskli işaretlenemez`);
  }
  if (c.severity !== undefined && !SEVERITIES.includes(c.severity)) p.push(`${label}: şiddet geçersiz`);
  if (c.action !== undefined && !filled(c.action)) p.push(`${label}: eylem boş bırakılmış`);
  if (!AUTO_CHECKS.includes(c.autoCheck)) p.push(`${label}: otomatik denetim durumu geçersiz`);
  c.sourceRefs.forEach((r, i) => {
    p.push(...unknownKeys(r, ALLOWED_KEYS.sourceRef, `${label}, kaynak ${i + 1}`));
    if (!sourceIds.has(r.sourceId)) p.push(`${label}: bilinmeyen kaynak "${r.sourceId}"`);
    if (r.locator !== undefined && !filled(r.locator)) p.push(`${label}: konum boş bırakılmış`);
    if (r.quote !== undefined && !filled(r.quote)) p.push(`${label}: alıntı boş bırakılmış`);
  });
  p.push(...reviewShape(label, c.review));
  return p;
}

function itemMeta(label: string, item: Card | PatientCase | CaseFollowUp): string[] {
  const p: string[] = [];
  if (item.status === 'demo') p.push(`${label}: paketlerde "demo" durumu kullanılamaz`);
  if (item.contentVersion !== undefined && (!Number.isInteger(item.contentVersion) || item.contentVersion < 1)) {
    p.push(`${label}: contentVersion en az 1 olan tam sayı olmalı`);
  }
  p.push(...reviewShape(label, item.review));
  if (item.review !== undefined && item.status !== 'onaylı') {
    p.push(`${label}: onaylı olmayan içerikte review kaydı olamaz`);
  }
  return p;
}

function claimRefs(label: string, ids: string[] | undefined, claimIds: ReadonlySet<string>): string[] {
  return (ids ?? []).filter((id) => !claimIds.has(id)).map((id) => `${label}: bilinmeyen iddia "${id}"`);
}

function conceptRefs(label: string, ids: string[], conceptIds: ReadonlySet<string>): string[] {
  return ids.filter((id) => !conceptIds.has(id)).map((id) => `${label}: bilinmeyen kavram "${id}"`);
}

/** Paket öneki: küçük harfle başlayan 2-12 küçük harf/rakam. Tire içermez; böylece `<önek>-` ayrıştırması belirsiz olmaz. */
export const PACK_PREFIX_FORMAT = /^[a-z][a-z0-9]{1,11}$/;

/**
 * Öğrenme kimliği önek kuralı. Kart ve vaka kimlikleri (ilerleme anahtarlarının kaynağı: `<kart>`,
 * `case:<vaka>:<karar>`, `case:<vaka>:followup`) `<idPrefix>-` ile başlamalıdır. Paketler arası
 * benzersizlik `validateCrossPackIds` ile denetlenir.
 */
function prefixProblems(pack: ContentPack): string[] {
  const prefix: unknown = pack.idPrefix;
  if (typeof prefix !== 'string' || !PACK_PREFIX_FORMAT.test(prefix)) {
    return ['paket: idPrefix zorunlu ve ^[a-z][a-z0-9]{1,11}$ biçiminde olmalı'];
  }
  const want = `${prefix}-`;
  const p: string[] = [];
  for (const c of listOf<Card>(pack.cards)) {
    if (typeof c.id === 'string' && !c.id.startsWith(want)) p.push(`kart ${c.id}: kimlik "${want}" ile başlamalı`);
  }
  for (const c of listOf<PatientCase>(pack.cases)) {
    if (typeof c.id === 'string' && !c.id.startsWith(want)) p.push(`vaka ${c.id}: kimlik "${want}" ile başlamalı`);
  }
  return p;
}

function checkPack(pack: ContentPack): string[] {
  const p: string[] = unknownKeys(pack, ALLOWED_KEYS.pack, 'paket');
  if (pack.schemaVersion !== 1) p.push('paket: schemaVersion 1 olmalı');
  if (!filled(pack.id)) p.push('paket: kimlik boş');
  if (!filled(pack.topic)) p.push('paket: konu boş');
  p.push(...prefixProblems(pack));
  if (!filled(pack.title)) p.push('paket: başlık boş');

  const concepts = listOf<ContentPack['concepts'][number]>(pack.concepts);
  const sources = listOf<Source>(pack.sources);
  const claims = listOf<Claim>(pack.claims);
  const cards = listOf<Card>(pack.cards);
  const cases = listOf<PatientCase>(pack.cases);

  concepts.forEach((c) => {
    p.push(...unknownKeys(c, ALLOWED_KEYS.concept, `kavram ${c.id}`));
    if (!filled(c.id) || !filled(c.name)) p.push(`kavram ${c.id}: kimlik veya ad boş`);
  });
  for (const [name, list] of [
    ['kavram', concepts],
    ['kaynak', sources],
    ['iddia', claims],
    ['kart', cards],
    ['vaka', cases],
  ] as const) {
    for (const id of dupes(list.map((x) => x.id))) p.push(`${name} kimliği tekrar ediyor: "${id}"`);
  }
  // Kart kimlikleri ile vaka kararı kimlikleri (case:...) aynı ilerleme anahtar uzayını paylaşır.
  for (const c of cards) {
    if (typeof c.id === 'string' && c.id.startsWith('case:')) {
      p.push(`kart ${c.id}: "case:" öneki vaka kararları için ayrılmıştır`);
    }
  }

  // Aynı pakette farklı öğelerin AYNI ilerleme anahtarını üretmesi (örn. "followup" kararı).
  for (const id of learningIdCollisions({ cards, cases })) {
    p.push(`öğrenme kimliği çakışıyor: "${id}" birden fazla öğe için üretiliyor`);
  }

  const conceptIds = new Set(concepts.map((c) => c.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  const claimIds = new Set(claims.map((c) => c.id));

  sources.forEach((s) => p.push(...validateSource(s)));
  claims.forEach((c) => p.push(...validateClaim(c, sourceIds)));

  cards.forEach((card) => {
    const label = `kart ${card.id}`;
    p.push(...unknownKeys(card, ALLOWED_KEYS.card, label));
    p.push(...validateCard(card).map((m) => `${label}: ${m}`));
    p.push(...itemMeta(label, card));
    p.push(...claimRefs(label, card.claimIds, claimIds));
    p.push(...conceptRefs(label, card.conceptIds, conceptIds));
  });

  const checkDecision = (label: string, d: PatientCase['decisions'][number]): void => {
    p.push(...unknownKeys(d, ALLOWED_KEYS.decision, label));
    d.options.forEach((o, i) => p.push(...unknownKeys(o, ALLOWED_KEYS.option, `${label}, seçenek ${i + 1}`)));
    p.push(...claimRefs(label, d.claimIds, claimIds));
    p.push(...conceptRefs(label, d.conceptIds, conceptIds));
  };

  cases.forEach((c) => {
    const label = `vaka ${c.id}`;
    p.push(...unknownKeys(c, ALLOWED_KEYS.case, label));
    p.push(...validateCase(c).map((m) => `${label}: ${m}`));
    p.push(...itemMeta(label, c));
    c.questions.forEach((q) => p.push(...unknownKeys(q, ALLOWED_KEYS.question, `${label}, soru ${q.id}`)));
    for (const id of dupes(c.decisions.map((d) => d.id))) {
      p.push(`${label}: karar kimliği tekrar ediyor: "${id}"`);
    }
    c.decisions.forEach((d) => checkDecision(`${label}, karar ${d.id}`, d));
    if (c.followUp) {
      const fl = `geri dönüş (${c.id})`;
      p.push(...unknownKeys(c.followUp, ALLOWED_KEYS.followUp, fl));
      p.push(...unknownKeys(c.followUp.returns, ALLOWED_KEYS.returns, `${fl} anlatımları`));
      p.push(...itemMeta(fl, c.followUp));
      checkDecision(`${fl}, karar`, c.followUp.decision);
    }
  });
  return p;
}

/** Yapı + referans geçerliliği. Durumdan bağımsızdır; taslak içerik burada geçebilir. Asla istisna fırlatmaz. */
export function validatePack(pack: ContentPack): string[] {
  const shape = shapeProblems(pack);
  if (shape.length > 0) return shape;
  return safe('paket', () => checkPack(pack));
}

// ---------------------------------------------------------------------------
// Katman 2: yalnızca 'onaylı' öğeler için ek kurallar
// ---------------------------------------------------------------------------

function reviewMatches(label: string, review: Review | undefined, expected: string): string[] {
  if (!review) return [`${label}: onaylı ama insan onay kaydı (review) yok`];
  const p: string[] = [];
  if (!filled(review.by)) p.push(`${label}: review.by boş`);
  if (!validDate(review.on)) p.push(`${label}: review.on YYYY-AA-GG değil`);
  if (review.contentHash !== expected) {
    p.push(`${label}: onaydan sonra içerik değişmiş (özet eşleşmiyor); yeniden onay gerekir`);
  }
  return p;
}

/**
 * Bir iddianın "onaylı bir öğeye dayanak olabilme" koşulları. Otomatik denetim ('kaynak-eslesti')
 * ile insan onayı (`review`) İKİSİ de gerekir ve birbirinin yerine geçmez. İddia onayı, dayandığı
 * kaynak kayıtlarına da bağlıdır (bkz. claimHash).
 */
function claimApprovalProblems(c: Claim, ctx: HashContext): string[] {
  const label = `iddia ${c.id}`;
  const p = reviewMatches(`${label} (eczacı onayı)`, c.review, claimHash(c, ctx));
  if (c.autoCheck !== 'kaynak-eslesti') {
    p.push(`${label}: otomatik kaynak denetimi tamamlanmamış (autoCheck: ${c.autoCheck})`);
  }
  const refs = listOf<Claim['sourceRefs'][number]>(c.sourceRefs);
  if (refs.length === 0) p.push(`${label}: kaynak yok`);
  refs.forEach((r) => {
    if (!filled(r.locator)) p.push(`${label}: kaynak "${r.sourceId}" için konum (bölüm/tablo) yok`);
    if (!validDate(ctx.sources.get(r.sourceId)?.accessedAt)) {
      p.push(`${label}: kaynak "${r.sourceId}" için erişim tarihi yok`);
    }
  });
  for (const [what, text] of [
    ['metin', c.text],
    ['eylem', c.action],
    ...refs.flatMap((r) => [['alıntı', r.quote] as const, ['konum', r.locator] as const]),
  ] as const) {
    if (hasPlaceholder(text)) p.push(`${label}: ${what} yer tutucu içeriyor`);
  }
  if (c.risk === 'yuksek') {
    if (!PRIMARY_EVIDENCE.includes(c.evidence)) {
      p.push(`${label}: yüksek riskli iddia için kanıt düzeyi etiket veya kılavuz olmalı`);
    }
    const primaryQuoted = refs.some(
      (r) => filled(r.quote) && PRIMARY_SOURCE_TYPES.includes(ctx.sources.get(r.sourceId)?.type as SourceType),
    );
    if (!primaryQuoted) {
      p.push(`${label}: yüksek riskli iddia, alıntılı bir birincil kaynağa (etiket, kılavuz, monograf) dayanmalı`);
    }
  }
  if (c.kind === 'etkilesim') {
    if (!c.severity) p.push(`${label}: etkileşimde şiddet derecesi zorunlu`);
    if (!filled(c.action)) p.push(`${label}: etkileşimde ne yapılacağı (eylem) zorunlu`);
  }
  return p;
}

function approvedItemProblems(
  label: string,
  item: Card | PatientCase | CaseFollowUp,
  claimIdLists: string[][],
  ctx: HashContext,
  checked: Set<string>,
  caseCtx?: CaseContext,
): string[] {
  const p = reviewMatches(label, item.review, contentHash(item, ctx, caseCtx));
  if (item.review && item.reviewedAt !== item.review.on) {
    p.push(`${label}: reviewedAt (${item.reviewedAt}) onay tarihiyle (${item.review.on}) aynı olmalı`);
  }
  if (!Number.isInteger(item.contentVersion) || (item.contentVersion as number) < 1) {
    p.push(`${label}: onaylı içerikte contentVersion (≥1) zorunlu`);
  }
  if (claimIdLists.some((ids) => ids.length === 0)) {
    p.push(`${label}: onaylı içerik, her karar/kart için en az bir bilimsel iddiaya bağlı olmalı`);
  }
  if (textsOf(item).some(hasPlaceholder)) p.push(`${label}: yer tutucu metin içeriyor`);
  for (const id of claimIdsOf(item)) {
    const claim = ctx.claims.get(id);
    if (!claim || checked.has(id)) continue;
    checked.add(id);
    p.push(...claimApprovalProblems(claim, ctx));
  }
  return p;
}

function checkApprovals(pack: ContentPack): string[] {
  const ctx = hashContext(pack);
  const checked = new Set<string>();
  const p: string[] = [];
  for (const card of listOf<Card>(pack.cards)) {
    if (card.status !== 'onaylı') continue;
    const label = `kart ${card.id}`;
    p.push(...approvedItemProblems(label, card, [card.claimIds ?? []], ctx, checked));
    if (!filled(card.explanation)) p.push(`${label}: onaylı kartta açıklama boş olamaz`);
  }
  for (const c of listOf<PatientCase>(pack.cases)) {
    if (c.status === 'onaylı') {
      p.push(
        ...approvedItemProblems(
          `vaka ${c.id}`,
          c,
          c.decisions.map((d) => d.claimIds ?? []),
          ctx,
          checked,
        ),
      );
    }
    if (c.followUp && c.followUp.status === 'onaylı') {
      p.push(
        ...approvedItemProblems(
          `geri dönüş (${c.id})`,
          c.followUp,
          [c.followUp.decision.claimIds ?? []],
          ctx,
          checked,
          caseContextOf(c), // ana vakanın sunumu, bütçesi ve soruları geri dönüş onayına dahildir
        ),
      );
    }
  }
  return p;
}

/**
 * Yalnızca durumu 'onaylı' olan kart, vaka ve geri dönüşler için ek kurallar. Taslaklara dokunmaz.
 * Şekil bozuksa istisna fırlatmaz, şekil hatalarını döndürür.
 */
export function validateApprovals(pack: ContentPack): string[] {
  const shape = shapeProblems(pack);
  if (shape.length > 0) return shape;
  return safe('onay denetimi', () => checkApprovals(pack));
}

// ---------------------------------------------------------------------------
// Katman 3: model/Gemini çıktısı
// ---------------------------------------------------------------------------

/**
 * Model çıktısı yalnızca taslak olabilir. Onay belirtisi içeren her çıktı GEÇERSİZDİR (sessizce
 * temizlenmez): 'onaylı' durum, herhangi bir `review`, 'beklemede' dışı `autoCheck`, bilinmeyen alan.
 * İnsan onayı bu fonksiyondan geçen içeriğe sonradan, insan eliyle eklenir. Asla istisna fırlatmaz.
 */
export function validateDraftPack(pack: ContentPack): string[] {
  const base = validatePack(pack);
  if (shapeProblems(pack).length > 0) return base;
  return safe('model çıktısı', () => {
    const p = [...base];
    const forbid = (label: string, item: { status?: string; review?: unknown }): void => {
      if (item.status !== 'taslak') {
        p.push(`${label}: model çıktısı yalnızca "taslak" olabilir (durum: ${item.status})`);
      }
      if (item.review !== undefined) p.push(`${label}: model çıktısında review kaydı olamaz`);
    };
    pack.cards.forEach((c) => forbid(`kart ${c.id}`, c));
    pack.cases.forEach((c) => {
      forbid(`vaka ${c.id}`, c);
      if (c.followUp) forbid(`geri dönüş (${c.id})`, c.followUp);
    });
    pack.claims.forEach((c) => {
      if (c.review !== undefined) p.push(`iddia ${c.id}: model çıktısında review kaydı olamaz`);
      if (c.autoCheck !== 'beklemede') {
        p.push(`iddia ${c.id}: model çıktısında autoCheck "beklemede" olmalı (şu an: ${c.autoCheck})`);
      }
    });
    return p;
  });
}

// ---------------------------------------------------------------------------
// Uyarılar (engellemez)
// ---------------------------------------------------------------------------

const ABSOLUTE = /(^|[^\p{L}])(asla|kesinlikle|her zaman|hiçbir zaman)([^\p{L}]|$)/iu;

/** Engelleyici olmayan öneriler: tek kaynaklı yüksek risk, mutlak dil, kullanılmayan iddia/kavram. */
export function packWarnings(pack: ContentPack): string[] {
  if (shapeProblems(pack).length > 0) return [];
  try {
    const w: string[] = [];
    for (const c of pack.claims) {
      if (c.risk === 'yuksek' && new Set(c.sourceRefs.map((r) => r.sourceId)).size < 2) {
        w.push(`iddia ${c.id}: yüksek riskli iddiada ikinci bağımsız kaynak önerilir`);
      }
      if (ABSOLUTE.test(`${c.text} ${c.action ?? ''}`)) {
        w.push(`iddia ${c.id}: mutlak ifade ("asla", "kesinlikle"...) var; şiddet derecesi ve eylemle anlatın`);
      }
    }
    for (const card of pack.cards) {
      if (ABSOLUTE.test(card.explanation ?? '')) {
        w.push(`kart ${card.id}: açıklamada mutlak ifade var; şiddet derecesi ve eylemle anlatın`);
      }
    }

    const usedClaims = new Set<string>([
      ...pack.cards.flatMap((c) => c.claimIds ?? []),
      ...pack.cases.flatMap((c) => [...claimIdsOf(c), ...(c.followUp ? claimIdsOf(c.followUp) : [])]),
    ]);
    for (const c of pack.claims) {
      if (!usedClaims.has(c.id)) w.push(`iddia ${c.id}: hiçbir kart veya karar kullanmıyor`);
    }

    const usedConcepts = new Set<string>([
      ...pack.cards.flatMap((c) => c.conceptIds),
      ...pack.cases.flatMap((c) => [
        ...c.decisions.flatMap((d) => d.conceptIds),
        ...(c.followUp?.decision.conceptIds ?? []),
      ]),
    ]);
    for (const k of pack.concepts) {
      if (!usedConcepts.has(k.id)) w.push(`kavram ${k.id}: hiçbir kart veya karar bu kavramı sınamıyor`);
    }
    return w;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Öğrenme kimliği kilidi (ilerleme geçmişinin yanlış yorumlanmasını önler)
// ---------------------------------------------------------------------------

/**
 * Yayımlanmış (onaylı) öğelerin ilerleme kimliği → coreHash kaydı.
 *
 * Kurallar:
 * - Onaylı her kart, vaka kararı ve geri dönüşün girdisi kilitte BULUNMALI (eksiksizlik).
 * - Girdi, içeriğin güncel çekirdek özetiyle EŞLEŞMELİ (çekirdek değiştiyse yeni kimlik).
 * - Girdiler yalnızca EKLENİR: emekli edilen kimlik içerikten kalksa bile kilitte kalır, böylece
 *   aynı kimlik başka içerikle yeniden kullanılamaz (bkz. compareLocks).
 */
export interface ReleaseLock {
  lockVersion: 1;
  items: Record<string, string>;
}

export function validateReleaseLock(raw: unknown): string[] {
  if (!isObject(raw)) return ['kilit dosyası bir nesne olmalı'];
  const p = unknownKeys(raw, ['lockVersion', 'items'], 'kilit');
  if (raw.lockVersion !== 1) p.push('kilit: lockVersion 1 olmalı');
  if (!isObject(raw.items)) return [...p, 'kilit: items bir nesne olmalı'];
  for (const [id, hash] of Object.entries(raw.items)) {
    if (typeof hash !== 'string' || !HASH_FORMAT.test(hash)) {
      p.push(`kilit: "${id}" için özet biçimi geçersiz (h1: + 16 küçük harfli onaltılık hane olmalı)`);
    }
  }
  return p;
}

const CORE_CHANGED = (id: string): string =>
  `kimlik "${id}": doğru cevap, bağlam veya bilimsel çekirdek değişmiş; yeni kimlik verin (eski kimlik emekli olur, ilerleme geçmişi yanlış yorumlanmasın)`;

/**
 * Kilitli bir kimliğin çekirdeği değiştiyse hata verir: aynı kimlik, başka bir bilgiyi veya
 * kavramı ölçmeye başlar ve cihazdaki eski FSRS durumu yanlış yorumlanır. İçerikte artık olmayan
 * (emekli) kimlikler sorun değildir.
 */
export function checkCoreStability(current: Record<string, string>, lock: ReleaseLock): string[] {
  const p: string[] = [];
  for (const [id, locked] of Object.entries(lock.items)) {
    if (hasOwn(current, id) && current[id] !== locked) p.push(CORE_CHANGED(id));
  }
  return p;
}

/**
 * Yayın kapısı için kilit denetimi: eksiksizlik + kararlılık.
 * Kilitte olmayan her onaylı kimlik reddedilir; boş kilit onaylı içeriği yayına çıkaramaz.
 */
export function checkReleaseLock(current: Record<string, string>, lock: ReleaseLock): string[] {
  const missing = Object.keys(current)
    .filter((id) => !hasOwn(lock.items, id))
    .map(
      (id) =>
        `kimlik "${id}": onaylı içerik kilitte yok; release-lock.json'a eklenmeden yayınlanamaz (eksik veya boş kilit kabul edilmez)`,
    );
  return [...missing, ...checkCoreStability(current, lock)];
}

/**
 * Önceki kilit ile yeni kilidi karşılaştırır: yalnızca EKLEME serbesttir. Önceki kilitteki bir
 * kayıt silinmişse veya özeti değişmişse hata verir (emekli kimlik kilitte kalmalıdır).
 *
 * CI'da çalışması (kurulu: .github/workflows/release-lock.yml): her pull request'te hedef dalın
 * kilidi (`git show origin/<base>:app/src/content/release-lock.json`; dalda kilit yoksa boş kilit)
 * önceki, çalışma ağacındaki dosya yeni kilit olarak `compareLockFiles` ile karşılaştırılır
 * (bkz. __tests__/release-lock-ci.test.ts); dönen liste boş değilse iş başarısız olur. Böylece bir değişiklikle hem içerik
 * hem kilit kaydı birlikte silinerek koruma atlatılamaz. Tek başına depo içindeki dosyalar bunu
 * sağlayamaz, çünkü "önceki" durum yalnızca git geçmişinde vardır.
 */
export function compareLocks(previous: ReleaseLock, next: ReleaseLock): string[] {
  const p = [
    ...validateReleaseLock(previous).map((m) => `önceki ${m}`),
    ...validateReleaseLock(next).map((m) => `yeni ${m}`),
  ];
  if (p.length > 0) return p;
  for (const [id, hash] of Object.entries(previous.items)) {
    if (!hasOwn(next.items, id)) {
      p.push(`kilit kaydı silinmiş: "${id}" (emekli kimlikler kilitte kalmalıdır)`);
    } else if (next.items[id] !== hash) {
      p.push(`kilit kaydı değiştirilmiş: "${id}" (yayımlanmış çekirdek özeti değiştirilemez; yeni kimlik verin)`);
    }
  }
  return p;
}

/**
 * CI girdisi: kilit dosyalarının ham metinlerini karşılaştırır. `previousText` hedef daldaki
 * (main) dosyadır; dalda dosya yoksa `null` verilir ve boş kilit sayılır. `nextText` değişiklikteki
 * dosyadır; `null` (dosya silinmiş) ve bozuk JSON hata sayılır. Asla istisna fırlatmaz.
 */
export function compareLockFiles(previousText: string | null, nextText: string | null): string[] {
  const empty: ReleaseLock = { lockVersion: 1, items: {} };
  const parse = (text: string): { ok: true; value: ReleaseLock } | { ok: false } => {
    try {
      return { ok: true, value: JSON.parse(text) as ReleaseLock };
    } catch {
      return { ok: false };
    }
  };
  if (nextText === null) return ['yeni kilit dosyası yok (release-lock.json silinemez)'];
  const next = parse(nextText);
  if (!next.ok) return ['yeni kilit dosyası geçerli JSON değil'];
  if (previousText === null) return compareLocks(empty, next.value);
  const prev = parse(previousText);
  if (!prev.ok) return ['önceki kilit dosyası geçerli JSON değil'];
  return compareLocks(prev.value, next.value);
}

// ---------------------------------------------------------------------------
// Paketler arası öğrenme kimliği
// ---------------------------------------------------------------------------

/**
 * Bir paketin tüm öğrenme (ilerleme) kimlikleri: kart kimlikleri, `case:<vaka>:<karar>` ve
 * `case:<vaka>:followup`. Duruma bakmaz (taslak dahil). Yalnızca şekli geçerli paketler için.
 */
export function learningIdsOf(pack: ContentPack): string[] {
  return learningIdList(pack);
}

/**
 * Paketler arasında çakışma denetimi (yalnızca doğrulama katmanı; `Progress` ve runtime'a dokunmaz).
 * İlerleme `Progress.cards` içinde düz kimlikle tutulduğundan iki paket aynı kimliği kullanırsa
 * ilerlemeleri birbirine karışır. Denetlenenler: tekrar eden paket kimliği, tekrar eden `idPrefix`,
 * paketler arasında tekrar eden öğrenme kimliği ve `reservedIds` (uygulamadaki mevcut içeriğin
 * kimlikleri) ile çakışma. Şekli veya anlamı geçersiz paket (`validatePack` sorun döndürüyorsa)
 * çakışma denetimine alınmaz; açıkça "geçersiz paket" olarak raporlanır, kalan paketler denetlenir.
 */
export function validateCrossPackIds(packs: readonly ContentPack[], reservedIds: readonly string[] = []): string[] {
  return safe('paketler arası denetim', () => {
    const p: string[] = [];
    if (!Array.isArray(packs)) return ['paket listesi liste olmalı'];
    const reserved = new Set(reservedIds);
    const byId = new Map<string, string[]>();
    const byPrefix = new Map<string, string[]>();
    const byLearningId = new Map<string, string[]>();
    const add = (m: Map<string, string[]>, k: string, who: string): void => {
      m.set(k, [...(m.get(k) ?? []), who]);
    };
    packs.forEach((pack, i) => {
      const who = isObject(pack) && typeof pack.id === 'string' && pack.id !== '' ? pack.id : `paket[${i}]`;
      // Şekil VE anlam geçerli olmayan paketin kimlikleri güvenle hesaplanamaz: açıkça raporla, atla.
      const invalid = validatePack(pack);
      if (invalid.length > 0) {
        p.push(`${who}: geçersiz paket, çapraz kimlik denetimine alınmadı (${invalid.length} sorun; ilk sorun: ${invalid[0]})`);
        return;
      }
      add(byId, pack.id, who);
      add(byPrefix, pack.idPrefix, who);
      for (const id of new Set(learningIdsOf(pack))) {
        add(byLearningId, id, who);
        if (reserved.has(id)) p.push(`${who}: öğrenme kimliği "${id}" uygulamadaki mevcut içerikle çakışıyor`);
      }
    });
    for (const [k, who] of byId) if (who.length > 1) p.push(`paket kimliği tekrar ediyor: "${k}"`);
    for (const [k, who] of byPrefix) {
      if (who.length > 1) p.push(`idPrefix "${k}" birden fazla pakette kullanılıyor: ${who.join(', ')}`);
    }
    for (const [k, who] of byLearningId) {
      if (who.length > 1) p.push(`öğrenme kimliği "${k}" birden fazla pakette kullanılıyor: ${who.join(', ')}`);
    }
    return p;
  });
}

// ---------------------------------------------------------------------------
// Yayın kapısı
// ---------------------------------------------------------------------------

/**
 * Repoya girmiş paketin yayına hazırlığı: yapı + onay kuralları + KİLİT (zorunlu).
 * Onaylı öğesi olan paket, kilit eksik veya boşsa geçemez. Taslaktan ibaret paketin kilide
 * ihtiyacı yoktur. Hatalı şekilde istisna fırlatmaz.
 */
export function validatePackForRelease(pack: ContentPack, lock: ReleaseLock): string[] {
  const base = validatePack(pack);
  if (shapeProblems(pack).length > 0) return base;
  // Kimlik çakışması varsa kilit hesabı anlamsızdır (aynı anahtar iki içeriğe işaret eder): dur.
  if (learningIdCollisions(pack).length > 0) return base;
  return safe('yayın denetimi', () => {
    const p = [...base, ...validateApprovals(pack)];
    const lockProblems = validateReleaseLock(lock);
    if (lockProblems.length > 0) return [...p, ...lockProblems];
    return [...p, ...checkReleaseLock(coreEntries(pack), lock)];
  });
}
