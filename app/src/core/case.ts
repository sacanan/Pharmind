import { reviewCard } from './scheduling';
import type {
  Card,
  CaseDecision,
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

/**
 * Vakanın karar noktaları, kavram mastery'sine katılan "kart"lardır. Günlük 5 seçimine girmezler;
 * yalnızca masteryMap'e verilen kart listesine eklenir.
 */
export function decisionCards(cases: PatientCase[]): Card[] {
  return cases.flatMap((c) =>
    c.decisions.map((d) => ({
      id: decisionCardId(c.id, d.id),
      conceptIds: d.conceptIds,
      prompt: d.prompt,
      options: d.options.map((o) => o.text),
      correctIndex: Math.max(
        0,
        d.options.findIndex((o) => o.rating === 'uygun'),
      ),
      explanation: '',
      source: c.source,
      reviewedAt: c.reviewedAt,
      status: c.status,
    })),
  );
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
  const cards = decisionCards([c]);
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

/**
 * Günün vakası: bugün zaten biri tamamlandıysa o; yoksa henüz oynanmamış ilk vaka;
 * hepsi oynandıysa en eski oynanan (içerik yetmediğinde tekrar). Vaka yoksa null.
 */
export function pickTodaysCase(
  cases: PatientCase[],
  progress: Progress,
  now: Date,
): { case: PatientCase; done: boolean } | null {
  if (cases.length === 0) return null;
  const done = caseDoneToday(cases, progress, now);
  if (done) return { case: done, done: true };
  const fresh = cases.find((c) => !progress.caseResults[c.id]);
  if (fresh) return { case: fresh, done: false };
  const oldest = [...cases].sort((a, b) =>
    progress.caseResults[a.id].at.localeCompare(progress.caseResults[b.id].at),
  )[0];
  return { case: oldest, done: false };
}
