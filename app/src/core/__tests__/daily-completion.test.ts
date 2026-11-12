import { emptyProgress } from '../scheduling';
import { homeCells, isSessionActive, type SessionView } from '../session';
import { loadProgress, saveProgress } from '../storage';
import { markSessionComplete, streakStatus, weeklyProgress } from '../weekly';

const day = (d: number, h = 12, m = 0) => new Date(2026, 10, d, h, m);
const ans = (correct = true) => ({ correct, selfReport: 'none' as const });

describe('homeCells: oturumun tüm cevapları, gün karşılaştırması olmadan', () => {
  const active: SessionView = { cardIds: ['a', 'b', 'c'], results: [ans(), ans(false)] };
  const completed: SessionView = {
    cardIds: ['a', 'b', 'c'],
    results: [ans(), ans(false), ans()],
    completedDay: '2026-11-12',
  };

  it('devam eden oturum gün değişse de sürer ve tüm cevapları gösterir', () => {
    expect(isSessionActive(active)).toBe(true);
    for (const now of [day(12, 23, 59), day(13, 0, 1), day(15)]) {
      expect(homeCells(active, emptyProgress(), now, 3, false)).toEqual(['correct', 'wrong', 'pending']);
    }
  });

  it('tamamlanan oturum tamamlandığı gün ana sayfada tüm cevaplarıyla görünür', () => {
    expect(homeCells(completed, emptyProgress(), day(12, 23, 59), 3, true)).toEqual(['correct', 'wrong', 'correct']);
  });

  it('önceki gün tamamlanmış oturum ertesi günün blister\'ı olarak gösterilmez (aynı uygulama oturumu)', () => {
    // Uygulama açık kaldı; aynı bellekteki oturum ertesi gün yeniden değerlendirilir.
    expect(homeCells(completed, emptyProgress(), day(13, 0, 5), 3, false)).toEqual(['pending', 'pending', 'pending']);
    expect(homeCells(completed, emptyProgress(), day(14), 3, false)).toEqual(['pending', 'pending', 'pending']);
  });

  it('oturum yoksa: tamamlanmadıysa boş, tamamlandıysa yalnızca bugünkü kayıtlar', () => {
    expect(homeCells(null, emptyProgress(), day(12), 3, false)).toEqual(['pending', 'pending', 'pending']);
    const p = {
      ...emptyProgress(),
      completedDays: ['2026-11-13'],
      history: [
        { recordVersion: 2 as const, cardId: 'x', correct: true, selfReport: 'none' as const, optionCount: 4, at: day(12, 23, 58).toISOString(), policy: { version: 'v0-experimental', grade: 'Good' as const } },
        { recordVersion: 2 as const, cardId: 'y', correct: false, selfReport: 'none' as const, optionCount: 4, at: day(13, 0, 1).toISOString(), policy: { version: 'v0-experimental', grade: 'Again' as const } },
      ],
    };
    expect(homeCells(null, p, day(13, 8), 3, true)).toEqual(['wrong', 'pending', 'pending']);
  });
});

describe('markSessionComplete: tekil ve haftalık seri korunur', () => {
  it('aynı gün tekrarlı çağrı tek giriş bırakır; iki farklı çağıran (kaynak) aynı günü bir kez sayar', () => {
    const once = markSessionComplete(emptyProgress(), day(13, 0, 1));
    const twice = markSessionComplete(once, day(13, 23, 59)); // ikinci çağıran, aynı gün
    expect(twice.completedDays).toEqual(['2026-11-13']);
    expect(twice).toBe(once); // değişmeden döner
  });

  it('gün anahtarı çağrı anının yerel günüdür (gece yarısı sınırı)', () => {
    expect(markSessionComplete(emptyProgress(), day(12, 23, 59)).completedDays).toEqual(['2026-11-12']);
    expect(markSessionComplete(emptyProgress(), day(13, 0, 0)).completedDays).toEqual(['2026-11-13']);
  });

  it('haftalık ilerleme ve seri davranışı değişmeden çalışır', () => {
    let p = emptyProgress();
    for (const d of [9, 10, 11, 12, 13]) p = markSessionComplete(p, day(d));
    expect(p.completedDays).toHaveLength(5);
    expect(weeklyProgress(p, day(13)).done).toBe(5);
    expect(streakStatus(p, day(13))).toBeDefined();
  });

  it('eski JSON (completedDays, kayıt türleri) yüklenir ve aynen yeniden kaydedilir', async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
    };
    const legacy = markSessionComplete(emptyProgress(), day(12));
    await saveProgress(storage as never, legacy);
    const loaded = await loadProgress(storage as never);
    expect(loaded.completedDays).toEqual(['2026-11-12']);
    await saveProgress(storage as never, loaded);
    const again = await loadProgress(storage as never);
    expect(again.completedDays).toEqual(['2026-11-12']);
  });
});
