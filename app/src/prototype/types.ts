/**
 * M1 PROTOTİP MODELİ. Bilerek `core/types.ts` (Card, ContentPack) ile bağlantısızdır:
 * prototip gerçek öğrenme kaydına, FSRS'e, mastery'ye veya içerik paketine dokunmaz.
 * İzolasyon, `core/__tests__/prototype-isolation.test.ts` ile denetlenir.
 */

interface LabBase {
  /** Her zaman `lab-` ile başlar; gerçek kimliklerle karışmaz. */
  id: `lab-${string}`;
  /** Yalnızca gruplama/etiket için; mastery'ye bağlı değildir. */
  conceptId: string;
  /** Cevaptan sonra gösterilen kısa, ihtiyatlı geri bildirim. */
  explain: string;
}

/** Tek seçimli etkinlik: doğru/yanlış (2 seçenek), boşluk doldurma (`___`) veya çoktan seçmeli. */
export interface LabChoice extends LabBase {
  kind: 'tf' | 'cloze' | 'choice';
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface LabPair {
  left: string;
  right: string;
}

/** Dokunarak eşleştirme: soldaki her ifade sağdaki tam bir ifadeyle eşleşir. */
export interface LabMatch extends LabBase {
  kind: 'match';
  prompt: string;
  pairs: LabPair[];
}

export type LabActivity = LabChoice | LabMatch;

/**
 * Bir etkinliğin sonucu. Prototipte hiçbir kayda dönüşmez; yalnızca sonuç ekranında gösterilir.
 * `flaggedGuess`: kullanıcı "Tahmin ettim" dediyse true. false, "emin" anlamına GELMEZ; yalnızca
 * "belirtilmedi" demektir.
 */
export interface Outcome {
  /** Seçimde doğru cevap; eşleştirmede hatasız tamamlama. */
  correct: boolean;
  /** Yalnızca eşleştirmede anlamlı: yanlış eşleştirme denemesi sayısı. */
  mistakes: number;
  flaggedGuess: boolean;
}

/** Blister gözleriyle uyumlu durumlar (`ui/Blister`). */
export type LabCell = 'pending' | 'current' | 'correct' | 'wrong' | 'shaky';
