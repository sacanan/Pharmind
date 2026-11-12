/**
 * Gerçek kök yerleşim + gerçek Expo Router + gerçek ProgressProvider ile oturum akışı (M2-1).
 * Taklit edilenler yalnızca AsyncStorage (bellek içi, yazılanlar okunur) ve yazı tipi yükleyicisidir.
 */
import { ExpoRoot } from 'expo-router/build/ExpoRoot';
import { getMockContext } from 'expo-router/build/testing-library/mock-config';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { playableCards } from '../../content';
import { act, create, flush, has, press, screenText } from '../../test-support/rtr';
import { PROGRESS_KEY } from '../storage';
import type { ReviewRecordV2 } from '../types';

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

let renderer: ReactTestRenderer | null = null;
async function open(url: string): Promise<ReactTestRenderer> {
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
const records = (): ReviewRecordV2[] => saved()?.history ?? [];

/** Ekranda görünen kart (isteminden bulunur). */
function currentCard(r: ReactTestRenderer) {
  const text = screenText(r);
  const card = playableCards.find((c) => text.includes(c.prompt));
  if (!card) throw new Error('ekranda kart yok:\n' + text);
  return card;
}

/** Harfli seçenek düğmesi (Option bileşeni; erişilebilirlik etiketi "A, metin"). */
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

const guessChecked = (r: ReactTestRenderer): boolean =>
  r.root.findAll((n) => n.props.accessibilityLabel === 'Tahmin ettim (isteğe bağlı)')[0].props.accessibilityState
    .checked;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mockStore.clear();
});

async function startSession(): Promise<ReactTestRenderer> {
  const r = await open('/');
  await settle(() => press(r, 'Oturumu başlat'));
  return r;
}

describe('oturum: tek dokunuşla cevap ve isteğe bağlı "Tahmin ettim"', () => {
  it('zorunlu güven adımı yoktur; seçenek dokunuşu cevabı hemen kaydeder (bildirim yok → none)', async () => {
    const r = await startSession();
    const text = screenText(r);
    for (const gone of ['Eminim', 'Kararsızım', 'Ne kadar eminsin']) expect(text).not.toContain(gone);
    expect(has(r, 'Tahmin ettim (isteğe bağlı)')).toBe(true);
    expect(records()).toHaveLength(0);

    const card = currentCard(r);
    await settle(() => optionNode(r, card.correctIndex).props.onPress());

    expect(screenText(r)).toContain('Doğru');
    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      recordVersion: 2,
      cardId: card.id,
      correct: true,
      selfReport: 'none',
      optionCount: card.options.length,
      policy: { version: 'v0-experimental', grade: 'Good' },
    });
    expect(records()[0]).not.toHaveProperty('confidence');
  });

  it('"Tahmin ettim" işareti cevapla birlikte kaydolur, sonraki kartta sıfırlanır; yanlışta derece Again kalır', async () => {
    const r = await startSession();
    const first = currentCard(r);
    expect(guessChecked(r)).toBe(false);
    await settle(() => r.root.findAll((n) => n.props.accessibilityLabel === 'Tahmin ettim (isteğe bağlı)')[0].props.onPress());
    expect(guessChecked(r)).toBe(true);
    const wrong = (first.correctIndex + 1) % first.options.length;
    await settle(() => optionNode(r, wrong).props.onPress());
    expect(records()[0]).toMatchObject({ correct: false, selfReport: 'guess', policy: { grade: 'Again' } });

    await settle(() => press(r, 'Sonraki kart'));
    expect(guessChecked(r)).toBe(false);
    const second = currentCard(r);
    await settle(() => r.root.findAll((n) => n.props.accessibilityLabel === 'Tahmin ettim (isteğe bağlı)')[0].props.onPress());
    await settle(() => optionNode(r, second.correctIndex).props.onPress());
    expect(records()[1]).toMatchObject({ cardId: second.id, correct: true, selfReport: 'guess', policy: { grade: 'Hard' } });
  });

  it('hızlı çift dokunuş aynı cevabı iki kez kaydetmez', async () => {
    const r = await startSession();
    const card = currentCard(r);
    const opt = optionNode(r, card.correctIndex);
    // İki dokunuş aynı render'da (state güncellenmeden) gelir.
    await act(async () => {
      opt.props.onPress();
      opt.props.onPress();
    });
    await flush();
    expect(records()).toHaveLength(1);
    expect(Object.keys(saved().cards)).toEqual([card.id]);
    expect(saved().cards[card.id].reps).toBe(1);
  });

  it('her cevap çift dokunuşla gelse bile son cevap günlük tamamlanmayı yalnızca bir kez işler', async () => {
    const r = await startSession();
    let guard = 0;
    while (!screenText(r).includes('Oturum tamamlandı') && guard++ < 20) {
      if (has(r, 'Oturumu bitir')) {
        await settle(() => press(r, 'Oturumu bitir'));
        break;
      }
      if (has(r, 'Sonraki kart')) {
        await settle(() => press(r, 'Sonraki kart'));
        continue;
      }
      const card = currentCard(r);
      const opt = optionNode(r, card.correctIndex);
      await act(async () => {
        opt.props.onPress();
        opt.props.onPress(); // çift dokunuş
      });
      await flush();
    }
    expect(screenText(r)).toContain('Oturum tamamlandı');
    const total = Math.min(5, playableCards.length);
    expect(records()).toHaveLength(total);
    expect(new Set(records().map((x) => x.cardId)).size).toBe(total);
    expect(saved().completedDays).toHaveLength(1);
  });
});
