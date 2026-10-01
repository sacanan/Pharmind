import type { Card as FsrsCard } from 'ts-fsrs';

/** Bir kavram (etken madde, cilt problemi, kırmızı bayrak vb.). Mastery kavram bazında tutulur. */
export interface Concept {
  id: string;
  name: string;
}

/**
 * Taslak: yapay zekâ veya kullanıcı tarafından yazılmış, henüz denetlenmemiş.
 * Onaylı: eczacı tarafından doğrulanmış; yalnızca bu içerik gerçek kullanıcıya gösterilir.
 * Demo: geliştirme için uydurma yer tutucu; tıbbi bilgi içermez.
 */
export type ContentStatus = 'taslak' | 'onaylı' | 'demo';

/** Çoktan seçmeli kart. İleride diğer kart türleri eklenebilir. */
export interface Card {
  id: string;
  /** Bu kartın test ettiği kavramlar; cevap bu kavramların mastery skorunu etkiler. */
  conceptIds: string[];
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Her içeriğin kaynağı olmalı (CLAUDE.md içerik kuralları). */
  source: string;
  /** Son gözden geçirme tarihi, YYYY-MM-DD. */
  reviewedAt: string;
  status: ContentStatus;
}

export type Confidence = 'sure' | 'unsure' | 'guess';

export interface ReviewRecord {
  cardId: string;
  correct: boolean;
  confidence: Confidence;
  /** ISO zaman damgası */
  at: string;
}

export interface Progress {
  version: 1;
  /** Kart kimliği → FSRS durumu */
  cards: Record<string, FsrsCard>;
  history: ReviewRecord[];
  /** Oturumu tamamlanan günler, yerel saate göre YYYY-MM-DD */
  completedDays: string[];
}
