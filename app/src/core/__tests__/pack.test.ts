import {
  HIGH_RISK_KINDS,
  hasPlaceholder,
  packWarnings,
  validateApprovals,
  validateDraftPack,
  validatePack,
  validatePackForRelease,
} from '../validate-pack';
import { EMPTY_LOCK, approvedPack, draftPack, lockFor, sealPack } from '../testing/helpers';
import type { ContentPack } from '../types';

const joined = (problems: string[]): string => problems.join(' | ');

describe('sentetik taslak paket', () => {
  it('yapı ve referanslar geçerli; model çıktısı olarak da geçerli', () => {
    expect(validatePack(draftPack())).toEqual([]);
    expect(validateDraftPack(draftPack())).toEqual([]);
  });

  it('taslak içerik yer tutuculu ve kaynaksız olabilir (taslakta onay kuralları aranmaz)', () => {
    const pack = draftPack();
    pack.claims[1].sourceRefs = [];
    expect(validatePack(pack)).toEqual([]);
    expect(validateApprovals(pack)).toEqual([]);
    // onaylı öğesi olmayan paketin kilide ihtiyacı yoktur
    expect(validatePackForRelease(pack, EMPTY_LOCK)).toEqual([]);
  });

  it('bu haliyle (işaretli metinlerle) onaylanamaz', () => {
    const pack = draftPack();
    pack.cards[0].status = 'onaylı';
    expect(joined(validateApprovals(pack))).toContain('yer tutucu');
  });

  it('yer tutucu işaretleri Türkçe büyük/küçük harften bağımsız yakalanır', () => {
    expect(hasPlaceholder('[SENTETİK] metin')).toBe(true);
    expect(hasPlaceholder('x [kaynaktan doldurulacak] y')).toBe(true);
    expect(hasPlaceholder('[TASLAK İDDİA] metin')).toBe(true);
    expect(hasPlaceholder('Normal cümle, [1] numaralı dipnot')).toBe(false);
    expect(hasPlaceholder(undefined)).toBe(false);
  });

  it('uyarılar engellemez ama tek kaynaklı yüksek riski işaretler', () => {
    const w = joined(packWarnings(draftPack()));
    expect(w).toContain('syn-c-003');
    expect(w).toContain('ikinci bağımsız kaynak');
  });

  it('mutlak dil uyarı üretir', () => {
    const pack = draftPack();
    pack.claims[0].text = 'Bu madde asla birlikte kullanılmaz.';
    expect(joined(packWarnings(pack))).toContain('mutlak ifade');
  });
});

