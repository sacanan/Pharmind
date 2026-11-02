import { coreEntries } from '../contentHash';
import { EMPTY_LOCK, approvedPack, draftPack, lockFor, sealPack } from '../testing/helpers';
import {
  checkReleaseLock,
  compareLocks,
  validatePack,
  validatePackForRelease,
  validateReleaseLock,
  type ReleaseLock,
} from '../validate-pack';

const joined = (p: string[]): string => p.join(' | ');
const lockWith = (items: Record<string, string>): ReleaseLock => ({ lockVersion: 1, items });

describe('validatePackForRelease: kilit zorunludur', () => {
  it('eksiksiz ve eşleşen kilitle geçer', () => {
    const pack = approvedPack();
    expect(validatePackForRelease(pack, lockFor(pack))).toEqual([]);
  });

  it('BOŞ kilit, onaylı içerikle yayın doğrulamasından geçemez', () => {
    const p = validatePackForRelease(approvedPack(), EMPTY_LOCK);
    const missing = p.filter((m) => m.includes('onaylı içerik kilitte yok'));
    expect(missing).toHaveLength(6); // 2 kart + 3 vaka kararı + 1 geri dönüş
    for (const id of [
      'syn-k-001',
      'syn-k-002',
      'case:syn-v-001:d1',
      'case:syn-v-001:d2',
      'case:syn-v-001:d3',
      'case:syn-v-001:followup',
    ]) {
      expect(joined(missing)).toContain(`kimlik "${id}"`);
    }
  });

  it.each([
    ['yeni onaylı kart', 'syn-k-002'],
    ['yeni onaylı vaka kararı', 'case:syn-v-001:d2'],
    ['yeni onaylı geri dönüş', 'case:syn-v-001:followup'],
  ])('kilitte bulunmayan %s reddedilir', (_n, id) => {
    const pack = approvedPack();
    const lock = lockFor(pack);
    delete lock.items[id];
    const p = validatePackForRelease(pack, lock);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain(`kimlik "${id}": onaylı içerik kilitte yok`);
  });

  it('çekirdeği değişmiş mevcut kimlik reddedilir (yeni kimlik gerekir)', () => {
    const original = approvedPack();
    const lock = lockFor(original);
    const changed = approvedPack();
    changed.cards[0].correctIndex = 1; // doğru cevap değişti
    sealPack(changed); // onay geçerli bile olsa kilit reddeder
    const p = validatePackForRelease(changed, lock);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('kimlik "syn-k-001"');
    expect(p[0]).toContain('yeni kimlik verin');
  });

  it('kilitte fazladan (emekli) kayıt bulunması sorun değildir', () => {
    const pack = approvedPack();
    const lock = lockFor(pack);
    lock.items['eski-emekli-kart'] = 'h1:0123456789abcdef';
    expect(validatePackForRelease(pack, lock)).toEqual([]);
  });

  it('onaylı öğesi olmayan (taslak) paket boş kilitle geçer', () => {
    expect(validatePackForRelease(draftPack(), EMPTY_LOCK)).toEqual([]);
  });

  it('yalnızca bir kısmı onaylıysa yalnızca onaylı olanlar kilit ister', () => {
    const pack = approvedPack();
    pack.cards[1].status = 'taslak';
    delete pack.cards[1].review;
    const p = validatePackForRelease(pack, EMPTY_LOCK);
    expect(joined(p)).toContain('kimlik "syn-k-001"');
    expect(joined(p)).not.toContain('kimlik "syn-k-002"');
  });

  it('onay kuralları ihlal edilmişse kilit tam olsa da reddedilir', () => {
    const pack = approvedPack();
    const lock = lockFor(pack);
    delete pack.cards[0].review;
    expect(joined(validatePackForRelease(pack, lock))).toContain('insan onay kaydı');
  });

  it.each([
    ['null', null],
    ['yanlış sürüm', { lockVersion: 2, items: {} }],
    ['items eksik', { lockVersion: 1 }],
    ['items dizi', { lockVersion: 1, items: [] }],
    ['geçersiz özet', { lockVersion: 1, items: { 'syn-k-001': 'abc' } }],
  ])('bozuk kilit (%s) istisna fırlatmaz, hata listesi döndürür', (_n, raw) => {
    const pack = approvedPack();
    let p: string[] = [];
    expect(() => {
      p = validatePackForRelease(pack, raw as unknown as ReleaseLock);
    }).not.toThrow();
    expect(p.length).toBeGreaterThan(0);
  });
});

