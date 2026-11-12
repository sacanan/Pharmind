import { Rating } from 'ts-fsrs';
import { POLICY_VERSION, decideGrade, toFsrsGrade } from '../policy';
import type { SelfReport } from '../types';

describe('zamanlama politikası v0 (deneysel)', () => {
  it('sürüm adı deneysel olduğunu belirtir', () => {
    expect(POLICY_VERSION).toBe('v0-experimental');
  });

  it.each<[boolean, SelfReport, 'Again' | 'Hard' | 'Good']>([
    [false, 'none', 'Again'],
    [false, 'guess', 'Again'], // tahmin işareti yanlış cevapta Again'i değiştirmez
    [true, 'guess', 'Hard'],
    [true, 'none', 'Good'], // Good: yalnızca zamanlama kararı; "emin" demek değildir
  ])('doğru=%s, bildirim=%s → %s', (correct, selfReport, expected) => {
    expect(decideGrade({ correct, selfReport })).toBe(expected);
  });

  it('hiçbir girdi kombinasyonu Easy üretmez', () => {
    for (const correct of [true, false]) {
      for (const selfReport of ['none', 'guess'] as const) {
        expect(['Again', 'Hard', 'Good']).toContain(decideGrade({ correct, selfReport }));
      }
    }
  });

  it('ts-fsrs derecelerine doğru çevrilir', () => {
    expect(toFsrsGrade('Again')).toBe(Rating.Again);
    expect(toFsrsGrade('Hard')).toBe(Rating.Hard);
    expect(toFsrsGrade('Good')).toBe(Rating.Good);
  });
});
