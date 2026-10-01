import type { Card as FsrsCard } from 'ts-fsrs';
import { emptyProgress } from './scheduling';
import type { Progress } from './types';

/** AsyncStorage ile aynı arayüz; testte bellek içi bir sahte ile değiştirilebilir. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const PROGRESS_KEY = 'pharmind:v1:progress';
/** Okunamayan kaydın ham kopyası; boş ilerleme üzerine yazılırken veri tamamen kaybolmasın. */
export const BACKUP_KEY = 'pharmind:v1:progress:unreadable';

export function serializeProgress(progress: Progress): string {
  return JSON.stringify(progress);
}

type StoredCard = Omit<FsrsCard, 'due' | 'last_review'> & {
  due: string;
  last_review?: string;
};

/**
 * Kaydı okur; kayıt yoksa, okunamıyorsa veya sürümü uyumsuzsa null döner.
 * Tek bir bozuk kart girdisi tüm ilerlemeyi götürmesin diye o kart atlanır.
 */
function parseProgress(raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Progress | null;
    if (!data || data.version !== 1 || !data.cards || typeof data.cards !== 'object') return null;
    const cards: Record<string, FsrsCard> = {};
    for (const [id, stored] of Object.entries(data.cards as unknown as Record<string, StoredCard>)) {
      try {
        const due = new Date(stored.due);
        const lastReview = stored.last_review ? new Date(stored.last_review) : undefined;
        if (Number.isNaN(due.getTime()) || (lastReview && Number.isNaN(lastReview.getTime()))) {
          continue;
        }
        cards[id] = { ...stored, due, last_review: lastReview };
      } catch {
        // bozuk kart girdisini atla
      }
    }
    return {
      version: 1,
      cards,
      history: Array.isArray(data.history) ? data.history : [],
      completedDays: Array.isArray(data.completedDays) ? data.completedDays : [],
      // Vaka özelliğinden önce kaydedilmiş ilerlemede bu alan yoktur.
      caseResults:
        data.caseResults && typeof data.caseResults === 'object' && !Array.isArray(data.caseResults)
          ? data.caseResults
          : {},
    };
  } catch {
    return null;
  }
}

/** Bozuk veya uyumsuz kayıtta uygulama çökmesin diye boş ilerlemeye düşer. */
export function deserializeProgress(raw: string | null): Progress {
  return parseProgress(raw) ?? emptyProgress();
}

export async function loadProgress(store: KeyValueStore): Promise<Progress> {
  const raw = await store.getItem(PROGRESS_KEY);
  const parsed = parseProgress(raw);
  if (!parsed && raw) {
    // Kayıt var ama okunamadı: boş ilerleme bunun üzerine yazacak, önce ham kopyayı sakla.
    await store.setItem(BACKUP_KEY, raw).catch(() => {});
  }
  return parsed ?? emptyProgress();
}

export async function saveProgress(store: KeyValueStore, progress: Progress): Promise<void> {
  await store.setItem(PROGRESS_KEY, serializeProgress(progress));
}
