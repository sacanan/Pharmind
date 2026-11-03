import {
  answerChoice,
  cellOf,
  currentActivity,
  feedbackTitle,
  isMatchDone,
  isRunDone,
  matchOutcome,
  pickItem,
  recordOutcome,
  runCells,
  startMatch,
  startRun,
  summarizeRun,
  type MatchState,
} from '../engine';
import { LAB_ACTIVITIES } from '../lab-content';
import { seededOrder } from '../shuffle';
import type { LabChoice, LabMatch, Outcome } from '../types';

const tf = LAB_ACTIVITIES[0] as LabChoice;
const cloze = LAB_ACTIVITIES[1] as LabChoice;
const match = LAB_ACTIVITIES[3] as LabMatch;

/** Sağ sütunda, verilen çiftin bulunduğu yuva. */
const slotOf = (s: MatchState, pair: number): number => s.order.indexOf(pair);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('seededOrder', () => {
  it('her n ve tohum için eksiksiz bir permütasyondur', () => {
    for (let n = 0; n <= 8; n++) {
      for (let seed = 0; seed < 40; seed++) {
        expect([...seededOrder(n, seed)].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it('n ≥ 2 için asla özdeşlik değildir (sütunlar aynı sırada durmaz)', () => {
    for (let n = 2; n <= 6; n++) {
      for (let seed = 0; seed < 200; seed++) {
        expect(seededOrder(n, seed)).not.toEqual(Array.from({ length: n }, (_, i) => i));
      }
    }
  });

  it('aynı tohum aynı sırayı verir; farklı tohumlar farklı sıralar üretebilir', () => {
    expect(seededOrder(5, 7)).toEqual(seededOrder(5, 7));
    const variants = new Set(Array.from({ length: 30 }, (_, s) => seededOrder(5, s).join(',')));
    expect(variants.size).toBeGreaterThan(5);
  });
});

describe('answerChoice', () => {
  it('doğru ve yanlış seçimi ayırt eder', () => {
    expect(answerChoice(tf, 1, false)).toEqual({ correct: true, mistakes: 0, flaggedGuess: false });
    expect(answerChoice(tf, 0, false)).toEqual({ correct: false, mistakes: 0, flaggedGuess: false });
  });

  it('"tahmin ettim" yalnızca işaretlendiyse true olur; işaretlenmemesi "emin" anlamına gelmez', () => {
    expect(answerChoice(cloze, 0, true)?.flaggedGuess).toBe(true);
    const unflagged = answerChoice(cloze, 0, false) as Outcome;
    expect(unflagged.flaggedGuess).toBe(false);
    // Sonuç yapısında "emin" diye bir alan yoktur.
    expect(Object.keys(unflagged).sort()).toEqual(['correct', 'flaggedGuess', 'mistakes']);
  });

  it.each([-1, 2, 99, 1.5, Number.NaN, Infinity])('geçersiz seçim (%s) null döndürür', (bad) => {
    expect(answerChoice(tf, bad, false)).toBeNull();
  });
});

describe('eşleştirme', () => {
  const start = (seed = 1) => startMatch(match, seed);

  it('başlangıç durumu: hiçbiri eşleşmemiş, seçim yok, hata 0', () => {
    const s = start();
    expect(s.matched).toEqual([false, false, false]);
    expect(s.picked).toBeNull();
    expect(s.mistakes).toBe(0);
    expect(isMatchDone(s)).toBe(false);
    expect(matchOutcome(s)).toBeNull();
  });

  it('soldan sağa doğru eşleştirme kilitlenir', () => {
    let s = start();
    s = pickItem(s, 'left', 1);
    expect(s.picked).toEqual({ side: 'left', index: 1 });
    s = pickItem(s, 'right', slotOf(s, 1));
    expect(s.matched).toEqual([false, true, false]);
    expect(s.picked).toBeNull();
    expect(s.mistakes).toBe(0);
  });

  it('sağdan sola sıra da çalışır', () => {
    let s = start();
    s = pickItem(s, 'right', slotOf(s, 2));
    s = pickItem(s, 'left', 2);
    expect(s.matched[2]).toBe(true);
  });

  it('yanlış eşleştirme hatayı artırır, seçimi temizler ve uyarıyı işaretler', () => {
    let s = start();
    s = pickItem(s, 'left', 0);
    const wrongSlot = slotOf(s, 1);
    s = pickItem(s, 'right', wrongSlot);
    expect(s.mistakes).toBe(1);
    expect(s.picked).toBeNull();
    expect(s.matched).toEqual([false, false, false]);
    expect(s.lastWrong).toEqual({ left: 0, slot: wrongSlot });
    // Sonraki dokunuş uyarıyı siler.
    s = pickItem(s, 'left', 2);
    expect(s.lastWrong).toBeNull();
  });

  it('aynı sütunda ikinci dokunuş seçimi değiştirir; aynı öğeye tekrar dokunmak kaldırır', () => {
    let s = start();
    s = pickItem(s, 'left', 0);
    s = pickItem(s, 'left', 2);
    expect(s.picked).toEqual({ side: 'left', index: 2 });
    expect(s.mistakes).toBe(0);
    s = pickItem(s, 'left', 2);
    expect(s.picked).toBeNull();
  });

  it('eşleşmiş veya geçersiz öğeye dokunmak hiçbir şeyi değiştirmez', () => {
    let s = start();
    s = pickItem(s, 'left', 0);
    s = pickItem(s, 'right', slotOf(s, 0));
    expect(pickItem(s, 'left', 0)).toBe(s);
    expect(pickItem(s, 'right', slotOf(s, 0))).toBe(s);
    for (const [side, index] of [['left', -1], ['left', 3], ['right', 7], ['left', 1.5]] as const) {
      expect(pickItem(s, side, index)).toBe(s);
    }
  });

  it('hatasız tamamlama "doğru"dur', () => {
    let s = start(3);
    for (let pair = 0; pair < 3; pair++) {
      s = pickItem(s, 'left', pair);
      s = pickItem(s, 'right', slotOf(s, pair));
    }
    expect(isMatchDone(s)).toBe(true);
    expect(matchOutcome(s)).toEqual({ correct: true, mistakes: 0, flaggedGuess: false });
  });

  it('hatalı tamamlama tamamlanır ama "doğru" sayılmaz; hata sayısı korunur', () => {
    let s = start(3);
    s = pickItem(s, 'left', 0);
    s = pickItem(s, 'right', slotOf(s, 2)); // hata 1
    s = pickItem(s, 'left', 0);
    s = pickItem(s, 'right', slotOf(s, 1)); // hata 2
    for (let pair = 0; pair < 3; pair++) {
      s = pickItem(s, 'left', pair);
      s = pickItem(s, 'right', slotOf(s, pair));
    }
    expect(matchOutcome(s)).toEqual({ correct: false, mistakes: 2, flaggedGuess: false });
  });

  it('girdiyi değiştirmez (donmuş durumla çalışır)', () => {
    const s = deepFreeze(start());
    expect(() => {
      const a = pickItem(s, 'left', 0);
      pickItem(a, 'right', slotOf(a, 0));
    }).not.toThrow();
  });
});

describe('tur (run)', () => {
  const acts = LAB_ACTIVITIES;
  const good: Outcome = { correct: true, mistakes: 0, flaggedGuess: false };

  it('sonuçlar sırayla eklenir; başka etkinliğin sonucu veya çift dokunuş yok sayılır', () => {
    let run = startRun();
    expect(currentActivity(acts, run)?.id).toBe('lab-mg-1');
    expect(recordOutcome(acts, run, 'lab-mg-3', good)).toBe(run);
    run = recordOutcome(acts, run, 'lab-mg-1', good);
    expect(run.entries).toHaveLength(1);
    // Aynı etkinliği ikinci kez kaydetmek (çift dokunuş) sayılmaz.
    expect(recordOutcome(acts, run, 'lab-mg-1', good)).toBe(run);
    expect(currentActivity(acts, run)?.id).toBe('lab-mg-2');
  });

  it('tur bittikten sonra yeni kayıt kabul edilmez', () => {
    let run = startRun();
    for (const a of acts) run = recordOutcome(acts, run, a.id, good);
    expect(isRunDone(acts, run)).toBe(true);
    expect(currentActivity(acts, run)).toBeNull();
    expect(recordOutcome(acts, run, 'lab-mg-5', good)).toBe(run);
    expect(run.entries).toHaveLength(5);
  });

  it('hücre durumları: doğru, tahminli doğru, yanlış, hatalı eşleştirme', () => {
    expect(cellOf(good)).toBe('correct');
    expect(cellOf({ ...good, flaggedGuess: true })).toBe('shaky');
    expect(cellOf({ correct: false, mistakes: 0, flaggedGuess: false })).toBe('wrong');
    expect(cellOf({ correct: false, mistakes: 2, flaggedGuess: false })).toBe('shaky');
  });

  it('blister: cevaplananlar dolu, sıradaki işaretli, kalanlar boş', () => {
    let run = startRun();
    expect(runCells(acts, run)).toEqual(['current', 'pending', 'pending', 'pending', 'pending']);
    run = recordOutcome(acts, run, 'lab-mg-1', good);
    run = recordOutcome(acts, run, 'lab-mg-2', { correct: false, mistakes: 0, flaggedGuess: false });
    expect(runCells(acts, run)).toEqual(['correct', 'wrong', 'current', 'pending', 'pending']);
    for (const a of acts.slice(2)) run = recordOutcome(acts, run, a.id, good);
    expect(runCells(acts, run)).toEqual(['correct', 'wrong', 'correct', 'correct', 'correct']);
  });

  it('geri bildirim başlıkları', () => {
    expect(feedbackTitle(tf, good)).toBe('Doğru');
    expect(feedbackTitle(tf, { ...good, correct: false })).toBe('Yanlış');
    expect(feedbackTitle(match, good)).toBe('Hepsi eşleşti');
    expect(feedbackTitle(match, { correct: false, mistakes: 1, flaggedGuess: false })).toBe('Eşleşti, 1 hata');
    expect(feedbackTitle(match, { correct: false, mistakes: 3, flaggedGuess: false })).toBe('Eşleşti, 3 hata');
  });

  it('özet: doğru sayısı, tahminler ve eşleştirme hataları', () => {
    let run = startRun();
    run = recordOutcome(acts, run, acts[0].id, good);
    run = recordOutcome(acts, run, acts[1].id, { ...good, flaggedGuess: true });
    run = recordOutcome(acts, run, acts[2].id, { correct: false, mistakes: 0, flaggedGuess: false });
    run = recordOutcome(acts, run, acts[3].id, { correct: false, mistakes: 2, flaggedGuess: false });
    expect(summarizeRun(acts, run)).toEqual({
      total: 5,
      answered: 4,
      correct: 2,
      flaggedGuesses: 1,
      matchMistakes: 2,
    });
  });

  it('gerçek içerikle beş etkinlik baştan sona oynanır (hatasız tur)', () => {
    let run = startRun();
    for (const a of acts) {
      let outcome: Outcome | null;
      if (a.kind === 'match') {
        let s = startMatch(a, 99);
        for (let pair = 0; pair < a.pairs.length; pair++) {
          s = pickItem(s, 'left', pair);
          s = pickItem(s, 'right', slotOf(s, pair));
        }
        outcome = matchOutcome(s);
      } else {
        outcome = answerChoice(a, a.correctIndex, false);
      }
      expect(outcome).not.toBeNull();
      run = recordOutcome(acts, run, a.id, outcome as Outcome);
    }
    expect(isRunDone(acts, run)).toBe(true);
    expect(summarizeRun(acts, run)).toMatchObject({ total: 5, answered: 5, correct: 5, matchMistakes: 0 });
  });
});
