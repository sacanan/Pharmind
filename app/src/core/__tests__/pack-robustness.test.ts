import { cardCoreHash, claimsMap } from '../contentHash';
import { validateCard } from '../validate';
import { EMPTY_LOCK, approvedPack, draftPack, lockFor } from '../testing/helpers';
import {
  packWarnings,
  shapeProblems,
  validateApprovals,
  validateDraftPack,
  validatePack,
  validatePackForRelease,
} from '../validate-pack';
import type { Card, ContentPack } from '../types';

/** Tüm doğrulayıcıları aynı (bozuk olabilecek) girdiyle çalıştırır. */
function runAll(input: unknown): Record<string, string[]> {
  const pack = input as ContentPack;
  return {
    validatePack: validatePack(pack),
    validateDraftPack: validateDraftPack(pack),
    validateApprovals: validateApprovals(pack),
    validatePackForRelease: validatePackForRelease(pack, EMPTY_LOCK),
    packWarnings: packWarnings(pack),
  };
}

function expectNoThrow(input: unknown): Record<string, string[]> {
  let out: Record<string, string[]> = {};
  expect(() => {
    out = runAll(input);
  }).not.toThrow();
  for (const list of Object.values(out)) {
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((m) => typeof m === 'string')).toBe(true);
  }
  return out;
}

const UNSET = Symbol('unset');

/** "a.0.b" yoluna değer yazar (UNSET ise alanı siler). */
function setPath(root: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  let cur = root as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  const last = keys[keys.length - 1];
  if (value === UNSET) delete cur[last];
  else cur[last] = value;
}

const label = (path: string): string => path.replace(/\.(\d+)/g, '[$1]');

describe('kök nesne geçersizse hata listesi döner, istisna fırlatılmaz', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['sayı', 5],
    ['metin', 'paket'],
    ['dizi', []],
    ['boolean', true],
    ['fonksiyon', () => 1],
  ])('%s', (_n, input) => {
    const out = expectNoThrow(input);
    expect(out.validatePack.join()).toContain('kök nesne geçersiz');
    expect(out.validateDraftPack.length).toBeGreaterThan(0);
    expect(out.validateApprovals.length).toBeGreaterThan(0);
    expect(out.validatePackForRelease.length).toBeGreaterThan(0);
  });

  it('boş nesne: tüm koleksiyonlar eksik diye reddedilir', () => {
    const p = expectNoThrow({}).validatePack.join();
    for (const k of ['concepts', 'sources', 'claims', 'cards', 'cases']) expect(p).toContain(`${k}: liste olmalı`);
  });
});

describe('koleksiyonlar ve iç içe diziler', () => {
  const listPaths = [
    'concepts',
    'sources',
    'claims',
    'cards',
    'cases',
    'claims.0.sourceRefs',
    'cases.0.questions',
    'cases.0.decisions',
    'cases.0.decisions.0.options',
    'cases.0.followUp.decision.options',
  ];
  const wrongContainers: [string, unknown][] = [
    ['null', null],
    ['metin', 'metin'],
    ['sayı', 5],
    ['nesne', {}],
    ['boolean', true],
    ['silinmiş', UNSET],
  ];
  const wrongElements: [string, unknown][] = [
    ['null', [null]],
    ['sayı', [5]],
    ['metin', ['x']],
    ['dizi', [[]]],
  ];

  it.each(listPaths.flatMap((p) => wrongContainers.map(([n, v]) => [p, n, v] as const)))(
    '%s liste yerine %s olursa reddedilir',
    (path, _n, value) => {
      const pack = draftPack();
      setPath(pack, path, value);
      const out = expectNoThrow(pack);
      expect(out.validatePack.join()).toContain(`${label(path)}: liste olmalı`);
      expect(out.validateDraftPack.join()).toContain(`${label(path)}: liste olmalı`);
      expect(out.validatePackForRelease.join()).toContain(`${label(path)}: liste olmalı`);
    },
  );

  it.each(listPaths.flatMap((p) => wrongElements.map(([n, v]) => [p, n, v] as const)))(
    '%s içinde %s eleman nesne olmadığı için reddedilir',
    (path, _n, value) => {
      const pack = draftPack();
      setPath(pack, path, value);
      const out = expectNoThrow(pack);
      expect(out.validatePack.join()).toContain(`${label(path)}[0]: nesne olmalı`);
      expect(out.validateDraftPack.join()).toContain(`${label(path)}[0]: nesne olmalı`);
    },
  );

  it.each([
    ['cases.0.followUp', null],
    ['cases.0.followUp', 'metin'],
    ['cases.0.followUp', 5],
    ['cases.0.followUp', []],
    ['cases.0.followUp.returns', null],
    ['cases.0.followUp.returns', 'metin'],
    ['cases.0.followUp.returns', []],
    ['cases.0.followUp.decision', null],
    ['cases.0.followUp.decision', 'metin'],
    ['cases.0.followUp.decision', UNSET],
  ])('%s = %p olursa nesne olmadığı için reddedilir', (path, value) => {
    const pack = draftPack();
    setPath(pack, path, value);
    const out = expectNoThrow(pack);
    expect(out.validatePack.join()).toContain(`${label(path)}: nesne olmalı`);
  });
});

