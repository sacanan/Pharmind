import { allCards, allCases } from '../../content';
import { coreEntries } from '../contentHash';
import { approvedPack, draftPack } from '../testing/helpers';
import { learningIdsOf, shapeProblems, validateCrossPackIds, validatePack } from '../validate-pack';
import type { ContentPack } from '../types';

const joined = (p: string[]): string => p.join(' | ');

/** Aynı sentetik paketin başka bir önekle yeniden adlandırılmış kopyası (kart ve vaka kimlikleri dahil). */
function packWithPrefix(prefix: string, id = `paket-${prefix}`): ContentPack {
  const pack = draftPack();
  const rename = (s: string): string => `${prefix}-${s.slice('syn-'.length)}`;
  pack.id = id;
  pack.idPrefix = prefix;
  pack.cards.forEach((c) => (c.id = rename(c.id)));
  pack.cases.forEach((c) => (c.id = rename(c.id)));
  return pack;
}

describe('paket öneki (idPrefix) zorunludur', () => {
  it('sentetik paket geçerli; öğrenme kimlikleri önekle başlar', () => {
    expect(validatePack(draftPack())).toEqual([]);
    expect(learningIdsOf(draftPack()).every((id) => id.startsWith('syn-') || id.startsWith('case:syn-'))).toBe(true);
  });

  it('yeniden adlandırılmış kopya da geçerli', () => {
    expect(validatePack(packWithPrefix('abc'))).toEqual([]);
  });

  it.each([
    ['eksik', undefined],
    ['boş', ''],
    ['sayı', 5],
    ['null', null],
    ['tire içeriyor', 'syn-x'],
    ['büyük harf', 'Syn'],
    ['tek harf', 's'],
    ['rakamla başlıyor', '1syn'],
    ['çok uzun', 'abcdefghijklm'],
    ['boşluk', 'sy n'],
  ])('geçersiz önek (%s) reddedilir', (_n, value) => {
    const pack = draftPack() as unknown as Record<string, unknown>;
    if (value === undefined) delete pack.idPrefix;
    else pack.idPrefix = value;
    expect(joined(validatePack(pack as unknown as ContentPack))).toContain('idPrefix zorunlu');
  });

  it('önek taşımayan kart kimliği reddedilir', () => {
    const pack = draftPack();
    pack.cards[0].id = 'k-001';
    expect(joined(validatePack(pack))).toContain('kart k-001: kimlik "syn-" ile başlamalı');
  });

  it('önek taşımayan vaka kimliği reddedilir (karar kimlikleri vakadan türer)', () => {
    const pack = draftPack();
    pack.cases[0].id = 'v-001';
    expect(joined(validatePack(pack))).toContain('vaka v-001: kimlik "syn-" ile başlamalı');
  });

  it('tireli önek kuralı: "synk-001", "syn" öneki için geçerli değildir', () => {
    const pack = draftPack();
    pack.cards[0].id = 'synk-001';
    expect(joined(validatePack(pack))).toContain('kimlik "syn-" ile başlamalı');
  });

  it('başka bir önekle başlayan kimlik reddedilir', () => {
    const pack = packWithPrefix('abc');
    pack.cards[0].id = 'syn-k-001';
    expect(joined(validatePack(pack))).toContain('kimlik "abc-" ile başlamalı');
  });

  it('idPrefix bilinmeyen alan sayılmaz; paket biçimi yine kapalıdır', () => {
    const pack = draftPack() as unknown as Record<string, unknown>;
    pack.verified = true;
    expect(joined(validatePack(pack as unknown as ContentPack))).toContain('bilinmeyen alan "verified"');
  });
});

