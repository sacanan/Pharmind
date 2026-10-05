import { demoCase } from '../../content/demo-case';
import {
  applyCase,
  applyFollowUp,
  askQuestion,
  caseDoneToday,
  caseTier,
  cellForRating,
  choose,
  decisionCardId,
  decisionCards,
  emptyRun,
  followUpCardId,
  isFinished,
  pendingFollowUp,
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
    // 3 vaka kararı + 1 geri dönüş kararı (en sonda)
    expect(dcards).toHaveLength(4);
    expect(dcards[0].id).toBe(decisionCardId(c.id, 'd1'));
    expect(dcards[2].conceptIds).toEqual(['demo-a', 'demo-c']);
    expect(dcards[3].id).toBe(followUpCardId(c.id));
    // doğru indeks "uygun" seçenektir
    expect(dcards.slice(0, 3).map((d) => d.correctIndex)).toEqual(BEST);
  });

  it('girdiyi değiştirmez, sonucu kaydeder, günlük hedefe ve geçmişe dokunmaz', () => {
    const before = emptyProgress();
    const run = play(BEST, ['q1', 'q2']);
    const after = applyCase(before, c, run, NOW);
    expect(before.caseResults).toEqual({});
    expect(after.caseResults[c.id]).toMatchObject({ askedIds: ['q1', 'q2'], choices: BEST });
    expect(after.history).toEqual([]);
    expect(after.completedDays).toEqual([]);
    // geri dönüş kararı hasta dönene kadar işlenmez
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

  it('hepsi oynandıysa ve hastalar cevaplandıysa en eski oynananı tekrar verir', () => {
    let p = applyCase(emptyProgress(), c, play(BEST), NOW);
    p = applyCase(p, other, play(BEST), new Date(NOW.getTime() + DAY));
    p = applyFollowUp(p, c, 1, new Date(NOW.getTime() + 2 * DAY));
    p = applyFollowUp(p, other, 1, new Date(NOW.getTime() + 2 * DAY));
    const later = new Date(NOW.getTime() + 3 * DAY);
    expect(pickTodaysCase(cases, p, later)).toEqual({ case: c, done: false });
  });
});

describe('bekleyen hasta varken vaka tekrarı', () => {
  const other: PatientCase = { ...c, id: 'demo-vaka-2', title: 'İkinci' };
  const NEXT = new Date(NOW.getTime() + DAY);
  const played = (cases: PatientCase[]) =>
    cases.reduce((p, k, i) => applyCase(p, k, play(BEST), new Date(NOW.getTime() + i * 1000)), emptyProgress());

  it('tek vaka ve hastası bekliyorsa tekrar sunulmaz, hasta döner', () => {
    const p = played([c]);
    expect(pickTodaysCase([c], p, NEXT)).toBeNull();
    expect(pendingFollowUp([c], p, NEXT)?.case.id).toBe(c.id);
  });

  it('hasta cevaplandıktan sonra vaka yeniden sunulabilir', () => {
    const p = applyFollowUp(played([c]), c, 1, NEXT);
    expect(pickTodaysCase([c], p, new Date(NEXT.getTime() + DAY))).toEqual({ case: c, done: false });
  });

  it('başka oynanmamış vaka varsa o sunulur', () => {
    const p = played([c]);
    expect(pickTodaysCase([c, other], p, NEXT)).toEqual({ case: other, done: false });
  });

  it('tekrar adayları arasından hastası bekleyen vaka çıkarılır', () => {
    // İki vaka da oynandı; yalnızca ikincinin hastası döndü ve cevaplandı
    let p = played([c, other]);
    p = applyFollowUp(p, other, 1, NEXT);
    // c'nin hastası hâlâ bekliyor -> tekrar adayı yalnızca other
    expect(pickTodaysCase([c, other], p, NEXT)).toEqual({ case: other, done: false });
  });

  it('geri dönüş içeriği olmayan vaka bekleyen sayılmaz, tekrar sunulabilir', () => {
    const noFollow: PatientCase = { ...c, id: 'x', followUp: undefined };
    const p = applyCase(emptyProgress(), noFollow, play(BEST), NOW);
    expect(pickTodaysCase([noFollow], p, NEXT)).toEqual({ case: noFollow, done: false });
  });

  it('aynı gün tamamlanan vaka done olarak kalır (bekleyen sayılmaz)', () => {
    const p = played([c]);
    expect(pickTodaysCase([c], p, new Date(NOW.getTime() + 60_000))).toEqual({ case: c, done: true });
  });
});