describe('liste alanları yanlış türdeyse sessizce boş kabul edilmez', () => {
  const required = [
    'cards.0.conceptIds',
    'cards.0.options',
    'cases.0.decisions.0.conceptIds',
    'cases.0.followUp.decision.conceptIds',
  ];
  const optional = [
    'cards.0.claimIds',
    'cases.0.decisions.0.claimIds',
    'cases.0.followUp.decision.claimIds',
  ];
  const wrong: [string, unknown][] = [
    ['null', null],
    ['metin', 'kavram-1'],
    ['sayı', 5],
    ['nesne', {}],
    ['sayı listesi', [1]],
    ['null içeren liste', [null]],
    ['iç içe liste', [['a']]],
  ];

  it.each([...required, ...optional].flatMap((p) => wrong.map(([n, v]) => [p, n, v] as const)))(
    '%s = %s reddedilir',
    (path, _n, value) => {
      const pack = draftPack();
      setPath(pack, path, value);
      const out = expectNoThrow(pack);
      expect(out.validatePack.join()).toContain(`${label(path)}: metin listesi olmalı`);
      expect(out.validateDraftPack.join()).toContain(`${label(path)}: metin listesi olmalı`);
    },
  );

  it.each(required)('zorunlu liste alanı %s silinirse reddedilir', (path) => {
    const pack = draftPack();
    setPath(pack, path, UNSET);
    expect(expectNoThrow(pack).validatePack.join()).toContain(`${label(path)}: metin listesi olmalı`);
  });

  it.each(optional)('isteğe bağlı %s silinirse şekil sorunu değildir', (path) => {
    const pack = draftPack();
    setPath(pack, path, UNSET);
    expect(shapeProblems(pack)).toEqual([]);
  });

  it('boş conceptIds şekil olarak geçerlidir ama anlam kuralı (en az bir kavram) hata verir', () => {
    const pack = draftPack();
    pack.cards[0].conceptIds = [];
    pack.cases[0].decisions[0].conceptIds = [];
    expect(shapeProblems(pack)).toEqual([]);
    const p = validatePack(pack).join();
    expect(p).toContain('kart syn-k-001: en az bir kavrama bağlı olmalı');
    expect(p).toContain('karar 1: en az bir kavrama bağlı olmalı');
  });
});

describe('sistematik bozma: pakette hiçbir değer istisna fırlattırmaz', () => {
  const NET = 'doğrulama tamamlanamadı';
  const weird: unknown[] = [null, 5, 'x', {}, []];

  function paths(value: unknown, prefix = ''): string[] {
    if (value === null || typeof value !== 'object') return [];
    const out: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.push(p, ...paths(v, p));
    }
    return out;
  }

  it('onaylı sentetik paketin her düğümü, her bozuk değerle: istisna yok, güvenlik ağına düşmeden', () => {
    const base = approvedPack();
    const all = paths(base);
    expect(all.length).toBeGreaterThan(200);
    const hitNet: string[] = [];
    for (const path of all) {
      for (const value of weird) {
        const pack = JSON.parse(JSON.stringify(base));
        setPath(pack, path, value);
        const out = expectNoThrow(pack);
        const joined = Object.values(out).flat().join(' | ');
        if (joined.includes(NET)) hitNet.push(`${path} = ${JSON.stringify(value)}`);
      }
    }
    // Beklenmeyen yapılar güvenlik ağına (try/catch) değil, açık denetimlere takılmalı.
    expect(hitNet).toEqual([]);
  });

  it('taslak sentetik paket için de aynı', () => {
    const base = draftPack();
    for (const path of paths(base)) {
      for (const value of weird) {
        const pack = JSON.parse(JSON.stringify(base));
        setPath(pack, path, value);
        expectNoThrow(pack);
      }
    }
  });
});

