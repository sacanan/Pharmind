import { canonicalJson, cardCoreHash, claimsMap, contentHash, coreEntries, hashContext, hashString } from '../contentHash';
import { selectDaily } from '../daily';
import { cardLevel, cardsOfLevel } from '../level';
import { masteryMap } from '../mastery';
import { emptyProgress, reviewCard } from '../scheduling';
import { approvedPack } from '../testing/helpers';
import { validateCard } from '../validate';
import { checkCoreStability, type ReleaseLock } from '../validate-pack';
import type { Card, ContentPack } from '../types';
import { allCards, derinlesPlayableCards, playableCards, temelPlayableCards } from '../../content';

const NOW = new Date('2026-11-01T09:00:00Z');
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const card = (id: string, level?: Card['level'], conceptIds = ['k1']): Card => ({
  id,
  level,
  conceptIds,
  prompt: `Soru ${id}`,
  options: ['A', 'B'],
  correctIndex: 0,
  explanation: '',
  source: 'test',
  reviewedAt: '2026-11-01',
  status: 'demo',
});

describe('Card.level: varsayılan ve doğrulama', () => {
  it('seviyesiz kart Temel sayılır; mevcut içerik değişmez', () => {
    expect(cardLevel(card('a'))).toBe('temel');
    expect(cardLevel(card('a', 'derinles'))).toBe('derinles');
    expect(allCards.every((c) => c.level === undefined)).toBe(true);
    expect(derinlesPlayableCards).toHaveLength(0);
    expect(temelPlayableCards).toEqual(playableCards);
  });

  it('geçersiz seviye reddedilir; temel/derinles kabul edilir', () => {
    expect(validateCard(card('a', 'derinles'))).toEqual([]);
    expect(validateCard(card('a', 'temel'))).toEqual([]);
    expect(validateCard(card('a', 'uzman' as never)).join()).toMatch(/seviye/);
  });
});

describe('öğrenme kimliği: seviye ve coreHash', () => {
  const pack = approvedPack();
  const claims = claimsMap(pack.claims);
  const base = pack.cards[0];
  const withLevel = (level: Card['level']): Card => ({ ...clone(base), level });

  it('seviyesiz ve "temel" kartın çekirdek özeti, seviye alanı eklenmeden önceki özetle AYNIDIR', () => {
    const legacyCore = {
      prompt: base.prompt,
      options: [...base.options].sort(),
      answer: base.options[base.correctIndex],
      conceptIds: [...base.conceptIds].sort(),
      claims: (base.claimIds ?? []).sort().map((id) => JSON.parse(JSON.stringify(claimsCore(id)))),
    };
    function claimsCore(id: string) {
      const c = claims.get(id)!;
      return { id: c.id, kind: c.kind, risk: c.risk, text: c.text, severity: c.severity, action: c.action };
    }
    // Eski biçimin birebir yeniden kurulumu: onaylı mevcut kimlikler (kilit) bozulmaz.
    expect(cardCoreHash(withLevel(undefined), claims)).toBe(hashString(canonicalJson(legacyCore)));
    expect(cardCoreHash(withLevel('temel'), claims)).toBe(cardCoreHash(withLevel(undefined), claims));
  });

  it('Derinleş seviyesi çekirdek özeti ve onay özetini değiştirir', () => {
    expect(cardCoreHash(withLevel('derinles'), claims)).not.toBe(cardCoreHash(withLevel(undefined), claims));
    const ctx = hashContext(pack);
    expect(contentHash(withLevel('derinles'), ctx)).not.toBe(contentHash(withLevel(undefined), ctx));
  });

  it('onaylı kartın seviyesi değişirse kilit çekirdek değişikliği olarak yakalanır: yeniden sınıflandırma = yeni kimlik', () => {
    const lock: ReleaseLock = { lockVersion: 1, items: coreEntries(pack) };
    expect(checkCoreStability(coreEntries(pack), lock)).toEqual([]);

    const reclassified: ContentPack = clone(pack);
    reclassified.cards[0].level = 'derinles'; // aynı kimlik, yeni seviye
    const problems = checkCoreStability(coreEntries(reclassified), lock);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(base.id);

    // Doğru yol: yeni kimlik. Eski kimlik emekli olur (kilitte kalır), kilit ihlali yoktur.
    const renamed: ContentPack = clone(pack);
    renamed.cards[0].id = `${base.id}-derin`;
    renamed.cards[0].level = 'derinles';
    expect(checkCoreStability(coreEntries(renamed), lock)).toEqual([]);
  });
});

describe('Temel mastery ve Daily: görülmemiş Derinleş kartları Temel\'i düşürmez', () => {
  const concepts = [{ id: 'k1', name: 'Kavram 1' }];
  const temel = [card('t1'), card('t2', 'temel')];
  const derin = [card('d1', 'derinles'), card('d2', 'derinles')];
  let progress = emptyProgress();
  progress = reviewCard(progress, temel[0], true, 'none', NOW);
  progress = reviewCard(progress, temel[1], true, 'none', NOW);

  it('Temel listesiyle mastery, Derinleş kartları eklense de aynı kalır; karışık liste seyreltirdi', () => {
    const all = [...temel, ...derin];
    const temelOnly = masteryMap(concepts, cardsOfLevel(all, 'temel'), progress, NOW)[0];
    const before = masteryMap(concepts, temel, progress, NOW)[0];
    expect(temelOnly.mastery).toBe(before.mastery);
    expect(temelOnly.cardCount).toBe(2);
    // Karşı kanıt: seviyeye bakmadan hesaplansaydı Temel düşerdi (bu yüzden ayrım gerekli).
    expect(masteryMap(concepts, all, progress, NOW)[0].mastery).toBeLessThan(before.mastery);
  });

  it('Derinleş mastery ayrı hesaplanır ve Temel ilerlemesinden etkilenmez', () => {
    const d = masteryMap(concepts, cardsOfLevel([...temel, ...derin], 'derinles'), progress, NOW)[0];
    expect(d.cardCount).toBe(2);
    expect(d.seenCount).toBe(0);
    expect(d.mastery).toBe(0);
  });

  it('Daily 5 yalnızca Temel kartlardan seçilir', () => {
    const picked = selectDaily(cardsOfLevel([...temel, ...derin], 'temel'), progress, NOW, 5, temel);
    expect(picked.every((c) => cardLevel(c) === 'temel')).toBe(true);
  });

  it('mevcut ilerleme silinmez veya yeniden yorumlanmaz: kart ilerlemesi kimliğine bağlı kalır', () => {
    const snapshot = JSON.stringify(progress);
    // Derinleş kartlarının varlığı mevcut ilerlemeyi değiştirmez.
    masteryMap(concepts, [...temel, ...derin], progress, NOW);
    selectDaily(temel, progress, NOW, 5, temel);
    expect(JSON.stringify(progress)).toBe(snapshot);
    expect(Object.keys(progress.cards).sort()).toEqual(['t1', 't2']);
  });
});