describe('validateCrossPackIds: paketler arası çakışma', () => {
  it('farklı önekli paketler çakışmaz', () => {
    expect(validateCrossPackIds([draftPack(), packWithPrefix('abc'), packWithPrefix('syn2')])).toEqual([]);
  });

  it('tek paket ve boş liste sorunsuz', () => {
    expect(validateCrossPackIds([approvedPack()])).toEqual([]);
    expect(validateCrossPackIds([])).toEqual([]);
  });

  it('aynı öneki kullanan iki paket yakalanır; ortak öğrenme kimlikleri listelenir', () => {
    const a = packWithPrefix('abc', 'paket-a');
    const b = packWithPrefix('abc', 'paket-b');
    const p = joined(validateCrossPackIds([a, b]));
    expect(p).toContain('idPrefix "abc" birden fazla pakette kullanılıyor: paket-a, paket-b');
    expect(p).toContain('öğrenme kimliği "abc-k-001" birden fazla pakette kullanılıyor');
    expect(p).toContain('öğrenme kimliği "case:abc-v-001:d1" birden fazla pakette kullanılıyor');
    expect(p).toContain('öğrenme kimliği "case:abc-v-001:followup" birden fazla pakette kullanılıyor');
  });

  it('aynı paket kimliği iki kez verilirse yakalanır', () => {
    const p = joined(validateCrossPackIds([packWithPrefix('abc', 'ayni'), packWithPrefix('xyz', 'ayni')]));
    expect(p).toContain('paket kimliği tekrar ediyor: "ayni"');
  });

  it('yalnızca kart kimliği çakışırsa da yakalanır (aynı önek, farklı paket)', () => {
    const a = packWithPrefix('abc', 'paket-a');
    const b = packWithPrefix('abc', 'paket-b');
    b.cases = [];
    b.cards = b.cards.slice(0, 1);
    const p = validateCrossPackIds([a, b]);
    expect(joined(p)).toContain('öğrenme kimliği "abc-k-001"');
    expect(joined(p)).not.toContain('öğrenme kimliği "case:');
  });

  it('uygulamadaki mevcut (rezerve) kimliklerle çakışma yakalanır', () => {
    const pack = packWithPrefix('abc');
    const p = validateCrossPackIds([pack], ['abc-k-001', 'case:abc-v-001:d2', 'baska-kart']);
    expect(joined(p)).toContain('paket-abc: öğrenme kimliği "abc-k-001" uygulamadaki mevcut içerikle çakışıyor');
    expect(joined(p)).toContain('"case:abc-v-001:d2"');
    expect(p).toHaveLength(2);
  });

  it('gerçek uygulama içeriği ile sentetik paket çakışmaz', () => {
    const reserved = [
      ...allCards.map((c) => c.id),
      ...Object.keys(coreEntries({ cards: allCards, cases: allCases }, false)),
    ];
    expect(reserved.length).toBeGreaterThan(0);
    expect(validateCrossPackIds([draftPack()], reserved)).toEqual([]);
    expect(validateCrossPackIds([packWithPrefix('abc')], reserved)).toEqual([]);
  });

  it('şekli bozuk paket istisna fırlatmaz; açıkça raporlanır, diğerleri denetlenir', () => {
    const good = packWithPrefix('abc');
    const dup = packWithPrefix('abc', 'paket-dup');
    for (const bad of [null, 5, 'x', [], {}, { ...draftPack(), cards: null }]) {
      let p: string[] = [];
      expect(() => {
        p = validateCrossPackIds([good, bad as unknown as ContentPack, dup]);
      }).not.toThrow();
      expect(joined(p)).toContain('geçersiz paket, çapraz kimlik denetimine alınmadı');
      expect(joined(p)).toContain('idPrefix "abc" birden fazla pakette');
    }
  });

  it('SEMANTİK olarak geçersiz paket (şekli düzgün) çapraz denetimden geçmiş sayılmaz', () => {
    const semantic: [string, (p: ContentPack) => void][] = [
      ['önek taşımayan kart kimliği', (p) => (p.cards[0].id = 'k-001')],
      ['geçersiz idPrefix', (p) => (p.idPrefix = 'ABC')],
      ['boş soru metni', (p) => (p.cards[0].prompt = '')],
      ['bilinmeyen kavram', (p) => (p.cards[0].conceptIds = ['yok'])],
      ['"followup" karar kimliği', (p) => (p.cases[0].decisions[0].id = 'followup')],
    ];
    for (const [name, edit] of semantic) {
      const bad = packWithPrefix('abc', 'paket-bad');
      edit(bad);
      expect({ name, shape: shapeProblems(bad) }).toEqual({ name, shape: [] }); // şekil olarak düzgün
      const p = validateCrossPackIds([packWithPrefix('xyz'), bad]);
      expect({ name, text: joined(p) }).toEqual({
        name,
        text: expect.stringContaining('paket-bad: geçersiz paket, çapraz kimlik denetimine alınmadı'),
      });
    }
  });

  it('geçersiz paketin kimlikleri sayılmaz: tek başına sahte çakışma üretmez', () => {
    const good = packWithPrefix('abc', 'paket-good');
    const bad = packWithPrefix('abc', 'paket-bad');
    bad.cards[0].prompt = '';
    const p = joined(validateCrossPackIds([good, bad]));
    expect(p).toContain('paket-bad: geçersiz paket');
    expect(p).not.toContain('birden fazla pakette');
  });

  it('paket listesi liste değilse istisna fırlatmaz', () => {
    for (const bad of [null, undefined, 5, 'x', {}]) {
      expect(() => validateCrossPackIds(bad as unknown as ContentPack[])).not.toThrow();
      expect(validateCrossPackIds(bad as unknown as ContentPack[]).length).toBeGreaterThan(0);
    }
  });

  it('önek kuralı ihlal eden paket çapraz denetimden bağımsız olarak validatePack ile reddedilir', () => {
    const a = packWithPrefix('abc');
    a.cards[0].id = 'k-001'; // önek yok
    expect(validatePack(a).length).toBeGreaterThan(0);
  });
});