describe('validatePack: yapı ve referanslar', () => {
  it.each([
    ['bilinmeyen kaynak', (p: ContentPack) => (p.claims[0].sourceRefs[0].sourceId = 'yok'), 'bilinmeyen kaynak "yok"'],
    ['bilinmeyen iddia (kart)', (p: ContentPack) => (p.cards[0].claimIds = ['yok']), 'bilinmeyen iddia "yok"'],
    [
      'bilinmeyen iddia (karar)',
      (p: ContentPack) => (p.cases[0].decisions[0].claimIds = ['yok']),
      'bilinmeyen iddia "yok"',
    ],
    ['bilinmeyen kavram (kart)', (p: ContentPack) => (p.cards[0].conceptIds = ['yok']), 'bilinmeyen kavram "yok"'],
    [
      'bilinmeyen kavram (karar)',
      (p: ContentPack) => (p.cases[0].decisions[1].conceptIds = ['yok']),
      'bilinmeyen kavram "yok"',
    ],
    [
      'bilinmeyen kavram (geri dönüş)',
      (p: ContentPack) => (p.cases[0].followUp!.decision.conceptIds = ['yok']),
      'bilinmeyen kavram "yok"',
    ],
    ['tekrar eden kaynak', (p: ContentPack) => (p.sources[1].id = p.sources[0].id), 'kaynak kimliği tekrar ediyor'],
    ['tekrar eden iddia', (p: ContentPack) => (p.claims[1].id = p.claims[0].id), 'iddia kimliği tekrar ediyor'],
    ['tekrar eden kavram', (p: ContentPack) => (p.concepts[1].id = p.concepts[0].id), 'kavram kimliği tekrar ediyor'],
    ['tekrar eden kart', (p: ContentPack) => (p.cards[1].id = p.cards[0].id), 'kart kimliği tekrar ediyor'],
    [
      'tekrar eden karar',
      (p: ContentPack) => (p.cases[0].decisions[1].id = p.cases[0].decisions[0].id),
      'karar kimliği tekrar ediyor',
    ],
    ['case: öneki', (p: ContentPack) => (p.cards[0].id = 'case:x:y'), '"case:" öneki'],
    ['paketlerde demo yok', (p: ContentPack) => (p.cards[0].status = 'demo'), '"demo" durumu'],
    ['yanlış şema sürümü', (p: ContentPack) => ((p as { schemaVersion: number }).schemaVersion = 2), 'schemaVersion'],
    ['geçersiz contentVersion', (p: ContentPack) => (p.cards[0].contentVersion = 0), 'contentVersion'],
    ['geçersiz kaynak türü', (p: ContentPack) => ((p.sources[0] as { type: string }).type = 'blog'), 'tür geçersiz'],
    ['geçersiz erişim tarihi', (p: ContentPack) => (p.sources[0].accessedAt = 'dün'), 'erişim tarihi'],
    ['boş alıntı', (p: ContentPack) => (p.claims[0].sourceRefs[0].quote = ' '), 'alıntı boş'],
    ['geçersiz şiddet', (p: ContentPack) => ((p.claims[1] as { severity: string }).severity = 'korkunç'), 'şiddet geçersiz'],
    ['boş eylem', (p: ContentPack) => (p.claims[1].action = ''), 'eylem boş'],
    [
      'kart yapısı (validateCard) geçerli kalır',
      (p: ContentPack) => (p.cards[0].correctIndex = 9),
      'doğru cevap indeksi',
    ],
    [
      'vaka yapısı (validateCase) geçerli kalır',
      (p: ContentPack) => (p.cases[0].decisions = []),
      'en az bir karar noktası',
    ],
  ])('%s yakalanır', (_n, mutate, expected) => {
    const pack = draftPack();
    mutate(pack);
    expect(joined(validatePack(pack))).toContain(expected);
  });

  it('bilinmeyen alanlar her düzeyde reddedilir (paket biçimi kapalıdır)', () => {
    const cases: [string, (p: ContentPack) => void][] = [
      ['paket', (p) => ((p as unknown as Record<string, unknown>).verified = true)],
      ['kart', (p) => ((p.cards[0] as unknown as Record<string, unknown>).eczaciDogruladi = true)],
      ['iddia', (p) => ((p.claims[0] as unknown as Record<string, unknown>).verified = true)],
      ['kaynak', (p) => ((p.sources[0] as unknown as Record<string, unknown>).approved = true)],
      ['vaka', (p) => ((p.cases[0] as unknown as Record<string, unknown>).onay = 'evet')],
      ['geri dönüş', (p) => ((p.cases[0].followUp as unknown as Record<string, unknown>).onay = 'evet')],
      ['seçenek', (p) => ((p.cases[0].decisions[0].options[0] as unknown as Record<string, unknown>).ok = 1)],
    ];
    for (const [name, mutate] of cases) {
      const pack = draftPack();
      mutate(pack);
      expect({ name, problems: joined(validatePack(pack)) }).toEqual({
        name,
        problems: expect.stringContaining('bilinmeyen alan'),
      });
    }
  });

  it('doz, etkileşim ve kontrendikasyon iddiaları düşük riskli işaretlenemez', () => {
    for (const kind of HIGH_RISK_KINDS) {
      const pack = draftPack();
      pack.claims[0].kind = kind;
      pack.claims[0].risk = 'normal';
      expect(joined(validatePack(pack))).toContain('düşük riskli işaretlenemez');
    }
  });

  it('onaylı olmayan öğede review kaydı yapısal olarak reddedilir', () => {
    const pack = draftPack();
    pack.cards[0].review = { by: 'X', on: '2026-11-01', contentHash: 'h1:0000000000000000' };
    expect(joined(validatePack(pack))).toContain('onaylı olmayan içerikte review kaydı olamaz');
  });
});

