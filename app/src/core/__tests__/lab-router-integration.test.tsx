/**
 * Gerçek kök yerleşim + gerçek Expo Router + gerçek ProgressProvider ile /lab entegrasyon testi.
 * Taklit edilen tek şey (a) ilerleme deposu (AsyncStorage; yalnızca çağrılar izlenir) ve (b) yazı tipi
 * yükleyicisi (ağ/dosya gerektirir, depolamayla ilgisizdir).
 */
import { router } from 'expo-router';
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { store as routerStore } from 'expo-router/build/global-state/router-store';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import type { ReactTestRenderer } from 'react-test-renderer';
import { BACKUP_KEY, PROGRESS_KEY, serializeProgress } from '../storage';
import { emptyProgress } from '../scheduling';
import { LAB_ACTIVITIES } from '../../prototype/lab-content';
import { act, create, flush, has, press, screenText } from '../../test-support/rtr';

const mockStore = new Map<string, string>();
const mockCalls: { op: string; key?: string }[] = [];
jest.mock('@react-native-async-storage/async-storage', () => {
  const api = {
    getItem: async (key: string) => {
      mockCalls.push({ op: 'get', key });
      return mockStore.has(key) ? (mockStore.get(key) as string) : null;
    },
    setItem: async (key: string, value: string) => {
      mockCalls.push({ op: 'set', key });
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockCalls.push({ op: 'remove', key });
      mockStore.delete(key);
    },
    multiGet: async () => {
      mockCalls.push({ op: 'multiGet' });
      return [];
    },
    multiSet: async () => {
      mockCalls.push({ op: 'multiSet' });
    },
    getAllKeys: async () => {
      mockCalls.push({ op: 'getAllKeys' });
      return [];
    },
    clear: async () => {
      mockCalls.push({ op: 'clear' });
    },
  };
  return { __esModule: true, default: api };
});
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
const pathname = (): string => routerStore.getRouteInfo().pathname;
const calls = (): string[] => mockCalls.map((c) => `${c.op}:${c.key ?? ''}`);
const reads = (): number => mockCalls.filter((c) => c.op.startsWith('get') || c.op === 'multiGet').length;
const writes = (): number => mockCalls.filter((c) => !c.op.startsWith('get') && c.op !== 'multiGet').length;

let renderer: ReactTestRenderer | null = null;
async function open(url: string): Promise<ReactTestRenderer> {
  process.env.EXPO_ROUTER_IMPORT_MODE = 'sync';
  await act(async () => {
    renderer = create(<ExpoRoot context={getMockContext(APP_DIR)} location={url} />);
  });
  await flush();
  return renderer as unknown as ReactTestRenderer;
}
const nav = async (fn: () => void): Promise<void> => {
  await act(async () => fn());
  await flush();
};

function playLabRound(r: ReactTestRenderer, fromIntro: boolean, guess: boolean): void {
  if (fromIntro) press(r, 'Başla');
  if (guess) press(r, 'Tahmin ettim (isteğe bağlı)');
  press(r, 'Yanlış');
  press(r, 'Devam');
  press(r, 'daha yüksek');
  press(r, 'Devam');
  press(r, 'Küçük çalışmalara');
  press(r, 'Devam');
  const match = LAB_ACTIVITIES[3];
  if (match.kind !== 'match') throw new Error('eşleştirme bekleniyordu');
  for (const pair of match.pairs) {
    press(r, pair.left);
    press(r, pair.right);
  }
  press(r, 'Devam');
  press(r, 'Yanlış');
  press(r, 'Sonucu gör');
}

const prevFlag = process.env.EXPO_PUBLIC_LAB;
beforeEach(() => {
  mockStore.clear();
  mockCalls.length = 0;
  process.env.EXPO_PUBLIC_LAB = '1';
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});
afterAll(() => {
  if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_LAB;
  else process.env.EXPO_PUBLIC_LAB = prevFlag;
});

describe('/lab doğrudan açılış: gerçek yerleşim, Router ve sağlayıcı', () => {
  const scenarios: [string, () => void][] = [
    ['boş kayıt', () => {}],
    ['geçerli kayıt', () => void mockStore.set(PROGRESS_KEY, serializeProgress(emptyProgress()))],
    ['bozuk kayıt', () => void mockStore.set(PROGRESS_KEY, '{bozuk json')],
  ];

  it.each(scenarios)('%s: açılış, oyun, tekrar ve kapanış boyunca hiçbir depolama okuması/yazması yok', async (_n, seed) => {
    seed();
    const snapshot = JSON.stringify([...mockStore.entries()]);
    const r = await open('/lab');
    expect(pathname()).toBe('/lab');
    expect(screenText(r)).toContain('Mini oyun denemesi');

    playLabRound(r, true, false);
    expect(screenText(r)).toContain('Tur bitti');
    press(r, 'Tekrar oyna');
    playLabRound(r, false, true);
    expect(screenText(r)).toContain('Tur bitti');
    press(r, 'Çık');
    expect(screenText(r)).toContain('Deneme kapatıldı');
    await flush();

    expect(calls()).toEqual([]);
    expect(JSON.stringify([...mockStore.entries()])).toBe(snapshot);
    expect(mockStore.has(BACKUP_KEY)).toBe(false);
    expect(pathname()).toBe('/lab'); // gerçek uygulamaya gidilmedi
  });

  it('pozitif kontrol: aynı bozuk kayıt gerçek ana sayfada yedekleme yolunu çalıştırır (test bunu görebiliyor)', async () => {
    mockStore.set(PROGRESS_KEY, '{bozuk json');
    await open('/');
    expect(reads()).toBeGreaterThan(0);
    expect(mockStore.get(BACKUP_KEY)).toBe('{bozuk json');
    expect(writes()).toBeGreaterThan(0);
  });
});

describe('gerçek uygulama → /lab → geri dönüş', () => {
  it('sağlayıcı yeniden kurulmaz, gezinme yığını ve süren oturum korunur, ek depolama okuması olmaz', async () => {
    const r = await open('/');
    expect(has(r, 'Oturumu başlat')).toBe(true);
    const readsAfterBoot = reads();
    expect(readsAfterBoot).toBe(1);

    await nav(() => press(r, 'Oturumu başlat'));
    expect(pathname()).toBe('/session');

    await nav(() => router.push('/lab'));
    expect(pathname()).toBe('/lab');
    expect(screenText(r)).toContain('Mini oyun denemesi');
    expect(reads()).toBe(readsAfterBoot);
    const writesBefore = writes();

    await nav(() => router.back());
    expect(pathname()).toBe('/session'); // gezinme yığını sıfırlanmadı
    await nav(() => router.back());
    expect(pathname()).toBe('/');
    expect(has(r, 'Oturuma devam et')).toBe(true); // süren oturum kaybolmadı
    expect(reads()).toBe(readsAfterBoot); // sağlayıcı yeniden yüklenmedi
    expect(writes()).toBe(writesBefore); // lab geçişi yazma üretmedi
  });
});
