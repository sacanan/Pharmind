import { coreEntries, learningIdCollisions, learningIdList } from '../contentHash';
import { draftPack } from '../testing/helpers';
import { shapeProblems, validHttpUrl, validateDraftPack, validatePack } from '../validate-pack';
import { RESERVED_DECISION_ID, SAFE_ID, validateCase } from '../validate';
import type { ContentPack, PatientCase } from '../types';

const joined = (p: string[]): string => p.join(' | ');
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const firstCase = (): PatientCase => draftPack().cases[0];

describe('SAFE_ID biçimi', () => {
  it.each(['a', 'syn-v-001', 'Q1', 'd_1', '9x'])('%s güvenli', (id) => expect(SAFE_ID.test(id)).toBe(true));
  it.each(['', ' ', 'a b', 'a:b', ':', 'a:', '-x', '_x', 'ç', 'a.b', 'a/b', 'a\n', 'x ', ' x'])(
    '%j güvensiz',
    (id) => expect(SAFE_ID.test(id)).toBe(false),
  );
});

describe('"followup" karar kimliği ayrılmıştır', () => {
  it('geçerli bir vakada sorun yok', () => {
    expect(validateCase(firstCase())).toEqual([]);
  });

  it('CaseDecision.id === "followup" validateCase tarafından reddedilir', () => {
    const c = firstCase();
    c.decisions[0].id = RESERVED_DECISION_ID;
    expect(joined(validateCase(c))).toContain('"followup" kimliği geri dönüş için ayrılmıştır');
  });

  it('GERÇEK ÇAKIŞMA: "followup" kararı, geri dönüşle aynı ilerleme anahtarını üretir', () => {
    const pack = draftPack();
    pack.cases[0].decisions[0].id = 'followup';
    expect(learningIdCollisions(pack)).toEqual(['case:syn-v-001:followup']);
    const p = joined(validatePack(pack));
    expect(p).toContain('"followup" kimliği geri dönüş için ayrılmıştır');
    expect(p).toContain('öğrenme kimliği çakışıyor: "case:syn-v-001:followup"');
    expect(joined(validateDraftPack(pack))).toContain('öğrenme kimliği çakışıyor');
  });

  it('coreEntries çakışmayı sessizce üzerine yazmaz, hata fırlatır', () => {
    const pack = draftPack();
    pack.cases[0].decisions[0].id = 'followup';
    expect(() => coreEntries(pack, false)).toThrow('öğrenme kimliği çakışması: case:syn-v-001:followup');
  });

  it('çakışma yoksa kimlik listesi tekrarsızdır', () => {
    const ids = learningIdList(draftPack());
    expect(new Set(ids).size).toBe(ids.length);
    expect(learningIdCollisions(draftPack())).toEqual([]);
  });
});

describe('":" ayraç dağılımı farklı olsa da aynı öğrenme kimliği üretilemez', () => {
  /** "syn-a:b" vakası + "c" kararı  ile  "syn-a" vakası + "b:c" kararı → ikisi de "case:syn-a:b:c". */
  function ambiguousPack(): ContentPack {
    const pack = draftPack();
    const one = clone(pack.cases[0]);
    one.id = 'syn-a:b';
    one.decisions = [{ ...clone(pack.cases[0].decisions[0]), id: 'c' }];
    delete one.followUp;
    const two = clone(pack.cases[0]);
    two.id = 'syn-a';
    two.decisions = [{ ...clone(pack.cases[0].decisions[0]), id: 'b:c' }];
    delete two.followUp;
    pack.cases = [one, two];
    return pack;
  }

  it('farklı (vaka, karar) çiftleri gerçekten aynı anahtarı üretir', () => {
    expect(learningIdCollisions(ambiguousPack())).toEqual(['case:syn-a:b:c']);
  });

  it('paket doğrulaması hem ":" yasağını hem çakışmayı bildirir', () => {
    const p = joined(validatePack(ambiguousPack()));
    expect(p).toContain('vaka kimliği "syn-a:b" geçersiz');
    expect(p).toContain('karar 1 kimliği "b:c" geçersiz');
    expect(p).toContain('öğrenme kimliği çakışıyor: "case:syn-a:b:c"');
  });

  it('coreEntries bu pakette hata fırlatır', () => {
    expect(() => coreEntries(ambiguousPack(), false)).toThrow('case:syn-a:b:c');
  });
});

