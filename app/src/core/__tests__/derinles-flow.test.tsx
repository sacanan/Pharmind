/**
 * M2-4: Derinleş oturumu, Temel oturumla birlikte. Gerçek kök yerleşim + Expo Router + ProgressProvider.
 * Taklitler: AsyncStorage (bellek içi), yazı tipi yükleyicisi, `Date` (yalnızca sahte saat) ve içerik
 * modülünün Derinleş listesi (SENTETİK kartlar YALNIZCA bu testte; üretim havuzuna eklenmedi).
 */
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { playableCards } from '../../content';
import type { Card } from '../types';
import { act, create, flush, has, press, screenText } from '../../test-support/rtr';
import { PROGRESS_KEY } from '../storage';

const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (k: string) => (mockStore.has(k) ? (mockStore.get(k) as string) : null),
    setItem: async (k: string, v: string) => void mockStore.set(k, v),
    removeItem: async (k: string) => void mockStore.delete(k),
  },
}));
jest.mock('@expo-google-fonts/schibsted-grotesk', () => ({
  SchibstedGrotesk_400Regular: 1,
  SchibstedGrotesk_500Medium: 1,
  SchibstedGrotesk_700Bold: 1,
  SchibstedGrotesk_800ExtraBold: 1,
  useFonts: () => [true, null],
}));
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  createURL: (p: string) => 'pharmind://' + p,
  resolveScheme: () => 'pharmind',
  addEventListener: () => ({ remove() {} }),
}));


// Sahte içerik modülü: Derinleş listeleri TEK diziler olarak verilir ve testlerde yerinde değiştirilir
// (getter/yeniden atama yerine; Babel birlikte çalışma katmanı nesneyi kopyalasa da dizi referansı aynı kalır).
jest.mock('../../content', () => {
  const actual = jest.requireActual('../../content');
  const deepArr: unknown[] = [];
  const playable: unknown[] = [...actual.playableCards];
  return {
    ...actual,
    __esModule: true,
    concepts: [...actual.concepts, { id: 'x1', name: 'Derin kavram X' }, { id: 'x2', name: 'Derin kavram Y' }],
    playableCards: playable,
    derinlesPlayableCards: deepArr,
    derinlesMasteryCards: deepArr,
    __setDeep(cards: unknown[]) {
      playable.splice(actual.playableCards.length);
      playable.push(...cards);
      deepArr.length = 0;
      deepArr.push(...cards);
    },
  };
});
const setDeep = (cards: Card[]): void => {
  (jest.requireMock('../../content') as { __setDeep: (c: Card[]) => void }).__setDeep(cards);
};
const deepNow = (): Card[] => (jest.requireMock('../../content') as { derinlesPlayableCards: Card[] }).derinlesPlayableCards;
declare const process: { env: Record<string, string | undefined> };
declare const __dirname: string;
const APP_DIR = `${__dirname}/../../app`;

const NOT_DATE = [
  'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
  'clearInterval', 'setTimeout', 'clearTimeout',
] as const;
const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m); // yerel saat

let renderer: ReactTestRenderer | null = null;
async function open(url = '/'): Promise<ReactTestRenderer> {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  await act(async () => {
    renderer = create(<ExpoRoot context={getMockContext(APP_DIR)} location={url} />);
  });
  await flush();
  return renderer as unknown as ReactTestRenderer;
}
const settle = async (fn: () => void): Promise<void> => {
  await act(async () => fn());
  await flush();
};
const saved = () => JSON.parse(mockStore.get(PROGRESS_KEY) ?? 'null');

function currentCard(r: ReactTestRenderer) {
  const text = screenText(r);
  const card = playableCards.find((c) => text.includes(c.prompt));
  if (!card) throw new Error('ekranda kart yok:\n' + text);
  return card;
}
function optionNode(r: ReactTestRenderer, index: number): ReactTestInstance {
  const letter = ['A', 'B', 'C', 'D', 'E', 'F'][index];
  const hit = r.root.findAll(
    (n) =>
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(`${letter}, `),
  );
  if (!hit.length) throw new Error(`seçenek yok: ${letter}`);
  return hit[0];
}
/** Ana ekran/oturum blister'ının ekran okuyucu açıklaması. */
const blisterLabel = (r: ReactTestRenderer): string => {
  const all = r.root.findAll(
    (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Günün kartları'),
  );
  return all[all.length - 1].props.accessibilityLabel; // en üstteki ekran
};

const TOTAL = Math.min(5, playableCards.length);

const deep = (concept: string, n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `deep-${concept}-${i}`,
    level: 'derinles' as const,
    conceptIds: [concept],
    prompt: `Derin soru ${concept}-${i}`,
    options: ['Doğru', 'Yanlış 1', 'Yanlış 2', 'Yanlış 3'],
    correctIndex: 0,
    explanation: 'Sentetik test kartı.',
    source: 'test (sentetik)',
    reviewedAt: '2026-11-01',
    status: 'demo' as const,
  }));

