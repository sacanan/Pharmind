import type { Confidence, PolicyGrade, ReviewRecord, SelfReport } from './types';

const CONFIDENCES: readonly string[] = ['sure', 'unsure', 'guess'];
const SELF_REPORTS: readonly string[] = ['guess', 'none'];
const GRADES: readonly string[] = ['Again', 'Hard', 'Good'];

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isIso = (x: unknown): x is string => typeof x === 'string' && !Number.isNaN(Date.parse(x));

/**
 * Depodan okunan tek bir geçmiş kaydını doğrular. Geçerliyse AYNI nesneyi döndürür (eski kayıtlara alan
 * eklenmez, değer değiştirilmez); geçersizse null. Kayıt türü açıkça ayrılır:
 * - `recordVersion` yok: V1, güven bildirimi zorunlu.
 * - `recordVersion === 2`: V2 (selfReport, optionCount, politika sürümü ve derece).
 * Tanınmayan bir `recordVersion` (örn. gelecekteki 3) null döner; bilinmeyen kayıt tahminle yorumlanmaz.
 */
export function parseRecord(x: unknown): ReviewRecord | null {
  if (!isObject(x)) return null;
  if (typeof x.cardId !== 'string' || typeof x.correct !== 'boolean' || !isIso(x.at)) return null;
  if (x.recordVersion === undefined) {
    return typeof x.confidence === 'string' && CONFIDENCES.includes(x.confidence)
      ? (x as unknown as ReviewRecord)
      : null;
  }
  if (x.recordVersion !== 2) return null;
  const policy = x.policy;
  if (
    typeof x.selfReport !== 'string' ||
    !SELF_REPORTS.includes(x.selfReport) ||
    typeof x.optionCount !== 'number' ||
    !Number.isInteger(x.optionCount) ||
    x.optionCount < 0 ||
    !isObject(policy) ||
    typeof policy.version !== 'string' ||
    typeof policy.grade !== 'string' ||
    !GRADES.includes(policy.grade)
  ) {
    return null;
  }
  return x as unknown as ReviewRecord;
}

/** Cevap görünümü: blister ve özetler için, her iki kayıt türünü (ve oturum içi cevapları) kapsar. */
export type AnswerLike = { correct: boolean } & (
  | { recordVersion?: undefined; confidence: Confidence; selfReport?: undefined }
  | { recordVersion?: 2; selfReport: SelfReport; confidence?: undefined; optionCount?: number; policy?: { version: string; grade: PolicyGrade } }
);

/**
 * "Kararsız doğru" mu? V2'de YALNIZCA kullanıcı "Tahmin ettim" dediyse (`none` emin ya da kararsız sayılmaz).
 * V1'de eski anlam korunur: doğru ama güveni `sure` olmayan.
 */
export function isShakyRight(a: AnswerLike): boolean {
  if (!a.correct) return false;
  if (a.selfReport !== undefined) return a.selfReport === 'guess';
  return a.confidence !== 'sure';
}

/** "Emin olduğu halde yanlış": YALNIZCA eski (V1) güven bildirimlerinden hesaplanabilir. */
export function isLegacyConfidentError(a: AnswerLike): boolean {
  return !a.correct && a.selfReport === undefined && a.confidence === 'sure';
}