describe('vaka, soru ve karar kimlikleri boş olamaz ve güvenli biçimde olmalı', () => {
  const edits: [string, (c: PatientCase, v: unknown) => void, string][] = [
    ['vaka', (c, v) => ((c as unknown as { id: unknown }).id = v), 'vaka'],
    ['soru', (c, v) => ((c.questions[0] as unknown as { id: unknown }).id = v), 'soru'],
    ['karar', (c, v) => ((c.decisions[0] as unknown as { id: unknown }).id = v), 'karar 1'],
    ['geri dönüş kararı', (c, v) => ((c.followUp!.decision as unknown as { id: unknown }).id = v), 'geri dönüş kararı'],
  ];
  const bad: [string, unknown][] = [
    ['boş', ''],
    ['boşluk', '   '],
    ['iki nokta', 'a:b'],
    ['boşluklu', 'a b'],
    ['Türkçe karakter', 'çay'],
    ['null', null],
    ['sayı', 5],
    ['nesne', {}],
    ['silinmiş', undefined],
  ];

  for (const [name, edit, label] of edits) {
    it.each(bad)(`${name} kimliği: %s açık hata verir`, (_n, value) => {
      const c = firstCase();
      edit(c, value);
      const p = validateCase(c);
      expect(p.some((m) => m.includes(`${label} kimliği`) || m.includes('kimlik boş'))).toBe(true);
    });
  }

  it('paket düzeyinde de aynı hatalar görünür ve istisna fırlatılmaz', () => {
    for (const [, value] of bad) {
      const pack = draftPack();
      (pack.cases[0].questions[0] as unknown as { id: unknown }).id = value;
      let p: string[] = [];
      expect(() => {
        p = validatePack(pack);
      }).not.toThrow();
      expect(p.length).toBeGreaterThan(0);
      expect(joined(p)).toContain('soru kimliği');
    }
  });
});

describe('CaseQuestion.critical yalnızca boolean', () => {
  it.each([
    ['metin "true"', 'true'],
    ['sayı 1', 1],
    ['sayı 0', 0],
    ['null', null],
    ['nesne', {}],
    ['dizi', []],
    ['silinmiş', undefined],
  ])('%s açık doğrulama hatası üretir', (_n, value) => {
    const c = firstCase();
    (c.questions[0] as unknown as { critical: unknown }).critical = value;
    expect(joined(validateCase(c))).toContain(`soru ${c.questions[0].id}: critical yalnızca true veya false olabilir`);
  });

  it('pakette de açık hata verir; true ve false geçerli', () => {
    const pack = draftPack();
    (pack.cases[0].questions[0] as unknown as { critical: unknown }).critical = 'true';
    expect(joined(validatePack(pack))).toContain('critical yalnızca true veya false olabilir');
    pack.cases[0].questions[0].critical = true;
    pack.cases[0].questions[1].critical = false;
    expect(joined(validatePack(pack))).not.toContain('critical');
  });
});