/** Derinleş oturumunda sıradaki kartı doğru/yanlış cevaplar ve ilerler. */
async function answerDeep(r: ReactTestRenderer, correct = true): Promise<void> {
  const text = screenText(r);
  const c = deepNow().find((x) => text.includes(x.prompt));
  if (!c) throw new Error('Derinleş kartı yok:\n' + text);
  await settle(() => optionNode(r, correct ? 0 : 1).props.onPress());
  await settle(() => press(r, has(r, 'Oturumu bitir') ? 'Oturumu bitir' : 'Sonraki kart'));
}
async function answerTemel(r: ReactTestRenderer): Promise<void> {
  const card = currentCard(r);
  await settle(() => optionNode(r, card.correctIndex).props.onPress());
  await settle(() => press(r, has(r, 'Oturumu bitir') ? 'Oturumu bitir' : 'Sonraki kart'));
}
const kinds = (): string[] => saved().history.map((x: { sessionKind?: string }) => x.sessionKind);

beforeEach(() => {
  setDeep([]);
  jest.useFakeTimers({ doNotFake: [...NOT_DATE], now: at(12, 10, 0) });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mockStore.clear();
  jest.useRealTimers();
});

describe('Derinleş girişi ve uygun kart sayısı', () => {
  it('içerik yokken de görünür ve tıklanabilir; açıklayıcı boş durum, oturum ve gün tamamlanması yok', async () => {
    const r = await open();
    expect(has(r, 'Derinleş')).toBe(true);
    await settle(() => press(r, 'Derinleş'));
    expect(screenText(r)).toContain('Henüz Derinleş içeriği yok');
    expect(has(r, 'Ana ekrana dön')).toBe(true);
    expect(mockStore.get(PROGRESS_KEY)).toBeUndefined(); // hiçbir şey yazılmadı
  });

  it.each([
    [1, 1],
    [4, 4],
    [7, 5],
  ])('%i uygun kartla oturum %i kartlık açılır, sayı başlamadan gösterilir', async (n, size) => {
    setDeep(deep('x1', n));
    const r = await open();
    await settle(() => press(r, 'Derinleş'));
    expect(screenText(r)).toContain(`${n} Derinleş kartı; bu oturumda ${size} kart`);
    await settle(() => press(r, 'Başla: Derin kavram X'));
    expect(blisterLabel(r)).toContain(`${size} bekliyor`); // oturumun TÜM kartları (sıradaki dahil)
  });

  it('seçilen set tamamlanınca (yanlış cevaplarla da) gün bir kez yazılır; kayıtlar Derinleş türündedir', async () => {
    setDeep(deep('x1', 2));
    const r = await open();
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    await answerDeep(r, false);
    expect(saved()?.completedDays ?? []).toEqual([]); // set bitmeden gün yok
    await answerDeep(r, false);
    expect(screenText(r)).toContain('Derinleş oturumu tamamlandı');
    expect(saved().completedDays).toEqual(['2026-11-12']);
    expect(kinds()).toEqual(['derinles', 'derinles']);
    expect(saved().history.every((x: { correct: boolean }) => x.correct === false)).toBe(true);
  });
});