describe('tekrar eden seçenek metinleri geçersizdir', () => {
  const card: Card = {
    id: 'k',
    conceptIds: ['a'],
    prompt: 'Soru',
    options: ['Evet', 'Hayır'],
    correctIndex: 0,
    explanation: '',
    source: 'Kaynak',
    reviewedAt: '2026-11-01',
    status: 'taslak',
  };

  it('farklı metinli seçenekler geçerli', () => {
    expect(validateCard(card)).toEqual([]);
  });

  it.each([
    ['birebir aynı', ['Evet', 'Evet']],
    ['büyük/küçük harf farkı', ['Evet', 'evet']],
    ['kenar boşluğu farkı', ['Evet', ' Evet ']],
    ['üç seçenekten ikisi', ['A', 'B', 'A']],
  ])('%s yakalanır', (_n, options) => {
    expect(validateCard({ ...card, options })).toContain('seçenek metinleri tekrar ediyor');
  });

  it('neden: aynı metinli iki seçenekte correctIndex kayması coreHash tarafından fark edilmez', () => {
    const dup: Card = { ...card, options: ['Evet', 'Evet', 'Hayır'], correctIndex: 0 };
    const shifted: Card = { ...dup, correctIndex: 1 };
    const claims = claimsMap([]);
    expect(cardCoreHash(dup, claims)).toBe(cardCoreHash(shifted, claims)); // özet kör
    expect(validateCard(dup)).toContain('seçenek metinleri tekrar ediyor'); // bu yüzden geçersiz
  });

  it('paket içinde kartta ve vaka kararında (geri dönüş dahil) yakalanır', () => {
    const pack = draftPack();
    pack.cards[0].options = ['Aynı', 'Aynı', 'Başka'];
    pack.cases[0].decisions[0].options[1].text = pack.cases[0].decisions[0].options[0].text;
    pack.cases[0].followUp!.decision.options[1].text = pack.cases[0].followUp!.decision.options[0].text;
    const p = validatePack(pack);
    expect(p.filter((m) => m.includes('seçenek metinleri tekrar ediyor'))).toHaveLength(3);
    expect(p.join()).toContain('kart syn-k-001: seçenek metinleri tekrar ediyor');
    expect(p.join()).toContain('vaka syn-v-001: karar 1: seçenek metinleri tekrar ediyor');
    expect(p.join()).toContain('geri dönüş kararı: seçenek metinleri tekrar ediyor');
  });
});

// ---------------------------------------------------------------------------
// Reddetme: geçersiz veri yanlışlıkla KABUL edilmemeli
// ---------------------------------------------------------------------------

const kindOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'dizi' : typeof v);

function getPath(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, k) => (cur as Record<string, unknown>)[k], root);
}

function allPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.push(p, ...allPaths(v, p));
  }
  return out;
}

/**
 * Mutasyon sınıflandırması. Her değişiklik geçersiz sayılmaz:
 * - GEÇERLİ KALABİLİR: aynı türde başka bir değer (metin yerine başka metin, sayı yerine başka sayı,
 *   boolean yerine boolean) ve dolu bir listenin boş listeyle değişmesi (boş liste her yerde yasak değil).
 * - KESİN GEÇERSİZ: değerin türünü değiştiren diğer her şey (null, sayı, metin, nesne, dizi arasında).
 *   Kesin geçersiz mutasyonda doğrulayıcı BOŞ OLMAYAN bir hata listesi döndürmelidir.
 */
function definitelyInvalid(original: unknown, mutated: unknown): boolean {
  if (kindOf(original) === kindOf(mutated)) return false;
  if (Array.isArray(original) && Array.isArray(mutated) && mutated.length === 0) return false;
  return true;
}