describe('validateApprovals: yalnızca onaylı içerik', () => {
  it('tamamen onaylı sentetik paket geçer', () => {
    const pack = approvedPack();
    expect(validatePack(pack)).toEqual([]);
    expect(validateApprovals(pack)).toEqual([]);
    expect(validatePackForRelease(pack, lockFor(pack))).toEqual([]);
  });

  it('onaylı kartta review yoksa reddedilir', () => {
    const pack = approvedPack();
    delete pack.cards[0].review;
    expect(joined(validateApprovals(pack))).toContain('kart syn-k-001: onaylı ama insan onay kaydı (review) yok');
  });

  it('onaydan sonra değişen kart içeriği onayı düşürür', () => {
    const pack = approvedPack();
    pack.cards[0].explanation += ' (sonradan eklendi)';
    expect(joined(validateApprovals(pack))).toContain('kart syn-k-001: onaydan sonra içerik değişmiş');
  });

  it('onaydan sonra değişen iddia, ona dayanan tüm öğelerin ve iddianın onayını düşürür', () => {
    const pack = approvedPack();
    pack.claims[0].text += ' (sonradan değişti)';
    const p = joined(validateApprovals(pack));
    expect(p).toContain('iddia syn-c-001 (eczacı onayı): onaydan sonra içerik değişmiş');
    expect(p).toContain('kart syn-k-001: onaydan sonra içerik değişmiş');
    expect(p).toContain('vaka syn-v-001: onaydan sonra içerik değişmiş');
    expect(p).toContain('geri dönüş (syn-v-001): onaydan sonra içerik değişmiş');
  });

  it('vakadaki değişiklik geri dönüşün onayını düşürmez, geri dönüştekisi vakanınkini düşürmez', () => {
    const pack = approvedPack();
    pack.cases[0].followUp!.returns.iyi += ' (sonradan değişti)';
    const p = joined(validateApprovals(pack));
    expect(p).toContain('geri dönüş (syn-v-001): onaydan sonra içerik değişmiş');
    expect(p).not.toContain('vaka syn-v-001: onaydan sonra');
  });

  it('reviewedAt onay tarihiyle aynı olmalı', () => {
    const pack = approvedPack();
    pack.cards[0].reviewedAt = '2026-01-01';
    expect(joined(validateApprovals(pack))).toContain('onay tarihiyle');
  });

  it('contentVersion zorunlu', () => {
    const pack = approvedPack();
    delete pack.cards[0].contentVersion;
    sealPack(pack);
    expect(joined(validateApprovals(pack))).toContain('contentVersion (≥1) zorunlu');
  });

  it('iddiasız onaylı kart veya karar reddedilir', () => {
    const pack = approvedPack();
    pack.cards[0].claimIds = [];
    pack.cases[0].decisions[2].claimIds = [];
    sealPack(pack);
    const p = joined(validateApprovals(pack));
    expect(p).toContain('kart syn-k-001: onaylı içerik, her karar/kart için en az bir bilimsel iddiaya');
    expect(p).toContain('vaka syn-v-001: onaylı içerik, her karar/kart için en az bir bilimsel iddiaya');
  });

  it('onaylı kartta boş açıklama ve yer tutucu metin reddedilir', () => {
    const pack = approvedPack();
    pack.cards[0].explanation = '';
    pack.cards[1].prompt = '[doldurulacak] soru';
    sealPack(pack);
    const p = joined(validateApprovals(pack));
    expect(p).toContain('açıklama boş');
    expect(p).toContain('kart syn-k-002: yer tutucu metin içeriyor');
  });

  it('taslak öğeler, onaylı yolun kurallarına tabi değildir', () => {
    const pack = approvedPack();
    pack.cards[1].status = 'taslak';
    delete pack.cards[1].review;
    pack.cards[1].claimIds = [];
    pack.cards[1].explanation = '';
    pack.cards[1].prompt = '[SENTETİK] taslak';
    expect(validateApprovals(pack)).toEqual([]);
  });

  describe('iddia onayı: otomatik denetim ile insan onayı ayrı ve ikisi de gerekir', () => {
    it('insan onayı (review) olmadan otomatik denetim yetmez', () => {
      const pack = approvedPack();
      delete pack.claims[0].review;
      sealPack(pack);
      expect(joined(validateApprovals(pack))).toContain('iddia syn-c-001 (eczacı onayı): onaylı ama insan onay kaydı');
    });

    it('otomatik denetim olmadan insan onayı yetmez', () => {
      const pack = approvedPack();
      pack.claims[0].autoCheck = 'beklemede';
      sealPack(pack);
      expect(joined(validateApprovals(pack))).toContain('otomatik kaynak denetimi tamamlanmamış');
      pack.claims[0].autoCheck = 'itirazli';
      expect(joined(validateApprovals(pack))).toContain('autoCheck: itirazli');
    });

    it('kaynaksız, konumsuz veya erişim tarihsiz iddia reddedilir', () => {
      const pack = approvedPack();
      pack.claims[0].sourceRefs = [];
      pack.claims[2].sourceRefs[0].locator = undefined;
      pack.sources.find((s) => s.id === 'src-syn-etiket')!.accessedAt = undefined;
      sealPack(pack);
      const p = joined(validateApprovals(pack));
      expect(p).toContain('iddia syn-c-001: kaynak yok');
      expect(p).toContain('iddia syn-c-003: kaynak "src-syn-monograf" için konum (bölüm/tablo) yok');
      expect(p).toContain('iddia syn-c-002: kaynak "src-syn-etiket" için erişim tarihi yok');
    });

    it('iddia metninde veya eyleminde yer tutucu olamaz', () => {
      const pack = approvedPack();
      pack.claims[1].action = '[kaynaktan doldurulacak]';
      sealPack(pack);
      expect(joined(validateApprovals(pack))).toContain('iddia syn-c-002: eylem yer tutucu içeriyor');
    });

    it('normal riskli iddia için alıntı ve birincil kaynak şart değildir', () => {
      const pack = approvedPack();
      pack.claims[0].sourceRefs[0].quote = undefined;
      sealPack(pack);
      expect(validateApprovals(pack)).toEqual([]);
    });
  });

  describe('yüksek riskli iddia: kaynak ve kanıt kontrolleri olmadan onay yok', () => {
    it('alıntı yoksa reddedilir', () => {
      const pack = approvedPack();
      pack.claims[1].sourceRefs.forEach((r) => (r.quote = undefined));
      sealPack(pack);
      expect(joined(validateApprovals(pack))).toContain(
        'iddia syn-c-002: yüksek riskli iddia, alıntılı bir birincil kaynağa',
      );
    });

    it('yalnızca ikincil kaynağa (derleme) dayanıyorsa reddedilir', () => {
      const pack = approvedPack();
      pack.claims[2].sourceRefs = [{ sourceId: 'src-syn-derleme', locator: 'Bölüm 1', quote: 'sentetik alıntı' }];
      sealPack(pack);
      expect(joined(validateApprovals(pack))).toContain(
        'iddia syn-c-003: yüksek riskli iddia, alıntılı bir birincil kaynağa',
      );
    });

    it('kanıt düzeyi etiket/kılavuz değilse reddedilir', () => {
      const pack = approvedPack();
      pack.claims[2].evidence = 'derleme';
      sealPack(pack);
      expect(joined(validateApprovals(pack))).toContain(
        'iddia syn-c-003: yüksek riskli iddia için kanıt düzeyi etiket veya kılavuz olmalı',
      );
    });

    it('etkileşimde şiddet ve eylem zorunlu', () => {
      const pack = approvedPack();
      delete pack.claims[1].severity;
      delete pack.claims[1].action;
      sealPack(pack);
      const p = joined(validateApprovals(pack));
      expect(p).toContain('iddia syn-c-002: etkileşimde şiddet derecesi zorunlu');
      expect(p).toContain('iddia syn-c-002: etkileşimde ne yapılacağı (eylem) zorunlu');
    });
  });

  describe('kaynak kaydı ve kavram değişince bağlı onaylar düşer', () => {
    // src-syn-derleme yalnızca syn-c-001'e bağlı; syn-c-001 kart 1, vaka kararı d1 ve geri dönüşe bağlı.
    it.each([
      ['URL', (s: ContentPack['sources'][number]) => (s.url = 'https://ornek.invalid/baska')],
      ['başlık', (s: ContentPack['sources'][number]) => (s.title += ' (başka baskı)')],
      ['yayıncı', (s: ContentPack['sources'][number]) => (s.publisher = 'Başka Yayıncı')],
      ['tür', (s: ContentPack['sources'][number]) => (s.type = 'calisma')],
      ['yıl', (s: ContentPack['sources'][number]) => (s.year = 1999)],
      ['erişim tarihi', (s: ContentPack['sources'][number]) => (s.accessedAt = '2026-10-31')],
    ])('kaynağın %s alanı değişince iddia, kart, vaka ve geri dönüş onayı düşer', (_n, mutate) => {
      const pack = approvedPack();
      mutate(pack.sources.find((s) => s.id === 'src-syn-derleme')!);
      const p = joined(validateApprovals(pack));
      expect(p).toContain('iddia syn-c-001 (eczacı onayı): onaydan sonra içerik değişmiş');
      expect(p).toContain('kart syn-k-001: onaydan sonra içerik değişmiş');
      expect(p).toContain('vaka syn-v-001: onaydan sonra içerik değişmiş');
      expect(p).toContain('geri dönüş (syn-v-001): onaydan sonra içerik değişmiş');
      // başka iddiaya bağlı kart etkilenmez
      expect(p).not.toContain('kart syn-k-002: onaydan sonra');
    });

    it('yeniden mühürlenince (insan onayıyla) tekrar geçer', () => {
      const pack = approvedPack();
      pack.sources.find((s) => s.id === 'src-syn-derleme')!.url = 'https://ornek.invalid/baska';
      sealPack(pack);
      expect(validateApprovals(pack)).toEqual([]);
    });

    it('bağlı kavramın adı değişince, o kavramı kullanan öğelerin onayı düşer; kullanmayanlarınki düşmez', () => {
      const pack = approvedPack();
      pack.concepts.find((k) => k.id === 'syn-formlar')!.name = 'Başka ad';
      const p = joined(validateApprovals(pack));
      expect(p).toContain('kart syn-k-001: onaydan sonra içerik değişmiş');
      expect(p).toContain('vaka syn-v-001: onaydan sonra içerik değişmiş');
      expect(p).not.toContain('kart syn-k-002: onaydan sonra');
    });

    it('iddia onayları kavram adından etkilenmez (iddia kavrama bağlı değildir)', () => {
      const pack = approvedPack();
      pack.concepts[0].name = 'Başka ad';
      expect(joined(validateApprovals(pack))).not.toContain('(eczacı onayı): onaydan sonra');
    });
  });

  describe('geri dönüşün ayrı onayı', () => {
    it('onaylı geri dönüş iddiasız olamaz; vaka taslak kalabilir', () => {
      const pack = approvedPack();
      pack.cases[0].status = 'taslak';
      delete pack.cases[0].review;
      pack.cases[0].followUp!.decision.claimIds = [];
      sealPack(pack);
      const p = joined(validateApprovals(pack));
      expect(p).toContain('geri dönüş (syn-v-001): onaylı içerik, her karar/kart için en az bir bilimsel iddiaya');
      expect(p).not.toContain('vaka syn-v-001:');
    });
  });
});

