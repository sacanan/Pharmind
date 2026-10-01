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

/**
 * Bir karar seçeneğinin klinik uygunluğu. "Doğru/yanlış" değil: gri alan vardır.
 * - uygun: önerilen yaklaşım
 * - kabul: kabul edilebilir ama daha iyisi var
 * - uygunDegil: önerilmez; gerekçesi ve ne yapılması gerektiği gösterilir
 */
export type DecisionRating = 'uygun' | 'kabul' | 'uygunDegil';

/** Hastaya sorulabilecek bir soru. Soru bütçesi sınırlı olduğu için seçmek de bir karardır. */
export interface CaseQuestion {
  id: string;
  /** Eczacının sorduğu şey ("Başka ilaç kullanıyor musunuz?") */
  ask: string;
  /** Hastanın cevabı */
  reply: string;
  /** Kritik: atlanırsa güvenli karar verilemez. Kritik olmayanlar bütçeyi boşa harcar. */
  critical: boolean;
}

export interface CaseOption {
  text: string;
  rating: DecisionRating;
  /** Bu seçeneğin neden bu derecelendirmeyi aldığı (şiddet ve ne yapılacağı ile birlikte) */
  rationale: string;
  /** Seçimden sonra hastanın durumunda ne değiştiği (tek-iki cümle) */
  consequence: string;
}

export interface CaseDecision {
  id: string;
  prompt: string;
  /** Karar kalitesi bu kavramların mastery'sini etkiler. */
  conceptIds: string[];
  options: CaseOption[];
}

/** Günün vakası: kısa hasta, soru bütçesi, doğrusal 3 karar noktası ve sonuç. */
export interface PatientCase {
  id: string;
  title: string;
  /** Hasta eczaneye geldiğinde ilk söyledikleri */
  presentation: string;
  questions: CaseQuestion[];
  questionBudget: number;
  decisions: CaseDecision[];
  /** Vakanın kapanışı */
  outcome: string;
  source: string;
  /** Son gözden geçirme tarihi, YYYY-MM-DD. */
  reviewedAt: string;
  status: ContentStatus;
}

/** Bir vakanın oynanış kaydı: sorulan sorular ve her karar noktasında seçilen seçenek. */
export interface CaseRun {
  askedIds: string[];
  /** Karar sırasıyla seçilen seçenek indeksleri */
  choices: number[];
}

export interface CaseResult extends CaseRun {
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
  /** Vaka kimliği → son oynanış */
  caseResults: Record<string, CaseResult>;
}
