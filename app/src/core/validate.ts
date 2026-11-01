import type { Card, CaseDecision, CaseFollowUp, ContentStatus, PatientCase } from './types';

const STATUSES: ContentStatus[] = ['taslak', 'onaylı', 'demo'];
const RATINGS = ['uygun', 'kabul', 'uygunDegil'];
const TIERS = ['iyi', 'karisik', 'zayif'] as const;

/** Seçenek harfleri A–F; daha fazlası ekranda harfsiz kalır. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export const filled = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;

export function validDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Her içerikte zorunlu alanlar (CLAUDE.md içerik kuralları): kaynak, gözden geçirme tarihi, durum. */
function validateCommon(item: { source: string; reviewedAt: string; status: string }): string[] {
  const problems: string[] = [];
  if (!filled(item.source)) problems.push('kaynak boş');
  if (!validDate(item.reviewedAt)) problems.push('gözden geçirme tarihi YYYY-AA-GG değil');
  if (!STATUSES.includes(item.status as ContentStatus)) problems.push('durum geçersiz');
  return problems;
}

/** Kartı yapısal olarak doğrular; sorunları Türkçe cümleler olarak döndürür (boş liste = geçerli). */
export function validateCard(card: Card): string[] {
  const problems = validateCommon(card);
  if (!filled(card.id)) problems.push('kimlik boş');
  if (!filled(card.prompt)) problems.push('soru metni boş');
  // Taslakta açıklama boş olabilir (onaylıda zorunlu), ama metin olmak zorundadır.
  if (typeof card.explanation !== 'string') problems.push('açıklama metin olmalı');
  if (!Array.isArray(card.conceptIds) || card.conceptIds.length === 0) {
    problems.push('en az bir kavrama bağlı olmalı');
  }
  if (
    !Array.isArray(card.options) ||
    card.options.length < MIN_OPTIONS ||
    card.options.length > MAX_OPTIONS ||
    !card.options.every(filled)
  ) {
    problems.push(`${MIN_OPTIONS}–${MAX_OPTIONS} dolu seçenek olmalı`);
  } else if (
    !Number.isInteger(card.correctIndex) ||
    card.correctIndex < 0 ||
    card.correctIndex >= card.options.length
  ) {
    problems.push('doğru cevap indeksi seçenekler dışında');
  }
  // Aynı metinli iki seçenekte "doğru olan hangisi" belirsizdir; correctIndex kayması fark edilmez.
  if (Array.isArray(card.options) && card.options.every((o) => typeof o === 'string')) {
    if (hasDuplicateText(card.options)) problems.push('seçenek metinleri tekrar ediyor');
  }
  return problems;
}

/** Boşluk ve büyük/küçük harf farkı yok sayılarak tekrar eden metin var mı. */
function hasDuplicateText(texts: string[]): boolean {
  const norm = texts.map((t) => t.trim().toLowerCase());
  return new Set(norm).size !== norm.length;
}

function validateDecision(d: CaseDecision, label: string): string[] {
  const problems: string[] = [];
  if (!filled(d.prompt)) problems.push(`${label}: soru metni boş`);
  if (!Array.isArray(d.conceptIds) || d.conceptIds.length === 0) {
    problems.push(`${label}: en az bir kavrama bağlı olmalı`);
  }
  if (!Array.isArray(d.options) || d.options.length < MIN_OPTIONS || d.options.length > MAX_OPTIONS) {
    problems.push(`${label}: ${MIN_OPTIONS}–${MAX_OPTIONS} seçenek olmalı`);
    return problems;
  }
  d.options.forEach((o, i) => {
    if (!filled(o.text)) problems.push(`${label}, seçenek ${i + 1}: metin boş`);
    if (!RATINGS.includes(o.rating)) problems.push(`${label}, seçenek ${i + 1}: derece geçersiz`);
    if (!filled(o.rationale)) problems.push(`${label}, seçenek ${i + 1}: gerekçe boş`);
    if (!filled(o.consequence)) problems.push(`${label}, seçenek ${i + 1}: sonuç notu boş`);
  });
  if (!d.options.some((o) => o.rating === 'uygun')) {
    problems.push(`${label}: "uygun" dereceli bir seçenek yok`);
  }
  if (d.options.every((o) => typeof o.text === 'string') && hasDuplicateText(d.options.map((o) => o.text))) {
    problems.push(`${label}: seçenek metinleri tekrar ediyor`);
  }
  return problems;
}

