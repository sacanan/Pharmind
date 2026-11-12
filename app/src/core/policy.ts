import { Rating, type Grade } from 'ts-fsrs';
import type { PolicyGrade, SelfReport } from './types';

/**
 * DENEYSEL zamanlama politikası. Öğrenme başarısını artırdığı KANITLANMAMIŞTIR; bir tasarım önerisidir ve
 * pilotta sonraki tekrar doğruluğuyla karşılaştırılmadan geçerli sayılmaz. Her yeni kayıt, uygulanan
 * sürümü ve girdileri taşır ki karar sonradan yeniden değerlendirilebilsin.
 */
export const POLICY_VERSION = 'v0-experimental';

export interface PolicyInput {
  correct: boolean;
  selfReport: SelfReport;
}

/**
 * v0:
 * - yanlış → Again (tahmin işareti sonucu DEĞİŞTİRMEZ)
 * - doğru + tahmin işaretli → Hard
 * - doğru + işaretsiz → Good
 *
 * "Good", kullanıcının emin olduğu anlamına gelmez; yalnızca zamanlama kararıdır (işaretsiz = bildirim yok).
 * Easy hiçbir koşulda verilmez.
 */
export function decideGrade(input: PolicyInput): PolicyGrade {
  if (!input.correct) return 'Again';
  return input.selfReport === 'guess' ? 'Hard' : 'Good';
}

/** Politika derecesini ts-fsrs derecesine çevirir. */
export function toFsrsGrade(grade: PolicyGrade): Grade {
  switch (grade) {
    case 'Again':
      return Rating.Again;
    case 'Hard':
      return Rating.Hard;
    case 'Good':
      return Rating.Good;
  }
}
