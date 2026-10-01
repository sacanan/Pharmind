import type { Card, CaseDecision, ContentStatus, PatientCase } from './types';

const STATUSES: ContentStatus[] = ['taslak', 'onaylı', 'demo'];
const RATINGS = ['uygun', 'kabul', 'uygunDegil'];
const TIERS = ['iyi', 'karisik', 'zayif'] as const;

/** Seçenek harfleri A–F; daha fazlası ekranda harfsiz kalır. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

const filled = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;

function validDate(s: unknown): boolean {
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
  return problems;
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
  return problems;
}

/** Vakayı (varsa geri dönüşüyle birlikte) yapısal olarak doğrular. */
export function validateCase(c: PatientCase): string[] {
  const problems = validateCommon(c);
  if (!filled(c.id)) problems.push('kimlik boş');
  if (!filled(c.title)) problems.push('başlık boş');
  if (!filled(c.presentation)) problems.push('hasta sunumu boş');
  if (!filled(c.outcome)) problems.push('kapanış metni boş');

  const questions = Array.isArray(c.questions) ? c.questions : [];
  if (questions.length === 0) problems.push('en az bir soru olmalı');
  if (new Set(questions.map((q) => q.id)).size !== questions.length) {
    problems.push('soru kimlikleri tekrar ediyor');
  }
  questions.forEach((q) => {
    if (!filled(q.ask) || !filled(q.reply)) problems.push(`soru ${q.id}: soru veya cevap boş`);
  });
  if (!Number.isInteger(c.questionBudget) || c.questionBudget < 1) {
    problems.push('soru bütçesi en az 1 olmalı');
  } else if (c.questionBudget > questions.length) {
    problems.push('soru bütçesi soru sayısından büyük');
  }

  const decisions = Array.isArray(c.decisions) ? c.decisions : [];
  if (decisions.length === 0) problems.push('en az bir karar noktası olmalı');
  decisions.forEach((d, i) => problems.push(...validateDecision(d, `karar ${i + 1}`)));

  if (c.followUp) {
    for (const tier of TIERS) {
      if (!filled(c.followUp.returns?.[tier])) problems.push(`geri dönüş: "${tier}" anlatımı boş`);
    }
    problems.push(...validateDecision(c.followUp.decision, 'geri dönüş kararı'));
  }
  return problems;
}