describe('Source.url: isteğe bağlı, verildiyse metin ve geçerli HTTP(S) adresi', () => {
  const withUrl = (url: unknown): ContentPack => {
    const pack = draftPack();
    (pack.sources[0] as unknown as { url: unknown }).url = url;
    return pack;
  };
  const err = (id: string): string => `kaynak ${id}: url metin ve geçerli bir HTTP(S) adresi olmalı`;

  it('url hiç verilmezse sorun yok', () => {
    const pack = draftPack();
    delete pack.sources[0].url;
    expect(joined(validatePack(pack))).not.toContain('url');
  });

  it.each([
    ['alan adı', 'https://example.org'],
    ['yol', 'https://example.org/etiket.pdf'],
    ['http', 'http://example.org'],
    ['büyük harfli şema ve ana makine', 'HTTPS://Example.org/a?b=c#d'],
    ['alt alan adı', 'https://www.ema.europa.eu/en/documents/product-information.pdf'],
    ['IPv4', 'http://192.168.0.1'],
    ['IPv4 ve port', 'http://192.168.0.1:8080/x'],
    ['IPv6', 'https://[2001:db8::1]'],
    ['IPv6, port ve yol', 'https://[2001:db8::1]:8443/yol'],
    ['port', 'https://example.org:8080'],
    ['yol, sorgu ve fragment', 'https://example.org/a/b?x=1&y=2#bolum-3'],
    ['yalnızca sorgu', 'https://example.org?x=1'],
    ['yalnızca fragment', 'https://example.org#f'],
    ['kullanıcı bilgisi', 'https://user@example.org'],
    ['localhost', 'http://localhost:3000'],
    ['yüzde kodlu yol', 'https://example.org/a%20b'],
  ])('geçerli: %s', (_n, url) => {
    expect(validHttpUrl(url)).toBe(true);
    expect(joined(validatePack(withUrl(url)))).not.toContain('url');
  });

  it('validHttpUrl metin olmayan girdide istisna fırlatmaz, false döner', () => {
    for (const v of [undefined, null, 5, {}, [], true, Symbol('x'), () => 1]) {
      expect(() => validHttpUrl(v)).not.toThrow();
      expect(validHttpUrl(v)).toBe(false);
    }
  });

  it('geçersiz adres istisna fırlatmaz; her doğrulayıcı açık hata verir', () => {
    for (const url of ['https://:', 'https://@', 'https://[bad]', 'https://example.com:abc']) {
      const pack = withUrl(url);
      let a: string[] = [];
      let b: string[] = [];
      expect(() => {
        a = validatePack(pack);
        b = validateDraftPack(pack);
      }).not.toThrow();
      expect(joined(a)).toContain(err(pack.sources[0].id));
      expect(joined(b)).toContain(err(pack.sources[0].id));
    }
  });

  it.each([
    ['boş metin', ''],
    ['boşluk', '   '],
    ['sayı', 5],
    ['null', null],
    ['nesne', {}],
    ['dizi', ['https://example.org']],
    ['boolean', true],
    ['ftp', 'ftp://example.org/x'],
    ['javascript', 'javascript:alert(1)'],
    ['şemasız', 'example.org/x'],
    ['ana makinesiz', 'https://'],
    ['ana makinesiz yol', 'https:///yol'],
    ['boşluklu', 'https://exam ple.org'],
    ['başında boşluk', ' https://example.org'],
    ['satır sonu', 'https://example.org\n'],
    // new URL() tarafından reddedilen, eski düzenli ifadenin kabul ettiği adresler (regresyon)
    ['yalnızca iki nokta', 'https://:'],
    ['yalnızca @', 'https://@'],
    ['bozuk köşeli parantez', 'https://[bad]'],
    ['sayısal olmayan port', 'https://example.com:abc'],
    ['aralık dışı port', 'https://example.com:99999'],
    ['kullanıcı bilgisi var, ana makine yok', 'https://user:pw@'],
    ['ters eğik çizgi', 'https:\\\\example.com'],
    ['http: (yetki kısmı yok)', 'http:example.com'],
    ['içeride sekme', 'https://example.org/a\tb'],
    ['file protokolü', 'file:///etc/passwd'],
    ['data protokolü', 'data:text/plain,x'],
  ])('%s açık doğrulama hatası üretir', (_n, url) => {
    const pack = withUrl(url);
    expect(shapeProblems(pack)).toEqual([]);
    expect(joined(validatePack(pack))).toContain(err(pack.sources[0].id));
  });
});
