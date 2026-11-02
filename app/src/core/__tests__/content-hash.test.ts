import {
  canonicalJson,
  cardCoreHash,
  claimHash,
  contentHash,
  coreEntries,
  decisionCoreHash,
  caseContextOf,
  compareCodeUnits,
  followUpCoreHash,
  hashContext,
  hashString,
  claimsMap,
  type CaseContext,
} from '../contentHash';
import { selectDaily } from '../daily';
import { conceptMastery, masteryMap } from '../mastery';
import { emptyProgress, reviewCard } from '../scheduling';
import { approvedPack, sealPack } from '../testing/helpers';
import { checkCoreStability, validateApprovals, validateReleaseLock, type ReleaseLock } from '../validate-pack';
import type { Card, ContentPack } from '../types';

const NOW = new Date('2026-11-01T09:00:00Z');

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Paketin kopyasını verilen değişiklikle üretir; sonuç hash bağlamını da döndürür. */
function mutated(change: (p: ContentPack) => void): { pack: ContentPack; ctx: ReturnType<typeof hashContext> } {
  const pack = clone(approvedPack());
  change(pack);
  return { pack, ctx: hashContext(pack) };
}

describe('canonicalJson ve hashString', () => {
  it('anahtar sırasından bağımsız, undefined alanları atlar', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe(canonicalJson({ a: [2, { d: 1 }], b: 1 }));
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it('belirleyici, sürüm önekli ve içeriğe duyarlı', () => {
    const h = hashString('örnek');
    expect(h).toMatch(/^h1:[0-9a-f]{16}$/);
    expect(hashString('örnek')).toBe(h);
    expect(hashString('örnek ')).not.toBe(h);
  });
});

describe('hash sıralaması dil ve bölge ayarından bağımsızdır', () => {
  const pack = approvedPack();
  const claims = claimsMap(pack.claims);
  const hctx = hashContext(pack);

  const original = String.prototype.localeCompare;

  /** localeCompare'i verilen dile sabitler (ICU farklarını taklit eder); çağrı sonunda geri yükler. */
  function withLocale<T>(locale: string, fn: () => T): T {
    const spy = jest.spyOn(String.prototype, 'localeCompare').mockImplementation(function (this: string, that: string) {
      return original.call(this, that, locale);
    });
    try {
      return fn();
    } finally {
      spy.mockRestore();
    }
  }
  /** localeCompare'i tersine çevirir: kod bir yerde hâlâ ona dayanıyorsa özet kesin değişir. */
  function withReversedLocaleCompare<T>(fn: () => T): T {
    const spy = jest.spyOn(String.prototype, 'localeCompare').mockImplementation(function (this: string, that: string) {
      return -original.call(this, that);
    });
    try {
      return fn();
    } finally {
      spy.mockRestore();
    }
  }

  const everything = (): string[] => [
    ...Object.values(coreEntries(pack)),
    contentHash(pack.cases[0], hctx),
    contentHash(pack.cards[0], hctx),
    followUpCoreHash(pack.cases[0].followUp!, claims, caseContextOf(pack.cases[0])),
  ];

  it('karşılaştırıcı UTF-16 kod birimlerine göre sıralar; farklı metinler için asla 0 döndürmez', () => {
    expect(['zebra', 'äther', 'Zebra', 'ether'].sort(compareCodeUnits)).toEqual(['Zebra', 'ether', 'zebra', 'äther']);
    expect(compareCodeUnits('a', 'a')).toBe(0);
    expect(compareCodeUnits('a', 'b')).toBe(-1);
    expect(compareCodeUnits('b', 'a')).toBe(1);
  });

  it('Unicode denkleri (NFC / NFD) farklı kodlandığı için farklı sıralanır, sıra belirsiz kalmaz', () => {
    const nfc = '\u00e9'; // é
    const nfd = 'e\u0301'; // e + birleştirici vurgu: aynı görünür
    expect(nfc).not.toBe(nfd);
    expect(compareCodeUnits(nfc, nfd)).not.toBe(0);
    expect(compareCodeUnits(nfc, nfd)).toBe(-compareCodeUnits(nfd, nfc));
    expect([nfc, nfd].sort(compareCodeUnits)).toEqual([nfd, nfc].sort(compareCodeUnits));
  });

  it('aynı görünen ama farklı kodlanan seçenekler: giriş sırası özeti değiştirmez', () => {
    const base = clone(pack.cases[0].decisions[0]);
    base.options[0].text = 'Caf\u00e9';
    base.options[1].text = 'Cafe\u0301';
    const swapped = clone(base);
    [swapped.options[0], swapped.options[1]] = [swapped.options[1], swapped.options[0]];
    const c = caseContextOf(pack.cases[0]);
    expect(decisionCoreHash(swapped, claims, c)).toBe(decisionCoreHash(base, claims, c));
    // localeCompare bu iki metni denk sayabilirdi (0) ve sıra girdiye kalırdı:
    const kartA = clone(pack.cards[0]);
    kartA.options = ['Caf\u00e9', 'Cafe\u0301', 'x'];
    kartA.correctIndex = 2;
    const kartB = { ...clone(kartA), options: ['Cafe\u0301', 'Caf\u00e9', 'x'] };
    expect(cardCoreHash(kartB, claims)).toBe(cardCoreHash(kartA, claims));
  });

  it('aynı metinli (geçersiz) seçeneklerde dereceye göre kesin sıra: giriş sırası özeti değiştirmez', () => {
    const d = clone(pack.cases[0].decisions[0]);
    d.options[0].text = 'Aynı';
    d.options[1].text = 'Aynı';
    d.options[0].rating = 'uygun';
    d.options[1].rating = 'uygunDegil';
    const swapped = clone(d);
    [swapped.options[0], swapped.options[1]] = [swapped.options[1], swapped.options[0]];
    const c = caseContextOf(pack.cases[0]);
    expect(decisionCoreHash(swapped, claims, c)).toBe(decisionCoreHash(d, claims, c));
  });

  it('soru ve seçenek sırası değişince çekirdek özeti aynı kalır', () => {
    const before = coreEntries(pack);
    const p = clone(pack);
    p.cases[0].questions.reverse();
    p.cases[0].decisions[0].options.reverse();
    p.cases[0].followUp!.decision.options.reverse();
    p.cards[0].options = [...p.cards[0].options].reverse();
    p.cards[0].correctIndex = p.cards[0].options.indexOf(pack.cards[0].options[pack.cards[0].correctIndex]);
    expect(coreEntries(p)).toEqual(before);
  });

  it('SV ve EN ayarlarında (äther / zebra) aynı girdi aynı özeti üretir', () => {
    const d = clone(pack.cases[0].decisions[0]);
    d.options[0].text = 'äther';
    d.options[1].text = 'zebra';
    const c = caseContextOf(pack.cases[0]);
    const en = withLocale('en', () => decisionCoreHash(d, claims, c));
    const sv = withLocale('sv', () => decisionCoreHash(d, claims, c));
    expect(sv).toBe(en);
  });

  it('localeCompare tamamen tersine çevrilse bile tüm özetler aynı kalır', () => {
    const normal = everything();
    expect(withReversedLocaleCompare(everything)).toEqual(normal);
  });

  it('özetler sabit bir referans değerle eşleşir (ortamlar arası kararlılık)', () => {
    const d = {
      id: 'x',
      prompt: 'Soru',
      conceptIds: ['b', 'a'],
      options: [
        { text: 'zebra', rating: 'kabul' as const, rationale: 'r', consequence: 'c' },
        { text: 'äther', rating: 'uygun' as const, rationale: 'r', consequence: 'c' },
        { text: 'Zebra', rating: 'uygunDegil' as const, rationale: 'r', consequence: 'c' },
      ],
    };
    const ctx = {
      presentation: 'Sunum',
      questionBudget: 2,
      questions: [
        { id: 'q2', ask: 'Ä', reply: 'b', critical: false },
        { id: 'q10', ask: 'a', reply: 'b', critical: true },
      ],
    };
    expect(decisionCoreHash(d, claimsMap([]), ctx)).toBe('h1:72888b5441efe6dd');
  });
});

describe('contentHash: onay bütünlüğü (tüm içerik)', () => {
  const pack = approvedPack();
  const ctx = hashContext(pack);
  const card = pack.cards[0];
  const base = contentHash(card, ctx);

  it('onay kaydının kendisinden etkilenmez: durum, review, reviewedAt, contentVersion', () => {
    const c = clone(card);
    c.status = 'taslak';
    c.review = undefined;
    c.reviewedAt = '2020-01-01';
    c.contentVersion = 99;
    expect(contentHash(c, ctx)).toBe(base);
  });

  it('açıklama, soru, seçenek, kaynak etiketi, iddia ve kavram bağlantısı değişince değişir', () => {
    for (const patch of [
      { explanation: 'başka bir açıklama' },
      { prompt: 'başka bir soru' },
      { options: ['x', 'y', 'z'] },
      { source: 'başka kaynak' },
      { claimIds: ['syn-c-002'] },
      { conceptIds: ['syn-guvenlik'] },
    ]) {
      expect({ patch, same: contentHash({ ...clone(card), ...patch }, ctx) === base }).toEqual({ patch, same: false });
    }
  });

  it('bağlı iddianın metni değişince, ona dayanan öğenin özeti de değişir', () => {
    const { ctx: c2 } = mutated((p) => {
      p.claims.find((c) => c.id === 'syn-c-001')!.text += ' değişti';
    });
    expect(contentHash(card, c2)).not.toBe(base);
  });

  it('bağlı olmayan iddianın değişmesi özeti değiştirmez', () => {
    const { ctx: c2 } = mutated((p) => {
      p.claims.find((c) => c.id === 'syn-c-002')!.text += ' değişti';
    });
    expect(contentHash(card, c2)).toBe(base);
  });

  it('vaka özeti geri dönüşü kapsamaz (geri dönüşün ayrı onayı vardır)', () => {
    const c = pack.cases[0];
    const h = contentHash(c, ctx);
    const changed = clone(c);
    changed.followUp!.returns.iyi += ' değişti';
    expect(contentHash(changed, ctx)).toBe(h);
    expect(contentHash(c.followUp!, ctx)).not.toBe(contentHash(changed.followUp!, ctx));
  });

  it('vakada karar gerekçesi değişince değişir', () => {
    const c = pack.cases[0];
    const changed = clone(c);
    changed.decisions[0].options[0].rationale += ' değişti';
    expect(contentHash(changed, ctx)).not.toBe(contentHash(c, ctx));
  });
});

describe('contentHash: kaynak kayıtları ve kavramlar onay kapsamındadır', () => {
  const pack = approvedPack();
  const ctx = hashContext(pack);
  const claim = pack.claims.find((c) => c.id === 'syn-c-001')!;
  const sourceId = claim.sourceRefs[0].sourceId;

  it.each([
    ['tür', (s: ContentPack['sources'][number]) => (s.type = s.type === 'etiket' ? 'derleme' : 'etiket')],
    ['başlık', (s: ContentPack['sources'][number]) => (s.title += ' (başka)')],
    ['yayıncı', (s: ContentPack['sources'][number]) => (s.publisher += ' (başka)')],
    ['yıl', (s: ContentPack['sources'][number]) => (s.year = (s.year ?? 2000) + 1)],
    ['URL', (s: ContentPack['sources'][number]) => (s.url = 'https://example.org/baska')],
    ['erişim tarihi', (s: ContentPack['sources'][number]) => (s.accessedAt = '2030-01-01')],
  ])('kaynağın %s değişince iddia ve ona dayanan öğelerin özeti değişir', (_n, edit) => {
    const { ctx: c2 } = mutated((p) => edit(p.sources.find((s) => s.id === sourceId)!));
    expect(claimHash(claim, c2)).not.toBe(claimHash(claim, ctx));
    expect(contentHash(pack.cards[0], c2)).not.toBe(contentHash(pack.cards[0], ctx));
    expect(contentHash(pack.cases[0], c2)).not.toBe(contentHash(pack.cases[0], ctx));
  });

  it('dayanılmayan bir kaynağın değişmesi özeti etkilemez', () => {
    const otherId = pack.sources.find((s) => !claim.sourceRefs.some((r) => r.sourceId === s.id))?.id;
    expect(otherId).toBeDefined();
    const { ctx: c2 } = mutated((p) => {
      p.sources.find((s) => s.id === otherId)!.title += ' (başka)';
    });
    expect(claimHash(claim, c2)).toBe(claimHash(claim, ctx));
    expect(contentHash(pack.cards[0], c2)).toBe(contentHash(pack.cards[0], ctx));
  });

  it('kaynak kaydı silinirse iddia özeti değişir (eksik işareti)', () => {
    const { ctx: c2 } = mutated((p) => {
      p.sources = p.sources.filter((s) => s.id !== sourceId);
    });
    expect(claimHash(claim, c2)).not.toBe(claimHash(claim, ctx));
  });

  it('iddia özeti autoCheck ve review hariç her şeyi kapsar', () => {
    const h = claimHash(claim, ctx);
    expect(claimHash({ ...claim, autoCheck: 'beklemede', review: undefined }, ctx)).toBe(h);
    expect(claimHash({ ...claim, text: claim.text + '!' }, ctx)).not.toBe(h);
    expect(claimHash({ ...claim, sourceRefs: [] }, ctx)).not.toBe(h);
    expect(claimHash({ ...claim, evidence: 'uzman' }, ctx)).not.toBe(h);
  });

  it('kavram adı değişince, o kavrama bağlı öğenin onay özeti değişir', () => {
    const conceptId = pack.cards[0].conceptIds[0];
    const { ctx: c2 } = mutated((p) => {
      p.concepts.find((k) => k.id === conceptId)!.name += ' (yeniden adlandı)';
    });
    expect(contentHash(pack.cards[0], c2)).not.toBe(contentHash(pack.cards[0], ctx));
  });

  it('bağlı olmayan kavramın adı değişince özet değişmez', () => {
    const conceptId = pack.cards[0].conceptIds[0];
    const otherId = pack.concepts.find((k) => k.id !== conceptId && !pack.cards[0].conceptIds.includes(k.id))!.id;
    const { ctx: c2 } = mutated((p) => {
      p.concepts.find((k) => k.id === otherId)!.name += ' (başka)';
    });
    expect(contentHash(pack.cards[0], c2)).toBe(contentHash(pack.cards[0], ctx));
  });

  it('bağlı kavram silinirse özet değişir', () => {
    const conceptId = pack.cards[0].conceptIds[0];
    const { ctx: c2 } = mutated((p) => {
      p.concepts = p.concepts.filter((k) => k.id !== conceptId);
    });
    expect(contentHash(pack.cards[0], c2)).not.toBe(contentHash(pack.cards[0], ctx));
  });
});

describe('coreHash: ilerleme geçmişinin anlamı (doğru cevap, bağlam ve bilimsel çekirdek)', () => {
  const pack = approvedPack();
  const claims = claimsMap(pack.claims);
  const card = pack.cards[0]; // doğru cevap: options[0]
  const base = cardCoreHash(card, claims);

  it('kozmetik değişiklikler çekirdeği değiştirmez', () => {
    const c = clone(card);
    c.explanation = 'tamamen başka bir açıklama';
    c.source = 'başka kaynak etiketi';
    c.reviewedAt = '2030-01-01';
    c.contentVersion = 7;
    c.status = 'taslak';
    expect(cardCoreHash(c, claims)).toBe(base);
  });

  it('seçeneklerin sırası değişirse (doğru cevap metni aynıysa) çekirdek değişmez', () => {
    const c = clone(card);
    const [correct, ...rest] = c.options;
    c.options = [rest[0], correct, rest[1]];
    c.correctIndex = 1;
    expect(cardCoreHash(c, claims)).toBe(base);
  });

  it('doğru cevap, soru veya seçenek metni değişirse çekirdek değişir', () => {
    const wrongIndex = clone(card);
    wrongIndex.correctIndex = 1;
    const prompt = clone(card);
    prompt.prompt += ' (başka soru)';
    const option = clone(card);
    option.options[2] = 'başka bir yanlış seçenek';
    for (const c of [wrongIndex, prompt, option]) expect(cardCoreHash(c, claims)).not.toBe(base);
  });

  it('kartın kavram bağlantısı (conceptIds) çekirdektedir; sıra ve tekrar etkilemez', () => {
    const relinked = clone(card);
    relinked.conceptIds = ['syn-guvenlik'];
    expect(cardCoreHash(relinked, claims)).not.toBe(base);

    const extra = clone(card);
    extra.conceptIds = [...card.conceptIds, 'syn-guvenlik'];
    expect(cardCoreHash(extra, claims)).not.toBe(base);

    const reordered = clone(card);
    reordered.conceptIds = [...card.conceptIds, ...card.conceptIds].reverse();
    expect(cardCoreHash(reordered, claims)).toBe(base);
  });

  it('kavram ADI çekirdeği değiştirmez, ama onay özetini değiştirir', () => {
    const ctx0 = hashContext(pack);
    const { pack: renamed, ctx: ctx1 } = mutated((p) => {
      p.concepts.find((k) => k.id === pack.cards[0].conceptIds[0])!.name += ' (yeniden adlandı)';
    });
    expect(coreEntries(renamed)).toEqual(coreEntries(pack)); // öğrenme kimliği korunur
    expect(contentHash(renamed.cards[0], ctx1)).not.toBe(contentHash(pack.cards[0], ctx0)); // yeniden onay gerekir
  });

  it('bağlı iddianın metni, şiddeti, eylemi, türü veya riski değişirse çekirdek değişir', () => {
    const c = pack.cards[1]; // etkileşim iddiasına bağlı
    const h = cardCoreHash(c, claims);
    const claim = pack.claims.find((x) => x.id === 'syn-c-002')!;
    const patches = [
      { text: 'başka bir iddia' },
      { severity: claim.severity === 'ciddi' ? ('hafif' as const) : ('ciddi' as const) },
      { action: 'başka eylem' },
      { kind: 'mekanizma' as const },
      { risk: 'normal' as const },
    ];
    for (const patch of patches) {
      const changed = claimsMap(pack.claims.map((x) => (x.id === 'syn-c-002' ? { ...x, ...patch } : x)));
      expect({ patch, same: cardCoreHash(c, changed) === h }).toEqual({ patch, same: false });
    }
  });

  it('iddianın kaynak künyesi veya kanıt düzeyi çekirdek değildir (onay özetini etkiler, ilerlemeyi değil)', () => {
    const c = pack.cards[1];
    const h = cardCoreHash(c, claims);
    const changed = claimsMap(
      pack.claims.map((x) => (x.id === 'syn-c-002' ? { ...x, evidence: 'uzman' as const, sourceRefs: [] } : x)),
    );
    expect(cardCoreHash(c, changed)).toBe(h);
  });
});

describe('coreHash: vaka kararı ve vaka bağlamı', () => {
  const pack = approvedPack();
  const claims = claimsMap(pack.claims);
  const vaka = pack.cases[0];
  const ctxOf = (c: typeof vaka): CaseContext => ({
    presentation: c.presentation,
    questionBudget: c.questionBudget,
    questions: c.questions,
  });
  const d = vaka.decisions[0];
  const base = decisionCoreHash(d, claims, ctxOf(vaka));

  it('karar çekirdeği: seçenek derecesi değişirse değişir; gerekçe/sonuç cilası ve sıra değişmez', () => {
    const rerated = clone(d);
    rerated.options[1].rating = 'uygunDegil';
    const polished = clone(d);
    polished.options[0].rationale = 'başka gerekçe';
    polished.options[0].consequence = 'başka sonuç';
    polished.options.reverse();
    expect(decisionCoreHash(rerated, claims, ctxOf(vaka))).not.toBe(base);
    expect(decisionCoreHash(polished, claims, ctxOf(vaka))).toBe(base);
  });

  it('kararın kavram bağlantısı çekirdektedir', () => {
    const relinked = clone(d);
    relinked.conceptIds = ['syn-guvenlik'];
    expect(decisionCoreHash(relinked, claims, ctxOf(vaka))).not.toBe(base);
  });

  it('vaka sunumu değişirse karar çekirdeği değişir', () => {
    const c = clone(vaka);
    c.presentation += ' (başka sunum)';
    expect(decisionCoreHash(d, claims, ctxOf(c))).not.toBe(base);
  });

  it('soru bütçesi değişirse karar çekirdeği değişir', () => {
    const c = clone(vaka);
    c.questionBudget += 1;
    expect(decisionCoreHash(d, claims, ctxOf(c))).not.toBe(base);
  });

  it.each([
    ['kimliği', (q: { id: string }) => (q.id += '-x')],
    ['sorusu', (q: { ask: string }) => (q.ask += ' (başka)')],
    ['cevabı', (q: { reply: string }) => (q.reply += ' (başka)')],
  ])('bir sorunun %s değişirse karar çekirdeği değişir', (_n, edit) => {
    const c = clone(vaka);
    (edit as (q: unknown) => void)(c.questions[0]);
    expect(decisionCoreHash(d, claims, ctxOf(c))).not.toBe(base);
  });

  it('bir sorunun kritik işareti (critical) değişirse karar çekirdeği değişir', () => {
    const c = clone(vaka);
    c.questions[0].critical = !c.questions[0].critical;
    expect(decisionCoreHash(d, claims, ctxOf(c))).not.toBe(base);
  });

  it('soruların sırası çekirdeği değiştirmez', () => {
    const c = clone(vaka);
    c.questions.reverse();
    expect(decisionCoreHash(d, claims, ctxOf(c))).toBe(base);
  });

  it('vaka başlığı ve kapanış metni cilâdır: çekirdeği değiştirmez', () => {
    const before = coreEntries(pack);
    const { pack: p2 } = mutated((p) => {
      p.cases[0].title += ' (başka başlık)';
    });
    expect(coreEntries(p2)).toEqual(before);
  });

  it('coreEntries vaka bağlamını karar kimliklerine yansıtır', () => {
    const before = coreEntries(pack);
    const { pack: p2 } = mutated((p) => {
      p.cases[0].questions[0].critical = !p.cases[0].questions[0].critical;
    });
    const after = coreEntries(p2);
    for (const id of ['case:syn-v-001:d1', 'case:syn-v-001:d2', 'case:syn-v-001:d3']) {
      expect(after[id]).not.toBe(before[id]);
    }
    expect(after['syn-k-001']).toBe(before['syn-k-001']);
    expect(after['case:syn-v-001:followup']).not.toBe(before['case:syn-v-001:followup']); // geri dönüş de vaka bağlamına bağlı
  });
});

describe('coreHash: geri dönüş anlatımları', () => {
  const pack = approvedPack();
  const claims = claimsMap(pack.claims);
  const f = pack.cases[0].followUp!;
  const caseCtx = caseContextOf(pack.cases[0]);
  const base = followUpCoreHash(f, claims, caseCtx);

  it.each(['iyi', 'karisik', 'zayif'] as const)('"%s" anlatımı değişirse çekirdek değişir', (key) => {
    const changed = clone(f);
    changed.returns[key] += ' (başka anlatım)';
    expect(followUpCoreHash(changed, claims, caseCtx)).not.toBe(base);
  });

  it('geri dönüş kararının derecesi veya kavram bağlantısı değişirse çekirdek değişir', () => {
    const rerated = clone(f);
    rerated.decision.options[0].rating = rerated.decision.options[0].rating === 'uygun' ? 'kabul' : 'uygun';
    const relinked = clone(f);
    relinked.decision.conceptIds = ['syn-guvenlik'];
    expect(followUpCoreHash(rerated, claims, caseCtx)).not.toBe(base);
    expect(followUpCoreHash(relinked, claims, caseCtx)).not.toBe(base);
  });

  it('gerekçe cilası çekirdeği değiştirmez', () => {
    const polished = clone(f);
    polished.decision.options[0].rationale = 'başka gerekçe';
    expect(followUpCoreHash(polished, claims, caseCtx)).toBe(base);
  });
});

describe('geri dönüş, ana vakanın bağlamına bağlıdır (onay özeti VE öğrenme çekirdeği)', () => {
  const pack = approvedPack();
  const hctx = hashContext(pack);
  const f = pack.cases[0].followUp!;
  const baseContent = contentHash(f, hctx, caseContextOf(pack.cases[0]));
  const baseCore = followUpCoreHash(f, claimsMap(pack.claims), caseContextOf(pack.cases[0]));

  const edits: [string, (c: ContentPack['cases'][number]) => void][] = [
    ['vaka sunumu', (c) => (c.presentation += ' (başka sunum)')],
    ['kritik soru işareti', (c) => (c.questions[0].critical = !c.questions[0].critical)],
    ['soru bütçesi', (c) => (c.questionBudget += 1)],
    ['soru metni', (c) => (c.questions[1].ask += ' (başka)')],
    ['soru cevabı', (c) => (c.questions[1].reply += ' (başka)')],
  ];

  it.each(edits)('%s değişince geri dönüşün onay özeti de çekirdeği de değişir', (_n, edit) => {
    const c = clone(pack.cases[0]);
    edit(c);
    expect(contentHash(f, hctx, caseContextOf(c))).not.toBe(baseContent);
    expect(followUpCoreHash(f, claimsMap(pack.claims), caseContextOf(c))).not.toBe(baseCore);
  });

  it('bağlam verilmeden hesaplanan özet, bağlamlı özetle eşleşmez (sessizce geçmez)', () => {
    expect(contentHash(f, hctx)).not.toBe(baseContent);
  });

  it('onay akışı: vaka bağlamı değişince geri dönüşün onayı düşer (vakanınki de)', () => {
    const p = clone(pack);
    p.cases[0].questions[0].critical = !p.cases[0].questions[0].critical;
    const problems = validateApprovals(p).join(' | ');
    expect(problems).toContain('geri dönüş (syn-v-001)');
    expect(problems).toContain('vaka syn-v-001');
    expect(problems).toContain('onaydan sonra içerik değişmiş');
  });

  it('yalnızca geri dönüşün onay kaydı yeniden mühürlenirse bile vaka onayı ayrıca düşük kalır', () => {
    const p = clone(pack);
    p.cases[0].presentation += ' (başka sunum)';
    sealPack(p); // hepsini yeniden mühürler: artık sorun yok
    expect(validateApprovals(p)).toEqual([]);
  });

  it('vaka bağlamı değişince lock uyumsuzluğu geri dönüş için de çıkar (yeni kimlik gerekir)', () => {
    const lock = { lockVersion: 1 as const, items: coreEntries(pack) };
    const p = clone(pack);
    p.cases[0].questionBudget += 1;
    expect(checkCoreStability(coreEntries(p), lock).join()).toContain('case:syn-v-001:followup');
  });
});

describe('coreEntries ve çekirdek kilidi', () => {
  it('ilerleme kimlikleriyle, yalnızca onaylı öğeleri kaydeder', () => {
    const entries = coreEntries(approvedPack());
    expect(Object.keys(entries).sort()).toEqual([
      'case:syn-v-001:d1',
      'case:syn-v-001:d2',
      'case:syn-v-001:d3',
      'case:syn-v-001:followup',
      'syn-k-001',
      'syn-k-002',
    ]);
    const draft = clone(approvedPack());
    draft.cards.forEach((c) => (c.status = 'taslak'));
    draft.cases.forEach((c) => {
      c.status = 'taslak';
      c.followUp!.status = 'taslak';
    });
    expect(coreEntries(draft)).toEqual({});
    expect(Object.keys(coreEntries(draft, false))).toHaveLength(6);
  });

  it('geri dönüşün durumu vakadan bağımsız değerlendirilir', () => {
    const pack = approvedPack();
    pack.cases[0].status = 'taslak';
    expect(Object.keys(coreEntries(pack)).sort()).toEqual(['case:syn-v-001:followup', 'syn-k-001', 'syn-k-002']);
  });

  const lockOf = (items: Record<string, string>): ReleaseLock => ({ lockVersion: 1, items });

  it('değişmeyen içerik kilitle uyumludur; kozmetik düzenleme serbesttir', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const polished = approvedPack();
    polished.cards[0].explanation = 'daha iyi bir açıklama';
    polished.cases[0].decisions[0].options[0].rationale = 'daha iyi bir gerekçe';
    expect(checkCoreStability(coreEntries(polished), lock)).toEqual([]);
  });

  it('doğru cevabı değişen kart aynı kimlikle kabul edilmez', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const changed = approvedPack();
    changed.cards[0].correctIndex = 1;
    const p = checkCoreStability(coreEntries(changed), lock);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('kimlik "syn-k-001"');
    expect(p[0]).toContain('yeni kimlik verin');
  });

  it('kavram bağlantısı değişen kart yakalanır', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const changed = approvedPack();
    changed.cards[0].conceptIds = ['syn-guvenlik'];
    expect(checkCoreStability(coreEntries(changed), lock).join()).toContain('syn-k-001');
  });

  it('bilimsel çekirdeği (iddia metni) değişen kart ve vaka kararları yakalanır', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const changed = approvedPack();
    changed.claims[0].text += ' (anlamı değişti)';
    const ids = checkCoreStability(coreEntries(changed), lock).map((m) => m.match(/"([^"]+)"/)![1]);
    expect(ids.sort()).toEqual(['case:syn-v-001:d1', 'case:syn-v-001:followup', 'syn-k-001']);
  });

  it('karar derecesi değişirse vaka kararı yakalanır', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const changed = approvedPack();
    changed.cases[0].decisions[2].options[0].rating = 'kabul';
    expect(checkCoreStability(coreEntries(changed), lock).join()).toContain('case:syn-v-001:d3');
  });

  it('kritik işareti veya vaka sunumu değişirse tüm vaka kararları ve geri dönüş yakalanır', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    for (const edit of [
      (p: ContentPack) => (p.cases[0].questions[0].critical = !p.cases[0].questions[0].critical),
      (p: ContentPack) => (p.cases[0].presentation += ' (başka sunum)'),
    ]) {
      const changed = approvedPack();
      edit(changed);
      const ids = checkCoreStability(coreEntries(changed), lock).map((m) => m.match(/"([^"]+)"/)![1]);
      expect(ids.sort()).toEqual([
        'case:syn-v-001:d1',
        'case:syn-v-001:d2',
        'case:syn-v-001:d3',
        'case:syn-v-001:followup',
      ]);
    }
  });

  it('kimliği yeni vererek emekli etmek serbesttir; kaldırılan kimlik sorun değildir', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const revised = approvedPack();
    revised.cards[0].id = 'syn-k-001-v2';
    revised.cards[0].correctIndex = 1;
    expect(checkCoreStability(coreEntries(revised), lock)).toEqual([]);
    revised.cards.pop();
    expect(checkCoreStability(coreEntries(revised), lock)).toEqual([]);
  });

  it('emekli bir kimliği başka içerikle yeniden kullanmak yakalanır', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const reused = approvedPack();
    reused.cards[1].id = 'syn-k-001';
    reused.cards.shift();
    expect(checkCoreStability(coreEntries(reused), lock).join()).toContain('syn-k-001');
  });

  it('taslağa düşürülen kart kilitten kaçamaz: yeniden onaylanınca yine karşılaştırılır', () => {
    const lock = lockOf(coreEntries(approvedPack()));
    const changed = approvedPack();
    changed.cards[0].status = 'taslak';
    changed.cards[0].correctIndex = 2;
    expect(checkCoreStability(coreEntries(changed), lock)).toEqual([]);
    changed.cards[0].status = 'onaylı';
    expect(checkCoreStability(coreEntries(changed), lock).join()).toContain('syn-k-001');
  });
});