describe('sistematik bozma: kesin geçersiz değişiklikler REDDEDİLİR', () => {
  const values: unknown[] = [null, 5, 'x', {}, [], true];

  it('onaylı paket + kilit: türü değişen her değer yayın doğrulamasından geçemez', () => {
    const base = approvedPack();
    const lock = lockFor(base);
    expect(validatePackForRelease(base, lock)).toEqual([]); // başlangıç geçerli
    const accepted: string[] = [];
    let asserted = 0;
    for (const path of allPaths(base)) {
      const original = getPath(base, path);
      for (const value of values) {
        if (!definitelyInvalid(original, value)) continue;
        const pack = JSON.parse(JSON.stringify(base));
        setPath(pack, path, value);
        asserted++;
        if (validatePackForRelease(pack, lock).length === 0) accepted.push(`${path} = ${JSON.stringify(value)}`);
      }
    }
    expect(asserted).toBeGreaterThan(800);
    expect(accepted).toEqual([]);
  });

  it('taslak paket: türü değişen her değer validatePack ve validateDraftPack tarafından reddedilir', () => {
    const base = draftPack();
    expect(validateDraftPack(base)).toEqual([]);
    const accepted: string[] = [];
    let asserted = 0;
    for (const path of allPaths(base)) {
      const original = getPath(base, path);
      for (const value of values) {
        if (!definitelyInvalid(original, value)) continue;
        const pack = JSON.parse(JSON.stringify(base));
        setPath(pack, path, value);
        asserted++;
        if (validatePack(pack).length === 0) accepted.push(`validatePack: ${path} = ${JSON.stringify(value)}`);
        if (validateDraftPack(pack).length === 0) accepted.push(`validateDraftPack: ${path} = ${JSON.stringify(value)}`);
      }
    }
    expect(asserted).toBeGreaterThan(800);
    expect(accepted).toEqual([]);
  });

  it('kök nesnenin kendisi: her geçersiz kök değer tüm doğrulayıcılarda hata verir', () => {
    for (const root of [null, undefined, 5, 'x', [], true]) {
      const out = runAll(root);
      for (const name of ['validatePack', 'validateDraftPack', 'validateApprovals', 'validatePackForRelease']) {
        expect({ name, root, empty: out[name].length === 0 }).toEqual({ name, root, empty: false });
      }
    }
  });
});

describe('sistematik bozma: geçerli kalabilen değişiklikler kabul edilir (aşırı sıkı değil)', () => {
  const valid: [string, (p: ContentPack) => void][] = [
    ['paket başlığı başka metin', (p) => (p.title = 'Başka başlık')],
    ['paket konusu başka metin', (p) => (p.topic = 'baska-konu')],
    ['kart açıklaması başka metin', (p) => (p.cards[0].explanation = 'Başka açıklama.')],
    ['kart kaynak etiketi başka metin', (p) => (p.cards[0].source = 'Başka kaynak')],
    ['vaka başlığı başka metin', (p) => (p.cases[0].title = 'Başka vaka başlığı')],
    ['kaynak URL’si kaldırıldı', (p) => delete p.sources[0].url],
    ['kaynak URL’si başka geçerli adres', (p) => (p.sources[0].url = 'https://example.org/baska')],
    ['isteğe bağlı kart claimIds kaldırıldı', (p) => delete p.cards[0].claimIds],
    ['isteğe bağlı contentVersion kaldırıldı', (p) => delete p.cards[0].contentVersion],
    ['kritik soru işareti tersine çevrildi', (p) => (p.cases[0].questions[2].critical = !p.cases[0].questions[2].critical)],
    ['kart seçenek metinleri başka, benzersiz', (p) => (p.cards[0].options = ['A', 'B', 'C'])],
    ['kart doğru cevabı başka geçerli sıra', (p) => (p.cards[0].correctIndex = 1)],
    ['kart kavramı başka tanımlı kavram', (p) => (p.cards[0].conceptIds = ['syn-guvenlik'])],
    ['boş kart listesi', (p) => ((p.cards = []), (p.concepts = p.concepts))],
  ];

  it.each(valid)('%s: taslak paket geçerli kalır', (_n, edit) => {
    const pack = draftPack();
    edit(pack);
    expect(validatePack(pack)).toEqual([]);
    expect(validateDraftPack(pack)).toEqual([]);
  });
});
