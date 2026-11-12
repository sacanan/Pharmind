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

/**
 * İnsan (eczacı) onay kaydı. Bir öğenin veya iddianın o anki içeriğine bağlanır
 * (`contentHash`, bkz. contentHash.ts); içerik sonradan değişirse eşleşmez ve onay düşer.
 *
 * UYARI: Bu bir kriptografik imza veya gerçek insan onayının kanıtı DEĞİLDİR. Kayıt metin olarak
 * yazılabilir; yalnızca "onaydan sonra içerik kazara değişti mi" sorusunu yakalar. Onayın gerçekten
 * bir insandan geldiğini güvence altına alan şey, bu kaydın yalnızca insan eliyle (kod incelemesiyle
 * görülebilir bir değişiklikle) eklenmesi ve model çıktısında asla kabul edilmemesidir
 * (bkz. validateDraftPack).
 */
export interface Review {
  /** Onaylayan kişi */
  by: string;
  /** Onay tarihi, YYYY-MM-DD */
  on: string;
  /** Onaylanan içeriğin özeti (contentHash / claimHash) */
  contentHash: string;
}

export type SourceType = 'etiket' | 'kilavuz' | 'monograf' | 'derleme' | 'calisma' | 'mevzuat';

/** Kaynak kayıt defterindeki bir kaynak. İddialar kaynaklara `sourceRefs` ile bağlanır. */
export interface Source {
  id: string;
  type: SourceType;
  title: string;
  publisher: string;
  year?: number;
  url?: string;
  /** Kaynağa en son erişilen tarih, YYYY-MM-DD. Onaylı içerikte zorunlu. */
  accessedAt?: string;
}

/** Bir iddianın dayandığı kaynak parçası. */
export interface SourceRef {
  sourceId: string;
  /** Bölüm, tablo veya sayfa */
  locator?: string;
  /** Kaynaktan kısa, birebir alıntı (orijinal dilde) */
  quote?: string;
}

export type ClaimKind =
  | 'mekanizma'
  | 'endikasyon'
  | 'formulasyon'
  | 'doz'
  | 'etkilesim'
  | 'yanetki'
  | 'kontrendikasyon'
  | 'mevzuat'
  | 'diger';

/** İddianın dayandığı kanıtın türü; yüksek riskte yalnızca 'etiket' veya 'kilavuz' kabul edilir. */
export type EvidenceLevel = 'etiket' | 'kilavuz' | 'derleme' | 'calisma' | 'uzman';

export type RiskTier = 'normal' | 'yuksek';

export type Severity = 'hafif' | 'orta' | 'ciddi';

/**
 * OTOMATİK kaynak denetiminin sonucu (ileride araçlar yazar). İnsan onayı değildir:
 * insan onayı yalnızca `Claim.review` ile temsil edilir. Model çıktısında hep 'beklemede' olmalıdır.
 */
export type AutoCheck = 'beklemede' | 'kaynak-eslesti' | 'itirazli';

/** Kartların ve karar noktalarının dayandığı, tek başına doğrulanabilir bir bilimsel iddia. */
export interface Claim {
  id: string;
  kind: ClaimKind;
  text: string;
  evidence: EvidenceLevel;
  /** doz, etkilesim ve kontrendikasyon iddiaları her zaman 'yuksek' olmak zorundadır. */
  risk: RiskTier;
  /** Etkileşim iddialarında zorunlu: ne kadar ciddi */
  severity?: Severity;
  /** Etkileşim iddialarında zorunlu: ne yapılmalı */
  action?: string;
  sourceRefs: SourceRef[];
  autoCheck: AutoCheck;
  /** İnsan (eczacı) bilimsel onayı. */
  review?: Review;
}

/**
 * Konudan bağımsız içerik paketi (dermokozmetik, takviye vb.). Uygulamaya henüz yüklenmez;
 * yalnızca doğrulayıcı ve testlerde kullanılır.
 */
export interface ContentPack {
  schemaVersion: 1;
  id: string;
  /**
   * Paketin öğrenme kimliği öneki (örn. "mgsyn"). Pakettaki kart ve vaka kimlikleri `<idPrefix>-`
   * ile başlamak zorundadır; önek paketler arasında benzersizdir (bkz. validateCrossPackIds).
   */
  idPrefix: string;
  /** Serbest metin konu etiketi ("dermokozmetik", "takviye" vb.); doğrulama kuralları konuya bağlı değildir. */
  topic: string;
  title: string;
  concepts: Concept[];
  sources: Source[];
  claims: Claim[];
  cards: Card[];
  cases: PatientCase[];
}

/** Çoktan seçmeli kart. İleride diğer kart türleri eklenebilir. */
/**
 * Kartın öğrenme seviyesi. Yoksa 'temel' sayılır (mevcut kartlar değişmez). Temel ve Derinleş mastery
 * ayrı hesaplanır. Seviye öğrenme kimliğinin parçasıdır: yalnızca 'derinles' `coreHash`'e girer, yani
 * onaylı bir kartın seviyesi değişirse YENİ KART KİMLİĞİ gerekir (eski kimlik emekli olur; ilerlemesi
 * silinmez ama yetim kalır ve sayılmaz). Bkz. docs/product-decisions.md (M2-3).
 */
