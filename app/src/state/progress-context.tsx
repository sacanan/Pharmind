import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { playableCards } from '../content';
import { applyCase, applyFollowUp } from '../core/case';
import { selectDaily } from '../core/daily';
import { emptyProgress, reviewCard } from '../core/scheduling';
import { loadProgress, saveProgress } from '../core/storage';
import type { Card, CaseRun, Confidence, PatientCase, Progress, ReviewRecord } from '../core/types';
import { dayKey, markSessionComplete } from '../core/weekly';

type SessionAnswer = Pick<ReviewRecord, 'cardId' | 'correct' | 'confidence'>;

export interface Session {
  /** Oturumun başladığı gün (yerel, YYYY-MM-DD); gün değişince eski oturum geçersiz sayılır. */
  day: string;
  cardIds: string[];
  results: SessionAnswer[];
}

interface Store {
  /** Cihazdaki ilerleme okundu mu? */
  ready: boolean;
  progress: Progress;
  session: Session | null;
  startSession: () => void;
  answer: (card: Card, correct: boolean, confidence: Confidence) => void;
  /** Vakayı tamamlar: karar kalitesi ilgili kavramların mastery'sine işlenir. */
  completeCase: (c: PatientCase, run: CaseRun) => void;
  /** "Hasta geri geldi" kararını işler. */
  completeFollowUp: (c: PatientCase, choice: number) => void;
  /** Yalnızca geliştirme için */
  resetAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [session, setSession] = useState<Session | null>(null);
  // Hızlı art arda çağrılarda eski değerle çalışmamak için son ilerleme burada da tutulur.
  const latest = useRef<Progress>(progress);
  const sessionRef = useRef<Session | null>(null);
  // Diskteki kayıt okunamadıysa boş ilerleme onun üzerine yazılmasın.
  const saveBlocked = useRef(false);
  const setSessionBoth = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let alive = true;
    loadProgress(AsyncStorage)
      .then((loaded) => {
        if (!alive) return;
        latest.current = loaded;
        setProgress(loaded);
      })
      .catch(() => {
        saveBlocked.current = true;
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const commit = useCallback((next: Progress) => {
    latest.current = next;
    setProgress(next);
    // Kaydetme başarısız olsa bile uygulama çalışmaya devam eder.
    if (saveBlocked.current) return;
    saveProgress(AsyncStorage, next).catch(() => {});
  }, []);

  const startSession = useCallback(() => {
    const now = new Date();
    const cards = selectDaily(playableCards, latest.current, now);
    setSessionBoth({ day: dayKey(now), cardIds: cards.map((c) => c.id), results: [] });
  }, [setSessionBoth]);

  /**
   * Cevabı işler. Son kartın cevabı oturumu da aynı kayıtta tamamlar; böylece son
   * geri bildirim ekranında uygulamadan çıkılsa bile gün tamamlanmış sayılır.
   */
  const answer = useCallback(
    (card: Card, correct: boolean, confidence: Confidence) => {
      const now = new Date();
      let next = reviewCard(latest.current, card, correct, confidence, now);
      const current = sessionRef.current;
      const updated = current
        ? { ...current, results: [...current.results, { cardId: card.id, correct, confidence }] }
        : current;
      if (updated && updated.results.length >= updated.cardIds.length) {
        next = markSessionComplete(next, now);
      }
      commit(next);
      setSessionBoth(updated);
    },
    [commit, setSessionBoth],
  );

  const completeCase = useCallback(
    (c: PatientCase, run: CaseRun) => {
      commit(applyCase(latest.current, c, run, new Date()));
    },
    [commit],
  );

  const completeFollowUp = useCallback(
    (c: PatientCase, choice: number) => {
      commit(applyFollowUp(latest.current, c, choice, new Date()));
    },
    [commit],
  );

  const resetAll = useCallback(() => {
    setSessionBoth(null);
    commit(emptyProgress());
  }, [commit, setSessionBoth]);

  const value = useMemo<Store>(
    () => ({
      ready,
      progress,
      session,
      startSession,
      answer,
      completeCase,
      completeFollowUp,
      resetAll,
    }),
    [
      ready,
      progress,
      session,
      startSession,
      answer,
      completeCase,
      completeFollowUp,
      resetAll,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore, ProgressProvider içinde kullanılmalı');
  return store;
}
