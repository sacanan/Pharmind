import type { Card as FsrsCard } from 'ts-fsrs';
import { emptyProgress } from './scheduling';
import type { Progress } from './types';

/** AsyncStorage ile aynı arayüz; testte bellek içi bir sahte ile değiştirilebilir. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const PROGRESS_KEY = 'pharmind:v1:progress';

export function serializeProgress(progress: Progress): string {
  return JSON.stringify(progress);
}

type StoredCard = Omit<FsrsCard, 'due' | 'last_review'> & {
  due: string;
  last_review?: string;
};

/** Bozuk veya uyumsuz kayıtta uygulama çökmesin diye boş ilerlemeye düşer. */
export function deserializeProgress(raw: string | null): Progress {
  if (!raw) return emptyProgress();
  try {
    const data = JSON.parse(raw) as Progress | null;
    if (!data || data.version !== 1 || typeof data.cards !== 'object') return emptyProgress();
    const cards: Record<string, FsrsCard> = {};
    for (const [id, stored] of Object.entries(data.cards as unknown as Record<string, StoredCard>)) {
      cards[id] = {
        ...stored,
        due: new Date(stored.due),
        last_review: stored.last_review ? new Date(stored.last_review) : undefined,
      };
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
    return emptyProgress();
  }
}

export async function loadProgress(store: KeyValueStore): Promise<Progress> {
  return deserializeProgress(await store.getItem(PROGRESS_KEY));
}

export async function saveProgress(store: KeyValueStore, progress: Progress): Promise<void> {
  await store.setItem(PROGRESS_KEY, serializeProgress(progress));
}
