import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import RootLayout from '../../app/_layout';
import { LAB_ACTIVITIES } from '../../prototype/lab-content';
import { LabFlow } from '../../prototype/ui/LabFlow';
import { isIsolatedLabRoute } from '../lab-route';

// Gerçek ilerleme deposu: prototip akışı boyunca HİÇBİR çağrı yapılmamalı.
const mockStorage = {
  getItem: jest.fn(async (): Promise<string | null> => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
  multiGet: jest.fn(async () => []),
  multiSet: jest.fn(async () => undefined),
  getAllKeys: jest.fn(async () => []),
  clear: jest.fn(async () => undefined),
};
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: mockStorage }));

const mockNav = { replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), back: jest.fn() };
let mockPath = '/lab';
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    router: mockNav,
    Redirect: () => null,
    Stack: ({ children }: { children?: unknown }) => <View>{children as never}</View>,
    usePathname: () => mockPath,
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo-google-fonts/schibsted-grotesk', () => ({
  SchibstedGrotesk_400Regular: 1,
  SchibstedGrotesk_500Medium: 1,
  SchibstedGrotesk_700Bold: 1,
  SchibstedGrotesk_800ExtraBold: 1,
  useFonts: () => [true, null],
}));
const mockProviderPaused: boolean[] = [];
jest.mock('../../state/progress-context', () => ({
  ProgressProvider: ({ children, paused }: { children?: unknown; paused?: boolean }) => {
    mockProviderPaused.push(!!paused);
    return children as never;
  },
}));

declare const process: { env: Record<string, string | undefined> };

const texts = (node: ReactTestInstance): string => {
  const out: string[] = [];
  const walk = (n: ReactTestInstance | string): void => {
    if (typeof n === 'string') out.push(n);
    else n.children.forEach(walk);
  };
  walk(node);
  return out.join(' ').replace(/\s+/g, ' ');
};

