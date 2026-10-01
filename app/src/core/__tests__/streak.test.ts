import { emptyProgress } from '../scheduling';
import { dayKey, streakStatus, weekStart } from '../weekly';

// 2026-09-28 Pazartesi. Haftalar bu tarihten geriye/ileriye hesaplanır.
const MONDAY = new Date(2026, 8, 28);
const at = (weekOffset: number, dayOffset = 0) =>
  new Date(MONDAY.getFullYear(), MONDAY.getMonth(), MONDAY.getDate() + weekOffset * 7 + dayOffset);

/** weekOffset haftasında `sessions` oturum tamamlanmış gibi gün anahtarları üretir. */
function days(weekOffset: number, sessions: number): string[] {
  return Array.from({ length: sessions }, (_, i) => dayKey(at(weekOffset, i)));
}

function progressOf(plan: Record<number, number>) {
  const completedDays = Object.entries(plan)
    .flatMap(([w, n]) => days(Number(w), n))
    .sort();
  return { ...emptyProgress(), completedDays };
}

describe('streakStatus', () => {
  it('hiç oturum yoksa seri 0, hak 0', () => {
    expect(streakStatus(emptyProgress(), at(0, 3))).toEqual({
      streak: 0,
      freezes: 0,
      untilNextFreeze: 4,
      frozenWeeks: [],
    });
  });

  it('içinde bulunulan hafta hedefe ulaşmadıysa seriyi bozmaz, ulaşınca artırır', () => {
    const p = progressOf({ [-2]: 5, [-1]: 5, 0: 2 });
    expect(streakStatus(p, at(0, 3)).streak).toBe(2);
    const q = progressOf({ [-2]: 5, [-1]: 5, 0: 5 });
    expect(streakStatus(q, at(0, 5)).streak).toBe(3);
  });

  it('hak yokken hedef tutturulmayan hafta seriyi sıfırlar', () => {
    const p = progressOf({ [-3]: 5, [-2]: 5, [-1]: 3 });
    const s = streakStatus(p, at(0, 1));
    expect(s.streak).toBe(0);
    expect(s.frozenWeeks).toEqual([]);
  });

  it('her 4 başarılı haftada 1 hak kazanılır', () => {
    const p = progressOf({ [-3]: 5, [-2]: 5, [-1]: 5, 0: 5 });
    const s = streakStatus(p, at(0, 5));
    expect(s.streak).toBe(4);
    expect(s.freezes).toBe(1);
    expect(s.untilNextFreeze).toBe(4);
  });

  it('hak varsa kaçırılan hafta otomatik dondurulur: seri korunur ama artmaz', () => {
    // 4 başarılı hafta -> 1 hak; sonra 1 kaçırılan hafta; sonra bu hafta
    const p = progressOf({ [-5]: 5, [-4]: 5, [-3]: 5, [-2]: 5, [-1]: 1, 0: 0 });
    const s = streakStatus(p, at(0, 2));
    expect(s.streak).toBe(4);
    expect(s.freezes).toBe(0);
    expect(s.frozenWeeks).toEqual([dayKey(at(-1))]);
  });

  it('tamamen boş geçen haftalar da hak harcar; haklar bitince seri düşer', () => {
    // 4 başarılı hafta, ardından 3 hafta hiç oturum yok: 1 hak harcanır, sonra seri 0
    const p = progressOf({ [-8]: 5, [-7]: 5, [-6]: 5, [-5]: 5 });
    const s = streakStatus(p, at(0, 1));
    expect(s.frozenWeeks).toHaveLength(1);
    expect(s.streak).toBe(0);
    expect(s.freezes).toBe(0);
  });

  it('en fazla 2 hak birikir', () => {
    const plan: Record<number, number> = {};
    for (let w = -11; w <= -1; w++) plan[w] = 5; // 11 başarılı hafta -> 2 hak (üçüncüsü sınırda kalır)
    const s = streakStatus(progressOf(plan), at(0, 0));
    expect(s.freezes).toBe(2);
    expect(s.streak).toBe(11);
  });

  it('weekStart Pazartesi başlar (testteki varsayımı doğrular)', () => {
    expect(dayKey(weekStart(at(0, 3)))).toBe(dayKey(MONDAY));
  });
});