describe('özet biçimi tam olarak h1:[0-9a-f]{16}', () => {
  it('geçerli biçim kabul edilir', () => {
    expect(validateReleaseLock(lockWith({ a: 'h1:0123456789abcdef' }))).toEqual([]);
  });

  it.each([
    ['çok kısa', 'h1:0'],
    ['büyük harf', 'h1:0123456789ABCDEF'],
    ['15 hane', 'h1:0123456789abcde'],
    ['17 hane', 'h1:0123456789abcdef0'],
    ['onaltılık olmayan', 'h1:0123456789abcdeg'],
    ['başında boşluk', ' h1:0123456789abcdef'],
    ['sonunda boşluk', 'h1:0123456789abcdef '],
    ['yanlış sürüm öneki', 'h2:0123456789abcdef'],
    ['önek yok', '0123456789abcdef'],
    ['satır sonu', 'h1:0123456789abcdef\n'],
  ])('kilitte %s reddedilir', (_n, hash) => {
    expect(joined(validateReleaseLock(lockWith({ a: hash })))).toContain('özet biçimi geçersiz');
  });

  it('review.contentHash de aynı biçimi şart koşar', () => {
    for (const bad of ['h1:0', 'h1:ABCDEF0123456789', 'sha256:abc']) {
      const pack = approvedPack();
      pack.cards[0].review!.contentHash = bad;
      expect(joined(validatePack(pack))).toContain('review.contentHash biçimi geçersiz');
    }
  });
});

describe('compareLocks: kilit yalnızca büyür (CI karşılaştırması)', () => {
  const prev = lockWith({ a: 'h1:0000000000000001', b: 'h1:0000000000000002' });

  it('aynı kilit ve yeni kayıt eklenmesi serbest', () => {
    expect(compareLocks(prev, prev)).toEqual([]);
    expect(compareLocks(prev, lockWith({ ...prev.items, c: 'h1:0000000000000003' }))).toEqual([]);
    expect(compareLocks(EMPTY_LOCK, prev)).toEqual([]);
  });

  it('eski kaydın silinmesi engellenir', () => {
    const next = lockWith({ a: prev.items.a });
    const p = compareLocks(prev, next);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('kilit kaydı silinmiş: "b"');
  });

  it('eski kaydın özetinin değiştirilmesi engellenir', () => {
    const p = compareLocks(prev, lockWith({ ...prev.items, a: 'h1:00000000000000ff' }));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('kilit kaydı değiştirilmiş: "a"');
  });

  it('tüm kilidin boşaltılması (silme) engellenir', () => {
    expect(compareLocks(prev, EMPTY_LOCK)).toHaveLength(2);
  });

  it('bozuk önceki veya yeni kilit hata listesi döndürür', () => {
    expect(compareLocks(null as unknown as ReleaseLock, prev).join()).toContain('önceki');
    expect(compareLocks(prev, { lockVersion: 2, items: {} } as unknown as ReleaseLock).join()).toContain('yeni');
  });

  it('içerik ve kilit kaydı birlikte silinse de karşılaştırma yakalar', () => {
    // Bir değişiklikte hem kart hem kilit kaydı silinirse, yalnızca "yeni" dosyaya bakan denetim
    // (validatePackForRelease) sorun görmez; önceki kilitle karşılaştırma (CI) yakalar.
    const v1 = approvedPack();
    const lock1 = lockFor(v1);
    const v2 = approvedPack();
    v2.cards.pop(); // syn-k-002 emekli
    const lock2 = lockFor(v2); // kilit yalnızca güncel içerikten üretilirse syn-k-002 kaybolur
    expect(validatePackForRelease(v2, lock2)).toEqual([]);
    expect(joined(compareLocks(lock1, lock2))).toContain('kilit kaydı silinmiş: "syn-k-002"');
  });
});

describe('emekli kimlik kilitte kalır, yeni içerik eklenebilir', () => {
  it('çekirdeği değişen kart yeni kimlikle yayımlanır; eski kimlik kilitte kalır', () => {
    const v1 = approvedPack();
    const lock1 = lockFor(v1);

    const v2 = approvedPack();
    v2.cards[0].id = 'syn-k-001-v2'; // yeni kimlik
    v2.cards[0].correctIndex = 1; // doğru cevap değişti
    sealPack(v2);
    const lock2 = lockWith({ ...lock1.items, ...coreEntries(v2) });

    expect(validatePackForRelease(v2, lock2)).toEqual([]);
    expect(compareLocks(lock1, lock2)).toEqual([]);
    expect(Object.keys(lock2.items)).toContain('syn-k-001'); // emekli kimlik kilitte
    expect(Object.keys(lock2.items)).toContain('syn-k-001-v2');
  });

  it('emekli kimliği başka içerikle yeniden kullanmak reddedilir', () => {
    const v1 = approvedPack();
    const lock1 = lockFor(v1);
    const reused = approvedPack();
    reused.cards.shift(); // syn-k-001 emekli
    reused.cards[0].id = 'syn-k-001'; // başka içerik, aynı kimlik
    sealPack(reused);
    expect(joined(validatePackForRelease(reused, lock1))).toContain('kimlik "syn-k-001"');
  });
});

describe('checkReleaseLock', () => {
  it('yalnızca eksiksizlik ve eşleşmeyi denetler', () => {
    const pack = approvedPack();
    const current = coreEntries(pack);
    expect(checkReleaseLock(current, lockFor(pack))).toEqual([]);
    expect(checkReleaseLock(current, EMPTY_LOCK)).toHaveLength(6);
    expect(checkReleaseLock({}, EMPTY_LOCK)).toEqual([]);
  });

  it('Object.prototype anahtarları kilit kaydı sayılmaz', () => {
    const p = checkReleaseLock({ constructor: 'h1:0000000000000001' }, EMPTY_LOCK);
    expect(joined(p)).toContain('kimlik "constructor": onaylı içerik kilitte yok');
  });
});
