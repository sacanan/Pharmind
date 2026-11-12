/**
 * M2-2: gece yarısını geçen oturum, günlük tamamlanma ve ana ekran blister'ı. Gerçek kök yerleşim +
 * gerçek Expo Router + gerçek ProgressProvider. Taklit edilenler: AsyncStorage (bellek içi), yazı
 * tipi yükleyicisi ve YALNIZCA `Date` (sahte saat; zamanlayıcılar ve mikro görevler gerçek kalır).
 */
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { playableCards } from '../../content';
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
const blisterLabel = (r: ReactTestRenderer): string =>
  r.root.findAll(
    (n) => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Günün kartları'),
  )[0].props.accessibilityLabel;

/** Sıradaki kartı doğru cevaplar ve ilerler (son kartta "Oturumu bitir"). */
async function answerCurrent(r: ReactTestRenderer): Promise<void> {
  const card = currentCard(r);
  await settle(() => optionNode(r, card.correctIndex).props.onPress());
  await settle(() => press(r, has(r, 'Oturumu bitir') ? 'Oturumu bitir' : 'Sonraki kart'));
}

const TOTAL = Math.min(5, playableCards.length);

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: [...NOT_DATE], now: at(12, 23, 58) });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mockStore.clear();
  jest.useRealTimers();
});

describe('gece yarısını geçen oturum (M2-2)', () => {
  it('ana sayfaya dönmek yarım oturumu kaybettirmez; oturum kaldığı yerden sürer', async () => {
    const r = await open();
    await settle(() => press(r, 'Oturumu başlat'));
    const first = currentCard(r);
    await answerCurrent(r); // 23:58, 1 kart

    jest.setSystemTime(at(13, 0, 1));
    await settle(() => press(r, 'Kapat')); // ana sayfa; gün değişti
    expect(has(r, 'Oturuma devam et')).toBe(true);
    expect(has(r, 'Oturumu başlat')).toBe(false);
    expect(blisterLabel(r)).toContain('1 doğru');
    expect(screenText(r)).toContain(`1 / ${TOTAL} kart cevaplandı`);

    await settle(() => press(r, 'Oturuma devam et'));
    // Yeni oturum açılmadı: aynı oturumun ikinci kartı gelir, ilk cevap kaybolmadı.
    expect(currentCard(r).id).not.toBe(first.id);
    expect(saved().history).toHaveLength(1);
  });

  it('bitiş gününe bir kez yazılır; tamamlandığı gün blister tüm oturumu gösterir', async () => {
    const r = await open();
    await settle(() => press(r, 'Oturumu başlat'));
    await answerCurrent(r); // 12 Kasım 23:58
    jest.setSystemTime(at(13, 0, 1));
    await settle(() => press(r, 'Kapat'));
    await settle(() => press(r, 'Oturuma devam et'));
    for (let i = 1; i < TOTAL; i++) await answerCurrent(r);

    expect(screenText(r)).toContain('Oturum tamamlandı');
    expect(saved().completedDays).toEqual(['2026-11-13']); // başlangıç günü (12) değil, bitiş günü
    await settle(() => press(r, 'Ana ekrana dön'));
    expect(screenText(r)).toContain('Bugünkü oturum tamam');
    // Oturumun TÜM cevapları (12'sinde verilen dahil) bellekteki oturumdan gösterilir.
    expect(blisterLabel(r)).toContain(`${TOTAL} doğru`);
    expect(blisterLabel(r)).toContain('0 bekliyor');
  });

  it('yeniden açılışta yalnızca o güne ait geçmiş kayıtları gösterilir (belgelenen sınır)', async () => {
    const r = await open();
    await settle(() => press(r, 'Oturumu başlat'));
    await answerCurrent(r); // 12 Kasım
    jest.setSystemTime(at(13, 0, 1));
    await settle(() => press(r, 'Kapat'));
    await settle(() => press(r, 'Oturuma devam et'));
    for (let i = 1; i < TOTAL; i++) await answerCurrent(r);
    await act(async () => renderer?.unmount());
    renderer = null;

    const again = await open(); // uygulama yeniden açıldı: oturum bellekte yok, ilerleme diskten
    expect(screenText(again)).toContain('Bugünkü oturum tamam');
    expect(blisterLabel(again)).toContain(`${TOTAL - 1} doğru`); // 12'sindeki kayıt bugüne sayılmaz
    expect(blisterLabel(again)).toContain('1 bekliyor');
    expect(saved().completedDays).toEqual(['2026-11-13']);
  });
});
