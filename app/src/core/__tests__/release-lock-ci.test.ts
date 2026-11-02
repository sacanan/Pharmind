import { EMPTY_LOCK, approvedPack, lockFor } from '../testing/helpers';
import { compareLockFiles, validatePackForRelease, type ReleaseLock } from '../validate-pack';

// Node tipleri tsconfig'te yüklü değil; yalnızca CI adımının ihtiyacı olan yüzey bildirilir.
declare const process: { env: Record<string, string | undefined> };
declare const require: (name: string) => {
  readFileSync(path: string, encoding: string): string;
  existsSync(path: string): boolean;
};

const text = (lock: ReleaseLock): string => JSON.stringify(lock, null, 2);
const joined = (p: string[]): string => p.join(' | ');

describe('compareLockFiles: CI karşılaştırması (hedef dal ↔ değişiklik)', () => {
  const v1 = approvedPack();
  const lock1 = lockFor(v1);

  it('değişiklik yoksa ve yeni kayıt eklenirse geçer', () => {
    expect(compareLockFiles(text(lock1), text(lock1))).toEqual([]);
    const grown: ReleaseLock = { ...lock1, items: { ...lock1.items, 'syn-k-099': 'h1:00000000000000aa' } };
    expect(compareLockFiles(text(lock1), text(grown))).toEqual([]);
  });

  it('SENARYO A: kilitten kayıt doğrudan silinirse başarısız olur', () => {
    const next: ReleaseLock = { ...lock1, items: { ...lock1.items } };
    delete next.items['syn-k-001'];
    const p = compareLockFiles(text(lock1), text(next));
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('kilit kaydı silinmiş: "syn-k-001"');
  });

  it('SENARYO B: içerik ve kilit kaydı birlikte silinirse de başarısız olur', () => {
    const v2 = approvedPack();
    v2.cards = v2.cards.filter((c) => c.id !== 'syn-k-002'); // içerik silindi
    const lock2 = lockFor(v2); // kilit yalnızca güncel içerikten yeniden üretildi → kayıt da gitti
    // Tek başına yayın kapısı sorun görmez: silme "tutarlı" görünür.
    expect(validatePackForRelease(v2, lock2)).toEqual([]);
    // Önceki kilitle karşılaştırma yakalar.
    const p = compareLockFiles(text(lock1), text(lock2));
    expect(joined(p)).toContain('kilit kaydı silinmiş: "syn-k-002"');
  });

  it('eski kaydın özeti değiştirilirse başarısız olur', () => {
    const next: ReleaseLock = { ...lock1, items: { ...lock1.items, 'syn-k-001': 'h1:ffffffffffffffff' } };
    expect(joined(compareLockFiles(text(lock1), text(next)))).toContain('kilit kaydı değiştirilmiş: "syn-k-001"');
  });

  it('kilit tamamen boşaltılırsa her eski kayıt için başarısız olur', () => {
    expect(compareLockFiles(text(lock1), text(EMPTY_LOCK))).toHaveLength(Object.keys(lock1.items).length);
  });

  it('dosya hedef dalda henüz yoksa (null) boş kilit sayılır', () => {
    expect(compareLockFiles(null, text(EMPTY_LOCK))).toEqual([]);
    expect(compareLockFiles(null, text(lock1))).toEqual([]);
  });

  it('dosya değişiklikte silinmişse başarısız olur', () => {
    expect(joined(compareLockFiles(text(lock1), null))).toContain('kilit dosyası yok');
    expect(compareLockFiles(null, null)).toHaveLength(1);
  });

  it.each([
    ['önceki bozuk JSON', '{', text(lock1), 'önceki'],
    ['yeni bozuk JSON', text(lock1), 'not json', 'yeni'],
    ['yeni geçersiz biçim', text(lock1), '{"lockVersion":2,"items":{}}', 'yeni'],
    ['önceki geçersiz özet', '{"lockVersion":1,"items":{"a":"x"}}', text(lock1), 'önceki'],
  ])('%s: istisna fırlatmaz, başarısız olur', (_n, prev, next, who) => {
    let p: string[] = [];
    expect(() => {
      p = compareLockFiles(prev, next);
    }).not.toThrow();
    expect(joined(p)).toContain(who);
  });
});

/**
 * GERÇEK CI ADIMI. GitHub Actions bu dosyayı RELEASE_LOCK_CI=1 ile çalıştırır:
 * LOCK_BASE_FILE = hedef daldaki (main) release-lock.json'ın kopyası (dalda yoksa dosya hiç yazılmaz),
 * LOCK_NEXT_FILE = değişikliğin kilit dosyası (varsayılan: çalışma ağacındaki dosya).
 * Ortam değişkeni yoksa (yerel `npm test`) bu adım atlanır; CI'da ise tanımsız olması hatadır.
 */
describe('CI: pull request kilidi hedef daldakiyle uyumlu', () => {
  it('önceki kilit kayıtları silinmemiş ve değişmemiş', () => {
    const base = process.env.LOCK_BASE_FILE;
    if (!base) {
      if (process.env.RELEASE_LOCK_CI === '1') throw new Error('RELEASE_LOCK_CI=1 iken LOCK_BASE_FILE tanımlı olmalı');
      return;
    }
    const fs = require('fs');
    const nextPath = process.env.LOCK_NEXT_FILE ?? 'src/content/release-lock.json';
    const previous = fs.existsSync(base) ? fs.readFileSync(base, 'utf8') : null;
    const next = fs.existsSync(nextPath) ? fs.readFileSync(nextPath, 'utf8') : null;
    expect(compareLockFiles(previous, next)).toEqual([]);
  });
});