describe('validateDraftPack: model çıktısı onay üretemez', () => {
  it.each([
    ['onaylı kart', (p: ContentPack) => (p.cards[0].status = 'onaylı'), 'kart syn-k-001: model çıktısı yalnızca "taslak"'],
    ['onaylı vaka', (p: ContentPack) => (p.cases[0].status = 'onaylı'), 'vaka syn-v-001: model çıktısı yalnızca "taslak"'],
    [
      'onaylı geri dönüş',
      (p: ContentPack) => (p.cases[0].followUp!.status = 'onaylı'),
      'geri dönüş (syn-v-001): model çıktısı yalnızca "taslak"',
    ],
    [
      'kartta review',
      (p: ContentPack) => (p.cards[0].review = { by: 'X', on: '2026-11-01', contentHash: 'h1:0' }),
      'kart syn-k-001: model çıktısında review kaydı olamaz',
    ],
    [
      'vakada review',
      (p: ContentPack) => (p.cases[0].review = { by: 'X', on: '2026-11-01', contentHash: 'h1:0' }),
      'vaka syn-v-001: model çıktısında review kaydı olamaz',
    ],
    [
      'iddiada review',
      (p: ContentPack) => (p.claims[0].review = { by: 'X', on: '2026-11-01', contentHash: 'h1:0' }),
      'iddia syn-c-001: model çıktısında review kaydı olamaz',
    ],
    [
      'iddiada kaynak-eslesti',
      (p: ContentPack) => (p.claims[0].autoCheck = 'kaynak-eslesti'),
      'iddia syn-c-001: model çıktısında autoCheck "beklemede" olmalı',
    ],
    [
      'durum alanı eksik',
      (p: ContentPack) => ((p.cards[0] as unknown as Record<string, unknown>).status = undefined),
      'model çıktısı yalnızca "taslak"',
    ],
    [
      'uydurma onay alanı',
      (p: ContentPack) => ((p.claims[0] as unknown as Record<string, unknown>).eczaciDogruladi = true),
      'bilinmeyen alan "eczaciDogruladi"',
    ],
    [
      'riski düşürülmüş etkileşim',
      (p: ContentPack) => (p.claims[1].risk = 'normal'),
      'düşük riskli işaretlenemez',
    ],
  ])('%s: temizlenmez, çıktı geçersiz sayılır', (_n, mutate, expected) => {
    const pack = draftPack();
    mutate(pack);
    expect(joined(validateDraftPack(pack))).toContain(expected);
  });

  it('tüm onay belirtileriyle dolu "kusursuz" onaylı paket model çıktısı olarak kabul edilmez', () => {
    expect(validateDraftPack(approvedPack()).length).toBeGreaterThan(0);
  });

  it('SINIR: özet imza değildir; doğru özetli sahte review release doğrulamasını geçer', () => {
    // Bilerek belgelenen sınır: hash'i hesaplayan biri tutarlı bir review üretebilir. Bu yüzden
    // model çıktısı hiçbir koşulda review taşıyamaz (yukarıdaki testler) ve gerçek onay insan
    // eliyle, kod incelemesinde görülen bir değişiklikle eklenir.
    const forged = approvedPack();
    expect(validatePackForRelease(forged, lockFor(forged))).toEqual([]);
    expect(validateDraftPack(forged).length).toBeGreaterThan(0);
  });
});
