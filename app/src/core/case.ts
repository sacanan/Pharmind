import { reviewCard } from './scheduling';
import type {
  Card,
  CaseDecision,
  CaseTier,
  ContentStatus,
  CaseOption,
  CaseQuestion,
  CaseRun,
  DecisionRating,
  PatientCase,
  Progress,
} from './types';
import { dayKey } from './weekly';
import type { CellState } from './session';

export const DEFAULT_QUESTION_BUDGET = 3;

export function emptyRun(): CaseRun {
  return { askedIds: [], choices: [] };
}

export function questionsLeft(c: PatientCase, run: CaseRun): number {
  return Math.max(0, c.questionBudget - run.askedIds.length);
}

/** Bütçe bitmediyse ve bu soru daha önce sorulmadıysa yeni bir soru sorar. Girdiyi değiştirmez. */
export function askQuestion(c: PatientCase, run: CaseRun, questionId: string): CaseRun {
  if (questionsLeft(c, run) === 0) return run;
  if (run.askedIds.includes(questionId)) return run;
  if (!c.questions.some((q) => q.id === questionId)) return run;
  return { ...run, askedIds: [...run.askedIds, questionId] };
}

/** Sıradaki karar noktasında bir seçenek seçer. Geçersiz seçimde girdiyi döndürür. */
export function choose(c: PatientCase, run: CaseRun, optionIndex: number): CaseRun {
  const decision = c.decisions[run.choices.length];
  if (!decision || optionIndex < 0 || optionIndex >= decision.options.length) return run;
  return { ...run, choices: [...run.choices, optionIndex] };
}

export function isFinished(c: PatientCase, run: CaseRun): boolean {
  return run.choices.length >= c.decisions.length;
}

export function cellForRating(rating: DecisionRating): CellState {
  if (rating === 'uygun') return 'correct';
  return rating === 'kabul' ? 'shaky' : 'wrong';
}

export interface CaseSummary {
  /** Sorulan sorular, sorulma sırasıyla */
  asked: CaseQuestion[];
  criticalTotal: number;
  criticalAsked: number;
  /** Sorulmayan kritik sorular (cevaplarıyla birlikte gösterilir) */
  missedCritical: CaseQuestion[];
  /** Kritik olmayan, bütçeyi harcayan sorular */
  unnecessaryAsked: number;
  decisions: { decision: CaseDecision; option: CaseOption }[];
  counts: Record<DecisionRating, number>;
}

export function summarizeCase(c: PatientCase, run: CaseRun): CaseSummary {
  const asked = run.askedIds
    .map((id) => c.questions.find((q) => q.id === id))
    .filter((q): q is CaseQuestion => !!q);
  const critical = c.questions.filter((q) => q.critical);
  const decisions = run.choices.flatMap((choice, i) => {
    const decision = c.decisions[i];
    const option = decision?.options[choice];
    return decision && option ? [{ decision, option }] : [];
  });
  const counts: Record<DecisionRating, number> = { uygun: 0, kabul: 0, uygunDegil: 0 };
  for (const d of decisions) counts[d.option.rating] += 1;
  return {
    asked,
    criticalTotal: critical.length,
    criticalAsked: asked.filter((q) => q.critical).length,
    missedCritical: critical.filter((q) => !run.askedIds.includes(q.id)),
    unnecessaryAsked: asked.filter((q) => !q.critical).length,
    decisions,
    counts,
  };
}

/** Bir karar noktasını mastery hesabında kart gibi sayabilmek için. */
export function decisionCardId(caseId: string, decisionId: string): string {
  return `case:${caseId}:${decisionId}`;
}

function toCard(
  meta: { source: string; reviewedAt: string; status: ContentStatus },
  id: string,
  d: CaseDecision,
): Card {
  return {
    id,
    conceptIds: d.conceptIds,
    prompt: d.prompt,
    options: d.options.map((o) => o.text),
    correctIndex: Math.max(
      0,
      d.options.findIndex((o) => o.rating === 'uygun'),
    ),
    explanation: '',
    source: meta.source,
    reviewedAt: meta.reviewedAt,
    status: meta.status,
  };
}

/** "Hasta geri geldi" kararının kart kimliği. */
export function followUpCardId(caseId: string): string {
  return `case:${caseId}:followup`;
}

/**
 * Vakanın karar noktaları (ve varsa geri dönüş kararı), kavram mastery'sine katılan "kart"lardır.
 * Günlük 5 seçimine girmezler; yalnızca masteryMap'e verilen kart listesine eklenir.
 * Sıra: önce vaka kararları, en sonda geri dönüş kararı.
 */
export function decisionCards(cases: PatientCase[]): Card[] {
  return cases.flatMap((c) => [
    ...c.decisions.map((d) => toCard(c, decisionCardId(c.id, d.id), d)),
    ...(c.followUp ? [toCard(c.followUp, followUpCardId(c.id), c.followUp.decision)] : []),
  ]);
}

/**
 * Vakayı tamamlar: her karar noktasının kalitesi o karar "kartı"nın FSRS durumunu günceller
 * (uygun → Good, kabul → Hard, uygun değil → Again) ve oynanış kaydedilir.
 * Vaka günlük oturum hedefine (completedDays) sayılmaz.
 */