describe('iki oturum türü bir arada', () => {
  it('Temel → Derinleş → Temel: yarım oturumlar ayrı korunur, hiçbiri silinmez', async () => {
    setDeep(deep('x1', 3));
    const r = await open();
    await settle(() => press(r, 'Oturumu başlat'));
    await answerTemel(r); // Temel 1/5
    await settle(() => press(r, 'Kapat'));
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    await answerDeep(r); // Derinleş 1/3
    await settle(() => press(r, 'Kapat'));
    await settle(() => press(r, 'Ana ekrana dön')); // derinles ekranından ana ekrana

    expect(has(r, 'Oturuma devam et')).toBe(true); // Temel yarım
    expect(screenText(r)).toContain(`1 / ${TOTAL} kart cevaplandı`);
    expect(screenText(r)).toContain('Yarım oturum var: 1 / 3 kart'); // Derinleş yarım
    await settle(() => press(r, 'Oturuma devam et'));
    await answerTemel(r); // Temel 2/5
    expect(kinds()).toEqual(['temel', 'derinles', 'temel']);
    await settle(() => press(r, 'Kapat'));
    await settle(() => press(r, 'Derinleş'));
    expect(screenText(r)).toContain('Devam eden oturum: Derin kavram X');
    expect(screenText(r)).toContain('1 / 3 kart cevaplandı');
  });

  it('Derinleş günlük hedefi tamamlar; yarım Temel sürdürülür ve tamamlanmış gibi gösterilmez; gün tek kez yazılır', async () => {
    setDeep(deep('x1', 1));
    const r = await open();
    await settle(() => press(r, 'Oturumu başlat'));
    await answerTemel(r); // Temel 1/5
    await settle(() => press(r, 'Kapat'));
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    await answerDeep(r); // Derinleş tamam
    expect(saved().completedDays).toEqual(['2026-11-12']);
    await settle(() => press(r, 'Ana ekrana dön')); // oturum ekranından derinles ekranına
    await settle(() => press(r, 'Ana ekrana dön'));

    expect(screenText(r)).not.toContain('Bugünkü oturum tamam');
    expect(screenText(r)).toContain('Günlük hedef Derinleş ile tamamlandı');
    expect(has(r, 'Oturuma devam et')).toBe(true);
    await settle(() => press(r, 'Oturuma devam et'));
    for (let i = 1; i < TOTAL; i++) await answerTemel(r);
    expect(saved().completedDays).toEqual(['2026-11-12']); // iki tür, tek günlük kayıt
    await settle(() => press(r, 'Ana ekrana dön'));
    expect(screenText(r)).toContain('Bugünkü oturum tamam');
  });

  it('başka kavrama geçmek yarım oturumu sessizce silmez: devam, vazgeç veya açık yeniden başlatma', async () => {
    setDeep([...deep('x1', 3), ...deep('x2', 3)]);
    const r = await open();
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    await answerDeep(r);
    await settle(() => press(r, 'Kapat'));

    await settle(() => press(r, 'Başla: Derin kavram Y'));
    expect(screenText(r)).toContain('yarım oturum silinir');
    await settle(() => press(r, 'Vazgeç'));
    expect(screenText(r)).toContain('Devam eden oturum: Derin kavram X');
    expect(screenText(r)).toContain('1 / 3 kart cevaplandı'); // silinmedi

    await settle(() => press(r, 'Devam et: Derin kavram X')); // aynı kavram: sormadan devam
    expect(screenText(r)).toContain('Derin soru x1-');
    await settle(() => press(r, 'Kapat'));

    await settle(() => press(r, 'Başla: Derin kavram Y'));
    await settle(() => press(r, 'Yeni oturumu başlat, yarım oturum silinsin'));
    expect(screenText(r)).toContain('Derin soru x2-');
  });

  it('yeniden açılışta Temel blister ve tamamlanma yalnızca Temel kayıtlardan kurulur; Derinleş kayıtları karışmaz', async () => {
    setDeep(deep('x1', 2));
    const r = await open();
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    await answerDeep(r);
    await answerDeep(r); // hedef Derinleş ile tamam, Temel hiç başlamadı
    await act(async () => renderer?.unmount());
    renderer = null;

    const first = await open();
    expect(kinds()).toEqual(['derinles', 'derinles']);
    expect(blisterLabel(first)).toContain(`0 doğru`);
    expect(blisterLabel(first)).toContain(`${TOTAL} bekliyor`); // Derinleş kayıtları Temel blister'ına girmedi
    expect(screenText(first)).not.toContain('Bugünkü oturum tamam');
    expect(has(first, 'Oturumu başlat')).toBe(true);

    await settle(() => press(first, 'Oturumu başlat'));
    for (let i = 0; i < TOTAL; i++) await answerTemel(first);
    await act(async () => renderer?.unmount());
    renderer = null;

    const second = await open();
    expect(kinds()).toEqual(['derinles', 'derinles', ...Array(TOTAL).fill('temel')]);
    expect(blisterLabel(second)).toContain(`${TOTAL} doğru`); // yalnızca Temel kayıtlar (7 değil)
    expect(blisterLabel(second)).toContain('0 bekliyor');
    expect(screenText(second)).toContain('Bugünkü oturum tamam');
    expect(saved().completedDays).toEqual(['2026-11-12']);
  });
});

describe('çift dokunuş ve gece yarısı (Derinleş)', () => {
  it('hızlı çift dokunuş aynı Derinleş cevabını iki kez kaydetmez', async () => {
    setDeep(deep('x1', 2));
    const r = await open();
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    const opt = optionNode(r, 0);
    await act(async () => {
      opt.props.onPress();
      opt.props.onPress();
    });
    await flush();
    expect(saved().history).toHaveLength(1);
  });

  it('gece yarısını geçen Derinleş oturumu bitiş gününe yazılır ve devam eder', async () => {
    jest.setSystemTime(at(12, 23, 58));
    setDeep(deep('x1', 2));
    const r = await open();
    await settle(() => press(r, 'Derinleş'));
    await settle(() => press(r, 'Başla: Derin kavram X'));
    await answerDeep(r);
    jest.setSystemTime(at(13, 0, 1));
    await settle(() => press(r, 'Kapat'));
    expect(screenText(r)).toContain('Devam eden oturum: Derin kavram X'); // kaybolmadı
    await settle(() => press(r, 'Oturuma devam et'));
    await answerDeep(r);
    expect(saved().completedDays).toEqual(['2026-11-13']);
  });
});
