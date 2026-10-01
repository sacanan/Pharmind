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
import { applyCase } from '../core/case';
import { selectDaily } from '../core/daily';
import { emptyProgress, reviewCard } from '../core/scheduling';
import { loadProgress, saveProgress } from '../core/storage';
import type { Card, CaseRun, Confidence, PatientCase, Progress, ReviewRecord } from '../core/types';
import { markSessionComplete } from '../core/weekly';

type SessionAnswer = Pick<ReviewRecord, 'cardId' | 'correct' | 'confidence'>;

export interface Session {
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
  finishSession: () => void;
  /** Vakayı tamamlar: karar kalitesi ilgili kavramların mastery'sine işlenir. */
  completeCase: (c: PatientCase, run: CaseRun) => void;
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

  useEffect(() => {
    let alive = true;
    loadProgress(AsyncStorage)
      .then((loaded) => {
        if (!alive) return;
        latest.current = loaded;
        setProgress(loaded);
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
    saveProgress(AsyncStorage, next).catch(() => {});
  }, []);

  const startSession = useCallback(() => {
    const cards = selectDaily(playableCards, latest.current, new Date());
    setSession({ cardIds: cards.map((c) => c.id), results: [] });
  }, []);

  const answer = useCallback(
    (card: Card, correct: boolean, confidence: Confidence) => {
      commit(reviewCard(latest.current, card, correct, confidence, new Date()));
      setSession((s) =>
        s ? { ...s, results: [...s.results, { cardId: card.id, correct, confidence }] } : s,
      );
    },
    [commit],
  );

  const finishSession = useCallback(() => {
    commit(markSessionComplete(latest.current, new Date()));
  }, [commit]);

  const completeCase = useCallback(
    (c: PatientCase, run: CaseRun) => {
      commit(applyCase(latest.current, c, run, new Date()));
    },
    [commit],
  );

  const resetAll = useCallback(() => {
    setSession(null);
    commit(emptyProgress());
  }, [commit]);

  const value = useMemo<Store>(
    () => ({
      ready,
      progress,
      session,
      startSession,
      answer,
      finishSession,
      completeCase,
      resetAll,
    }),
    [ready, progress, session, startSession, answer, finishSession, completeCase, resetAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore, ProgressProvider içinde kullanılmalı');
  return store;
}