export function applyCase(
  progress: Progress,
  c: PatientCase,
  run: CaseRun,
  now: Date,
): Progress {
  const cards = decisionCards([c]); // ilk c.decisions.length tanesi vaka kararlarıdır
  let next = progress;
  run.choices.forEach((choice, i) => {
    const card = cards[i];
    const option = c.decisions[i]?.options[choice];
    if (!card || !option) return;
    const rating = option.rating;
    next = reviewCard(next, card, rating !== 'uygunDegil', rating === 'uygun' ? 'sure' : 'unsure', now);
  });
  return {
    ...next,
    // Karar kayıtları, ana ekrandaki günlük 5'lik blister geçmişine karışmasın.
    history: progress.history,
    caseResults: { ...progress.caseResults, [c.id]: { ...run, at: now.toISOString() } },
  };
}

/** Bugün tamamlanan vaka varsa onu döndürür. */
export function caseDoneToday(
  cases: PatientCase[],
  progress: Progress,
  now: Date,
): PatientCase | null {
  const today = dayKey(now);
  return (
    cases.find((c) => {
      const r = progress.caseResults[c.id];
      return !!r && dayKey(new Date(r.at)) === today;
    }) ?? null
  );
}

/** Vakanın geri dönüşü bekliyor mu: içerik var, vaka oynanmış, cevaplanmamış, vakadan sonra bir gün geçmiş. */
function hasPendingFollowUp(c: PatientCase, progress: Progress, now: Date): boolean {
  const r = progress.caseResults[c.id];
  return !!c.followUp && !!r && !r.followUp && dayKey(new Date(r.at)) < dayKey(now);
}

/**
 * Günün vakası: bugün zaten biri tamamlandıysa o; yoksa henüz oynanmamış ilk vaka;
 * hepsi oynandıysa en eski oynanan (içerik yetmediğinde tekrar). Vaka yoksa null.
 *
 * Hastası geri dönmeyi bekleyen vaka tekrar sunulmaz: önce hasta geri döner ve cevaplanır,
 * böylece hasta ötelenmez ve kararlar iki kez işlenmez. Başka sunulacak vaka yoksa null döner.
 */
export function pickTodaysCase(
  cases: PatientCase[],
  progress: Progress,
  now: Date,
): { case: PatientCase; done: boolean } | null {
  if (cases.length === 0) return null;
  const done = caseDoneToday(cases, progress, now);
  if (done) return { case: done, done: true };
  const offerable = cases.filter((c) => !hasPendingFollowUp(c, progress, now));
  const fresh = offerable.find((c) => !progress.caseResults[c.id]);
  if (fresh) return { case: fresh, done: false };
  const oldest = [...offerable].sort((a, b) =>
    progress.caseResults[a.id].at.localeCompare(progress.caseResults[b.id].at),
  )[0];
  return oldest ? { case: oldest, done: false } : null;
}

const TIER_SCORE: Record<DecisionRating, number> = { uygun: 2, kabul: 1, uygunDegil: 0 };

/**
 * Kararların genel kalitesi: ortalama puan (uygun 2, kabul 1, uygun değil 0).
 * 1,5 ve üzeri iyi, 0,75 ve üzeri karışık, altı zayıf.
 */
export function caseTier(c: PatientCase, run: CaseRun): CaseTier {
  const scores = summarizeCase(c, run).decisions.map((d) => TIER_SCORE[d.option.rating]);
  if (scores.length === 0) return 'zayif';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 1.5) return 'iyi';
  return avg >= 0.75 ? 'karisik' : 'zayif';
}

/**
 * Geri dönmeye hazır hasta: vaka tamamlanmış, geri dönüş içeriği var, henüz cevaplanmamış
 * ve vakadan sonra en az bir gün geçmiş. Hasta kaçırılırsa kaybolmaz; en eski bekleyen önce gelir.
 */
export function pendingFollowUp(
  cases: PatientCase[],
  progress: Progress,
  now: Date,
): { case: PatientCase; tier: CaseTier } | null {
  const waiting = cases
    .filter((c) => hasPendingFollowUp(c, progress, now))
    .sort((a, b) => progress.caseResults[a.id].at.localeCompare(progress.caseResults[b.id].at));
  const c = waiting[0];
  if (!c) return null;
  return { case: c, tier: caseTier(c, progress.caseResults[c.id]) };
}

/**
 * Geri dönüş kararını işler: karar kalitesi ilgili kavramların FSRS durumunu günceller ve
 * cevap kaydedilir. Zaten cevaplanmışsa, vaka oynanmamışsa veya seçim geçersizse girdiyi döndürür.
 */
export function applyFollowUp(
  progress: Progress,
  c: PatientCase,
  choice: number,
  now: Date,
): Progress {
  const result = progress.caseResults[c.id];
  const option = c.followUp?.decision.options[choice];
  if (!c.followUp || !result || result.followUp || !option) return progress;
  const card = toCard(c.followUp, followUpCardId(c.id), c.followUp.decision);
  const rating = option.rating;
  const reviewed = reviewCard(
    progress,
    card,
    rating !== 'uygunDegil',
    rating === 'uygun' ? 'sure' : 'unsure',
    now,
  );
  return {
    ...reviewed,
    history: progress.history,
    caseResults: {
      ...progress.caseResults,
      [c.id]: { ...result, followUp: { choice, at: now.toISOString() } },
    },
  };
}