export type CardLevel = 'temel' | 'derinles';

export interface Card {
  id: string;
  /** Öğrenme seviyesi; yoksa 'temel'. */
  level?: CardLevel;
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
  /** Paket içeriğinde: bu kartın dayandığı iddialar (Claim.id). Eski/demo kartlarda yoktur. */
  claimIds?: string[];
  /** Paket içeriğinde: insan okunur revizyon sayacı (≥1). Bütünlük `review.contentHash` ile denetlenir. */
  contentVersion?: number;
  /** Paket içeriğinde: insan onay kaydı. Yalnızca 'onaylı' içerikte beklenir. */
  review?: Review;
}

/** ESKİ güven bildirimi (kayıt türü V1). Yeni cevaplarda toplanmaz; yalnızca eski kayıtları okumak için kalır. */
export type Confidence = 'sure' | 'unsure' | 'guess';

/**
 * Yeni cevaplarda kullanıcının isteğe bağlı bildirimi. `none` YALNIZCA "bildirim verilmedi" demektir;
 * emin ya da kararsız olarak yorumlanmaz. `guess`: kullanıcı "Tahmin ettim" dedi.
 */
export type SelfReport = 'guess' | 'none';

/** Zamanlama politikasının verdiği FSRS derecesi (Easy kullanılmaz). */
export type PolicyGrade = 'Again' | 'Hard' | 'Good';

/**
 * Kayıt türü V1: eski kayıtlar. `recordVersion` alanı YOKTUR (eski kayıtlara hiçbir şey eklenmez) ve
 * güven bildirimi zorunluydu. Anlamı korunarak okunur; yeniden yazılırken değiştirilmez.
 */
export interface ReviewRecordV1 {
  recordVersion?: undefined;
  cardId: string;
  correct: boolean;
  confidence: Confidence;
  /** ISO zaman damgası */
  at: string;
}

/**
 * Kayıt türü V2: yeni cevaplar. Politika sürümü, uygulanan derece ve kararı yeniden değerlendirmek için
 * gereken girdiler (`correct`, `selfReport`, `optionCount`) birlikte saklanır.
 * Bu kayıt, geçmişin eksiksiz yeniden oynatılabileceği anlamına GELMEZ (geçmiş sınırlıdır; bkz. HISTORY_LIMIT).
 */
/** Oturum türü: Günlük (Temel) oturum veya Derinleş oturumu. */
export type SessionKind = 'temel' | 'derinles';

export interface ReviewRecordV2 {
  recordVersion: 2;
  cardId: string;
  correct: boolean;
  selfReport: SelfReport;
  /** Kartın seçenek sayısı (tahminle doğru bulma olasılığını değerlendirmek için bir girdi). */
  optionCount: number;
  /** ISO zaman damgası */
  at: string;
  policy: { version: string; grade: PolicyGrade };
  /**
   * Cevabın verildiği oturum türü (M2-4'ten itibaren yeni kayıtlara AÇIKÇA yazılır). Bu alan olmayan
   * kayıtlar (V1 ve daha önce yazılmış V2) Temel kabul edilir: bu bir OKUMA kuralıdır, eski kayıtlara
   * alan yazılmaz (bkz. recordKind).
   */
  sessionKind?: SessionKind;
}

export type ReviewRecord = ReviewRecordV1 | ReviewRecordV2;

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
  /** Paket içeriğinde: bu kararın gerekçelerinin dayandığı iddialar (Claim.id). */
  claimIds?: string[];
}

/** Vakadaki kararların genel kalitesi; hastanın geri dönüşünün hangi varyantla yazılacağını belirler. */
export type CaseTier = 'iyi' | 'karisik' | 'zayif';

/** Hasta ertesi gün geri geldiğinde: kısa anlatım (kararlara göre 3 varyant) ve tek yeni karar. */
export interface CaseFollowUp {
  /** Hastanın dönüşte anlattığı; kararların genel kalitesine göre */
  returns: Record<CaseTier, string>;
  decision: CaseDecision;
  /**
   * Geri dönüş kendi kaynağını ve onay durumunu taşır; vakanınkini miras almaz.
   * Onaylı vakaya sonradan eklenen taslak geri dönüş, onaylanana kadar oynanmaz.
   */
  source: string;
  /** Son gözden geçirme tarihi, YYYY-MM-DD. */
  reviewedAt: string;
  status: ContentStatus;
  contentVersion?: number;
  review?: Review;
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
  /** "Hasta geri geldi": yoksa vaka bununla ilgili bir şey göstermez. */
  followUp?: CaseFollowUp;
  source: string;
  /** Son gözden geçirme tarihi, YYYY-MM-DD. */
  reviewedAt: string;
  status: ContentStatus;
  contentVersion?: number;
  review?: Review;
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
  /** Hasta geri geldiyse seçilen seçenek ve zamanı; yoksa henüz cevaplanmadı. */
  followUp?: { choice: number; at: string };
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