/** Etiketi tam eşleşen ilk basılabilir öğe. */
const matches = (text: string, label: string): boolean =>
  text.trim() === label || new RegExp(`^[A-D] ${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(text.trim());

function find(r: ReactTestRenderer, label: string): ReactTestInstance {
  const hit = r.root.findAll(
    (n) => typeof n.props.onPress === 'function' && !n.props.disabled && matches(texts(n), label),
  );
  if (!hit.length) throw new Error(`öğe yok: "${label}"\n${texts(r.root)}`);
  return hit[0];
}
const press = (r: ReactTestRenderer, label: string) => act(() => void find(r, label).props.onPress());
const has = (r: ReactTestRenderer, label: string): boolean =>
  r.root.findAll((n) => typeof n.props.onPress === 'function' && matches(texts(n), label)).length > 0;

function mount(element: React.ReactElement): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(element);
  });
  return r;
}

function storageCalls(): number {
  return Object.values(mockStorage).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPath = '/lab';
});

describe('isIsolatedLabRoute', () => {
  it('yalnızca bayrak "1" ve yol /lab iken true', () => {
    expect(isIsolatedLabRoute('1', '/lab')).toBe(true);
    expect(isIsolatedLabRoute('1', '/lab/')).toBe(true);
    expect(isIsolatedLabRoute('1', '/')).toBe(false);
    expect(isIsolatedLabRoute('1', '/session')).toBe(false);
    expect(isIsolatedLabRoute('1', '/laboratory')).toBe(false);
    expect(isIsolatedLabRoute(undefined, '/lab')).toBe(false);
    expect(isIsolatedLabRoute('0', '/lab')).toBe(false);
    expect(isIsolatedLabRoute('true', '/lab')).toBe(false);
  });
});

describe('kök yerleşim (taklitli birim testi; gerçek Router için lab-router-integration.test.tsx)', () => {
  const pausedFor = (flag: string | undefined, path: string): boolean | undefined => {
    const prev = process.env.EXPO_PUBLIC_LAB;
    if (flag === undefined) delete process.env.EXPO_PUBLIC_LAB;
    else process.env.EXPO_PUBLIC_LAB = flag;
    mockPath = path;
    mockProviderPaused.length = 0;
    try {
      mount(<RootLayout />);
      return mockProviderPaused[mockProviderPaused.length - 1];
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_LAB;
      else process.env.EXPO_PUBLIC_LAB = prev;
    }
  };

  it('sağlayıcı her durumda kurulur; yalnızca bayrak açık + /lab iken duraklatılır', () => {
    expect(pausedFor('1', '/lab')).toBe(true);
    expect(pausedFor('1', '/')).toBe(false);
    expect(pausedFor('1', '/session')).toBe(false);
    expect(pausedFor(undefined, '/lab')).toBe(false);
    expect(pausedFor('0', '/lab')).toBe(false);
  });
});

describe('prototip akışı: baştan sona, depolama ve gezinti izlenerek', () => {
  function playRound(r: ReactTestRenderer, flagFirstGuess = false, fromIntro = true) {
    if (fromIntro) press(r, 'Başla');
    // 1 doğru/yanlış
    if (flagFirstGuess) press(r, 'Tahmin ettim (isteğe bağlı)');
    press(r, 'Yanlış');
    press(r, 'Devam');
    // 2 boşluk doldurma
    press(r, 'daha yüksek');
    press(r, 'Devam');
    // 3 çoktan seçmeli
    press(r, 'Küçük çalışmalara');
    press(r, 'Devam');
    // 4 eşleştirme (sol-sağ metinleri etkinlikten)
    const match = LAB_ACTIVITIES[3];
    if (match.kind !== 'match') throw new Error('eşleştirme bekleniyordu');
    for (const pair of match.pairs) {
      press(r, pair.left);
      press(r, pair.right);
    }
    press(r, 'Devam');
    // 5 doğru/yanlış
    press(r, 'Yanlış');
    press(r, 'Sonucu gör');
  }

  it('beş etkinlik → sonuç → tekrar → ikinci tur → çıkış: depolamaya ve gezintiye hiç dokunulmaz', () => {
    const r = mount(<LabFlow />);
    playRound(r);
    expect(texts(r.root)).toContain('Tur bitti');
    expect(texts(r.root)).toContain('5 etkinliğin 5 tanesini hatasız tamamladın');

    press(r, 'Tekrar oyna');
    // "Tekrar oyna" doğrudan yeni turu açar; açılış ekranı yoktur.
    playRound(r, true, false);
    expect(texts(r.root)).toContain('Tur bitti');

    press(r, 'Çık');
    expect(texts(r.root)).toContain('Deneme kapatıldı');
    expect(texts(r.root)).toContain('gerçek uygulamaya geçiş yoktur');

    expect(storageCalls()).toBe(0);
    expect(mockNav.replace).not.toHaveBeenCalled();
    expect(mockNav.push).not.toHaveBeenCalled();
    expect(mockNav.navigate).not.toHaveBeenCalled();
  });

  it('"Kapat" oyun ortasında da demo içinde kalır; kapanış ekranından yeniden açılabilir', () => {
    const r = mount(<LabFlow />);
    press(r, 'Başla');
    press(r, 'Kapat');
    expect(texts(r.root)).toContain('Deneme kapatıldı');
    expect(has(r, 'Baştan aç')).toBe(true);
    // Kapanış ekranında gerçek uygulamaya götüren hiçbir düğme yok.
    const labels = r.root.findAll((n) => typeof n.props.onPress === 'function').map((n) => texts(n).trim());
    expect([...new Set(labels.filter(Boolean))]).toEqual(['Baştan aç']);
    press(r, 'Baştan aç');
    expect(texts(r.root)).toContain('Mini oyun denemesi');
    expect(storageCalls()).toBe(0);
    expect(mockNav.replace).not.toHaveBeenCalled();
  });

  it('mevcut ve bozuk ilerleme kayıtları prototipi etkilemez ve kayıtlar okunmaz/yazılmaz', () => {
    mockStorage.getItem.mockImplementation(async () => '{bozuk json');
    const r1 = mount(<LabFlow />);
    playRound(r1);
    mockStorage.getItem.mockImplementation(async () => JSON.stringify({ version: 1, cards: { x: 1 } }));
    const r2 = mount(<LabFlow />);
    playRound(r2);
    expect(texts(r1.root)).toContain('Tur bitti');
    expect(texts(r2.root)).toContain('Tur bitti');
    expect(storageCalls()).toBe(0);
  });

  it('yerleşim ile birlikte akış çalışır ve depolamaya dokunmaz', () => {
    const prev = process.env.EXPO_PUBLIC_LAB;
    process.env.EXPO_PUBLIC_LAB = '1';
    try {
      mount(<RootLayout />);
      mount(<LabFlow />);
    } finally {
      if (prev === undefined) delete process.env.EXPO_PUBLIC_LAB;
      else process.env.EXPO_PUBLIC_LAB = prev;
    }
    expect(storageCalls()).toBe(0);
  });
});