describe('validateReleaseLock', () => {
  it('geçerli ve boş kilit', () => {
    expect(validateReleaseLock({ lockVersion: 1, items: {} })).toEqual([]);
    expect(validateReleaseLock({ lockVersion: 1, items: { a: 'h1:0123456789abcdef' } })).toEqual([]);
  });

  it.each([
    ['nesne değil', null],
    ['yanlış sürüm', { lockVersion: 2, items: {} }],
    ['items eksik', { lockVersion: 1 }],
    ['geçersiz özet', { lockVersion: 1, items: { a: 'abc' } }],
    ['bilinmeyen alan', { lockVersion: 1, items: {}, extra: 1 }],
  ])('%s yakalanır', (_n, raw) => {
    expect(validateReleaseLock(raw).length).toBeGreaterThan(0);
  });
});

describe('ilerleme geçmişi ile uyum (Progress ve mastery değişmeden)', () => {
  const pack = approvedPack();
  const oldCard = pack.cards[0];
  const progress = reviewCard(emptyProgress(), oldCard, true, 'sure', NOW);

  it('TEHLİKE (kilidin önlediği durum): aynı kimlikle cevabı değişen kart eski ilerlemeyi devralır', () => {
    const changed: Card = { ...oldCard, correctIndex: 1 };
    expect(conceptMastery('syn-formlar', [changed], progress, NOW)).toBeGreaterThan(0);
  });

  it('yeni kimlik verilen kart "görülmemiş" başlar; eski kayıt etkisizdir', () => {
    const revised: Card = { ...oldCard, id: 'syn-k-001-v2', correctIndex: 1 };
    expect(conceptMastery('syn-formlar', [revised], progress, NOW)).toBe(0);
    const [entry] = masteryMap([{ id: 'syn-formlar', name: 'k' }], [revised], progress, NOW);
    expect(entry.mastery).toBe(0);
    expect(entry.seenCount).toBe(0);
  });

  it('içerikten kalkan kimliğin yetim ilerleme kaydı mastery ve Daily 5 seçimini bozmaz', () => {
    const orphaned = reviewCard(progress, { ...oldCard, id: 'eski-kart' }, true, 'sure', NOW);
    const cards = pack.cards.filter((c) => c.id !== 'syn-k-001');
    const map = masteryMap(pack.concepts, cards, orphaned, NOW);
    expect(map.every((m) => m.seenCount === 0 && m.mastery === 0)).toBe(true);
    expect(selectDaily(cards, orphaned, NOW).map((c) => c.id).sort()).toEqual(['syn-k-002']);
  });
});