/**
 * Vaka, soru ve karar kimlikleri için güvenli biçim: harf/rakamla başlar, harf, rakam, `_` ve `-`
 * içerir. `:` yasaktır; çünkü ilerleme anahtarları `case:<vaka>:<karar>` biçiminde türetilir ve
 * ayraç içeren kimlikler farklı öğeler için aynı anahtarı üretebilir.
 */
export const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Geri dönüş için ilerleme anahtarında ayrılmış karar kimliği (`case:<vaka>:followup`). */
export const RESERVED_DECISION_ID = 'followup';

function idProblems(kind: string, id: unknown): string[] {
  if (typeof id !== 'string' || id.trim() === '') return [`${kind} kimliği boş veya metin değil`];
  if (!SAFE_ID.test(id)) {
    return [`${kind} kimliği "${id}" geçersiz (harf/rakamla başlamalı; yalnızca harf, rakam, "_" ve "-"; ":" yasak)`];
  }
  return [];
}

/** Vakayı (varsa geri dönüşüyle birlikte) yapısal olarak doğrular. */
export function validateCase(c: PatientCase): string[] {
  const problems = validateCommon(c);
  if (!filled(c.id)) problems.push('kimlik boş');
  else problems.push(...idProblems('vaka', c.id));
  if (!filled(c.title)) problems.push('başlık boş');
  if (!filled(c.presentation)) problems.push('hasta sunumu boş');
  if (!filled(c.outcome)) problems.push('kapanış metni boş');

  const questions = Array.isArray(c.questions) ? c.questions : [];
  if (questions.length === 0) problems.push('en az bir soru olmalı');
  if (new Set(questions.map((q) => q.id)).size !== questions.length) {
    problems.push('soru kimlikleri tekrar ediyor');
  }
  questions.forEach((q) => {
    problems.push(...idProblems('soru', q.id));
    if (!filled(q.ask) || !filled(q.reply)) problems.push(`soru ${q.id}: soru veya cevap boş`);
    if (typeof q.critical !== 'boolean') problems.push(`soru ${q.id}: critical yalnızca true veya false olabilir`);
  });
  if (!Number.isInteger(c.questionBudget) || c.questionBudget < 1) {
    problems.push('soru bütçesi en az 1 olmalı');
  } else if (c.questionBudget > questions.length) {
    problems.push('soru bütçesi soru sayısından büyük');
  } else if (questions.filter((q) => q.critical).length > c.questionBudget) {
    // Oyuncu tüm kritik soruları soramaz; güvenli karar vermesi imkânsız bir vaka olur.
    problems.push('kritik soru sayısı soru bütçesini aşıyor');
  }

  const decisions = Array.isArray(c.decisions) ? c.decisions : [];
  if (decisions.length === 0) problems.push('en az bir karar noktası olmalı');
  decisions.forEach((d, i) => {
    problems.push(...validateDecision(d, `karar ${i + 1}`));
    problems.push(...idProblems(`karar ${i + 1}`, d.id));
    if (d.id === RESERVED_DECISION_ID) {
      problems.push(`karar ${i + 1}: "${RESERVED_DECISION_ID}" kimliği geri dönüş için ayrılmıştır`);
    }
  });

  if (c.followUp) problems.push(...validateFollowUp(c.followUp));
  return problems;
}

/** Geri dönüşü (kendi kaynak, tarih ve durumuyla birlikte) yapısal olarak doğrular. */
export function validateFollowUp(f: CaseFollowUp): string[] {
  const problems = validateCommon(f).map((p) => `geri dönüş: ${p}`);
  for (const tier of TIERS) {
    if (!filled(f.returns?.[tier])) problems.push(`geri dönüş: "${tier}" anlatımı boş`);
  }
  problems.push(...validateDecision(f.decision, 'geri dönüş kararı'));
  problems.push(...idProblems('geri dönüş kararı', f.decision?.id));
  return problems;
}