describe('hasta geri geldi', () => {
  const NEXT = new Date(NOW.getTime() + DAY);
  const done = (choices: number[], at: Date = NOW) => applyCase(emptyProgress(), c, play(choices), at);

  it('kararların ortalamasına göre varyant belirlenir (uygun 2, kabul 1, uygun değil 0)', () => {
    // demo dereceleri: d1 [uygun, kabul, değil], d2 [kabul, değil, uygun], d3 [değil, uygun, kabul]
    expect(caseTier(c, play(BEST))).toBe('iyi'); // 2+2+2 = ort. 2
    expect(caseTier(c, play([0, 2, 2]))).toBe('iyi'); // 2+2+1 = ort. 1,67
    expect(caseTier(c, play([1, 0, 2]))).toBe('karisik'); // 1+1+1 = ort. 1
    expect(caseTier(c, play([0, 0, 2]))).toBe('karisik'); // 2+1+1 = ort. 1,33
    expect(caseTier(c, play([0, 1, 0]))).toBe('zayif'); // 2+0+0 = ort. 0,67
    expect(caseTier(c, play(WORST))).toBe('zayif'); // 0+0+0
  });

  it('sınırlar: 1,5 iyi, 0,75 karışık', () => {
    // İki kararlı bir vaka ile sınır değerleri: [uygun, kabul] = 1,5 ; [kabul, değil] = 0,5
    const two: PatientCase = { ...c, decisions: c.decisions.slice(0, 2) };
    // d1: uygun(0) ve d2: kabul(0) -> 1,5
    expect(caseTier(two, { askedIds: [], choices: [0, 0] })).toBe('iyi');
    // d1: kabul(1) ve d2: değil(1) -> 0,5
    expect(caseTier(two, { askedIds: [], choices: [1, 1] })).toBe('zayif');
    // hiç karar yoksa zayıf
    expect(caseTier(c, emptyRun())).toBe('zayif');
  });

  it('hasta aynı gün dönmez, ertesi gün döner', () => {
    const p = done(BEST);
    expect(pendingFollowUp([c], p, new Date(NOW.getTime() + 1000))).toBeNull();
    expect(pendingFollowUp([c], p, NEXT)?.case.id).toBe(c.id);
  });

  it('kaçırılırsa kaybolmaz', () => {
    const p = done(BEST);
    expect(pendingFollowUp([c], p, new Date(NOW.getTime() + 9 * DAY))?.case.id).toBe(c.id);
  });

  it('dönüş varyantı vaka kararlarının kalitesini yansıtır', () => {
    expect(pendingFollowUp([c], done(BEST), NEXT)?.tier).toBe('iyi');
    expect(pendingFollowUp([c], done(WORST), NEXT)?.tier).toBe('zayif');
  });

  it('geri dönüş içeriği olmayan vaka için hasta dönmez', () => {
    const noFollow: PatientCase = { ...c, id: 'x', followUp: undefined };
    const p = applyCase(emptyProgress(), noFollow, play(BEST), NOW);
    expect(pendingFollowUp([noFollow], p, NEXT)).toBeNull();
  });

  it('cevaplandıktan sonra bekleyen hasta kalmaz, kayıt tutulur, geçmişe ve hedefe dokunmaz', () => {
    const p = done(BEST);
    const after = applyFollowUp(p, c, 1, NEXT);
    expect(after.caseResults[c.id].followUp).toEqual({ choice: 1, at: NEXT.toISOString() });
    expect(pendingFollowUp([c], after, new Date(NEXT.getTime() + DAY))).toBeNull();
    expect(after.history).toEqual([]);
    expect(after.completedDays).toEqual([]);
    expect(after.cards[followUpCardId(c.id)]).toBeDefined();
    // vakanın kendi kaydı bozulmaz
    expect(after.caseResults[c.id].at).toBe(NOW.toISOString());
    expect(after.caseResults[c.id].choices).toEqual(BEST);
  });

  it('iki kez cevaplanamaz, oynanmamış vaka ve geçersiz seçim yok sayılır', () => {
    const once = applyFollowUp(done(BEST), c, 1, NEXT);
    expect(applyFollowUp(once, c, 0, NEXT)).toBe(once);
    const fresh = emptyProgress();
    expect(applyFollowUp(fresh, c, 1, NEXT)).toBe(fresh);
    const p = done(BEST);
    expect(applyFollowUp(p, c, 9, NEXT)).toBe(p);
  });

  it('geri dönüş kararı kavram mastery\'sine yansır', () => {
    const dcards = decisionCards([c]);
    const m = (p: ReturnType<typeof done>) => conceptMastery('demo-b', dcards, p, NEXT);
    const base = done(BEST);
    const good = applyFollowUp(base, c, 1, NEXT); // uygun
    const bad = applyFollowUp(base, c, 2, NEXT); // uygunDegil
    expect(m(good)).toBeGreaterThan(m(bad));
  });

  it('vaka tekrar oynanırsa eski geri dönüş cevabı silinir ve hasta yine döner', () => {
    const first = applyFollowUp(done(BEST), c, 1, NEXT);
    const later = new Date(NOW.getTime() + 5 * DAY);
    const replay = applyCase(first, c, play(WORST), later);
    expect(replay.caseResults[c.id].followUp).toBeUndefined();
    expect(pendingFollowUp([c], replay, new Date(later.getTime() + DAY))?.tier).toBe('zayif');
  });

  it('geri dönüş cevabı kaydedilip geri okunur', () => {
    const p = applyFollowUp(done(BEST), c, 1, NEXT);
    const back = deserializeProgress(serializeProgress(p));
    expect(back.caseResults[c.id].followUp).toEqual(p.caseResults[c.id].followUp);
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
