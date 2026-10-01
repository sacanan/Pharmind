import { demoCase } from '../../content/demo-case';
import {
  applyCase,
  askQuestion,
  caseDoneToday,
  cellForRating,
  choose,
  decisionCardId,
  decisionCards,
  emptyRun,
  isFinished,
  pickTodaysCase,
  questionsLeft,
  summarizeCase,
} from '../case';
import { conceptMastery } from '../mastery';
import { emptyProgress } from '../scheduling';
import { deserializeProgress, serializeProgress } from '../storage';
import type { PatientCase } from '../types';

const NOW = new Date('2026-10-01T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const c = demoCase;

/** d1: A uygun, d2: C uygun, d3: B uygun (demo vakanın dizilimi) */
const BEST = [0, 2, 1];
/** d1: C uygunDegil, d2: B uygunDegil, d3: A uygunDegil */
const WORST = [2, 1, 0];

function play(choices: number[], asked: string[] = []) {
  let run = emptyRun();
  for (const q of asked) run = askQuestion(c, run, q);
  for (const ch of choices) run = choose(c, run, ch);
  return run;
}

describe('soru bütçesi', () => {
  it('bütçe kadar soru sorulur, fazlası yok sayılır', () => {
    let run = emptyRun();
    for (const q of ['q1', 'q2', 'q3', 'q4']) run = askQuestion(c, run, q);
    expect(run.askedIds).toEqual(['q1', 'q2', 'q3']);
    expect(questionsLeft(c, run)).toBe(0);
  });

  it('aynı soru iki kez sorulamaz ve bilinmeyen soru yok sayılır', () => {
    let run = askQuestion(c, emptyRun(), 'q1');
    run = askQuestion(c, run, 'q1');
    run = askQuestion(c, run, 'yok');
    expect(run.askedIds).toEqual(['q1']);
    expect(questionsLeft(c, run)).toBe(2);
  });

  it('girdiyi değiştirmez', () => {
    const before = emptyRun();
    askQuestion(c, before, 'q1');
    expect(before.askedIds).toEqual([]);
  });
});

describe('karar noktaları', () => {
  it('sırayla ilerler ve bitince tamamlanır', () => {
    let run = emptyRun();
    expect(isFinished(c, run)).toBe(false);
    run = choose(c, run, 0);
    run = choose(c, run, 0);
    expect(isFinished(c, run)).toBe(false);
    run = choose(c, run, 0);
    expect(isFinished(c, run)).toBe(true);
    // bitmiş vakada yeni seçim yok sayılır
    expect(choose(c, run, 1)).toBe(run);
  });

  it('geçersiz seçeneği yok sayar', () => {
    const run = emptyRun();
    expect(choose(c, run, 9)).toBe(run);
    expect(choose(c, run, -1)).toBe(run);
  });

  it('derecelendirme blister gözüne çevrilir', () => {
    expect(cellForRating('uygun')).toBe('correct');
    expect(cellForRating('kabul')).toBe('shaky');
    expect(cellForRating('uygunDegil')).toBe('wrong');
  });
});

describe('summarizeCase', () => {
  it('kritik bilgiyi sorma, atlama ve gereksiz soruyu ayırır', () => {
    const run = play(BEST, ['q1', 'q3', 'q4']);
    const s = summarizeCase(c, run);
    expect(s.criticalTotal).toBe(2);
    expect(s.criticalAsked).toBe(1);
    expect(s.missedCritical.map((q) => q.id)).toEqual(['q2']);
    expect(s.unnecessaryAsked).toBe(2);
    expect(s.counts).toEqual({ uygun: 3, kabul: 0, uygunDegil: 0 });
  });

  it('karar sayımı seçimlere göre değişir', () => {
    const s = summarizeCase(c, play([1, 0, 2]));
    expect(s.counts).toEqual({ uygun: 0, kabul: 3, uygunDegil: 0 });
  });
});

describe('applyCase ve mastery', () => {
  const dcards = decisionCards([c]);

  it('karar noktaları kart gibi kavramlara bağlanır', () => {
    expect(dcards).toHaveLength(3);
    expect(dcards[0].id).toBe(decisionCardId(c.id, 'd1'));
    expect(dcards[2].conceptIds).toEqual(['demo-a', 'demo-c']);
    // doğru indeks "uygun" seçenektir
    expect(dcards.map((d) => d.correctIndex)).toEqual(BEST);
  });

  it('girdiyi değiştirmez, sonucu kaydeder, günlük hedefe ve geçmişe dokunmaz', () => {
    const before = emptyProgress();
    const run = play(BEST, ['q1', 'q2']);
    const after = applyCase(before, c, run, NOW);
    expect(before.caseResults).toEqual({});
    expect(after.caseResults[c.id]).toMatchObject({ askedIds: ['q1', 'q2'], choices: BEST });
    expect(after.history).toEqual([]);
    expect(after.completedDays).toEqual([]);
    expect(Object.keys(after.cards)).toHaveLength(3);
  });

  it('iyi kararlar kötü kararlardan yüksek mastery verir', () => {
    const good = applyCase(emptyProgress(), c, play(BEST), NOW);
    const bad = applyCase(emptyProgress(), c, play(WORST), NOW);
    const m = (p: typeof good) => conceptMastery('demo-b', dcards, p, NOW);
    expect(m(good)).toBeGreaterThan(m(bad));
    expect(m(bad)).toBeLessThan(0.02);
  });

  it('kavramı yalnızca ilgili kararlar etkiler', () => {
    const p = applyCase(emptyProgress(), c, play(BEST), NOW);
    // demo-c sadece d3'e bağlı; demo-b sadece d2'ye
    expect(conceptMastery('demo-c', dcards, p, NOW)).toBeGreaterThan(0);
    const onlyD2 = applyCase(emptyProgress(), c, { askedIds: [], choices: [0, 2] }, NOW);
    expect(conceptMastery('demo-c', dcards, onlyD2, NOW)).toBe(0);
  });
});

describe('günün vakası', () => {
  const other: PatientCase = { ...c, id: 'demo-vaka-2', title: 'İkinci' };
  const cases = [c, other];

  it('vaka yoksa null', () => {
    expect(pickTodaysCase([], emptyProgress(), NOW)).toBeNull();
  });

  it('oynanmamış ilk vakayı seçer', () => {
    expect(pickTodaysCase(cases, emptyProgress(), NOW)).toEqual({ case: c, done: false });
  });

  it('bugün tamamlanan vaka done olarak döner', () => {
    const p = applyCase(emptyProgress(), c, play(BEST), NOW);
    expect(caseDoneToday(cases, p, NOW)?.id).toBe(c.id);
    expect(pickTodaysCase(cases, p, new Date(NOW.getTime() + 1000))).toEqual({ case: c, done: true });
  });

  it('ertesi gün oynanmamış vakaya geçer', () => {
    const p = applyCase(emptyProgress(), c, play(BEST), NOW);
    const tomorrow = new Date(NOW.getTime() + DAY);
    expect(pickTodaysCase(cases, p, tomorrow)).toEqual({ case: other, done: false });
  });

  it('hepsi oynandıysa en eski oynananı tekrar verir', () => {
    let p = applyCase(emptyProgress(), c, play(BEST), NOW);
    p = applyCase(p, other, play(BEST), new Date(NOW.getTime() + DAY));
    const later = new Date(NOW.getTime() + 3 * DAY);
    expect(pickTodaysCase(cases, p, later)).toEqual({ case: c, done: false });
  });
});

describe('depolama', () => {
  it('vaka sonuçları kaydedilip geri okunur', () => {
    const p = applyCase(emptyProgress(), c, play(BEST, ['q1']), NOW);
    const back = deserializeProgress(serializeProgress(p));
    expect(back.caseResults[c.id]).toEqual(p.caseResults[c.id]);
    expect(back.cards[decisionCardId(c.id, 'd1')].due).toBeInstanceOf(Date);
  });

  it('vaka alanı olmayan eski kayıt boş sonuçla açılır', () => {
    const old = JSON.stringify({ version: 1, cards: {}, history: [], completedDays: ['2026-09-30'] });
    const p = deserializeProgress(old);
    expect(p.caseResults).toEqual({});
    expect(p.completedDays).toEqual(['2026-09-30']);
  });
});
