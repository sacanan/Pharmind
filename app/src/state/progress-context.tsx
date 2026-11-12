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
import { derinlesMasteryCards, derinlesPlayableCards, temelMasteryCards, temelPlayableCards } from '../content';
import { selectDerinles } from '../core/derinles';
import { applyCase, applyFollowUp } from '../core/case';
import { DAILY_SIZE, selectDaily } from '../core/daily';
import { emptyProgress, reviewCard } from '../core/scheduling';
import { loadProgress, saveProgress } from '../core/storage';
import type { Card, CaseRun, PatientCase, Progress, SelfReport, SessionKind } from '../core/types';
import { dayKey, markSessionComplete } from '../core/weekly';

/** Oturum içinde tutulan cevap (yeni kayıt türünün alt kümesi). */
interface SessionAnswer {
  cardId: string;
  correct: boolean;
  selfReport: SelfReport;
}

export interface Session {
  /** Oturum türü: Günlük (Temel) veya Derinleş. */
  kind: SessionKind;
  /** Derinleş oturumunda seçilen kavram. */
  conceptId?: string;
  /**
   * Oturumun BAŞLADIĞI gün (yerel, YYYY-MM-DD). Yalnızca bilgi içindir: oturumu geçersiz kılmaz,
   * günlük tamamlanmayı belirlemez. Gece yarısını geçen yarım oturum devam eder.
   */
  day: string;
  cardIds: string[];
  results: SessionAnswer[];
  /** Oturumu tamamlayan son cevabın yerel günü (günlük tamamlanmanın yazıldığı gün). Kalıcı değildir. */
  completedDay?: string;
}

interface Store {
  /** Cihazdaki ilerleme okundu mu? */
  ready: boolean;
  progress: Progress;
  /** Günlük (Temel) oturum. */
  session: Session | null;
  /** Derinleş oturumu. Temel oturumdan ayrı, bellekte tutulur; biri diğerinin üzerine yazılmaz. */
  derinlesSession: Session | null;
  startSession: () => void;
  /**
   * Seçilen kavram için Derinleş oturumu açar (mevcut Derinleş oturumunun yerine geçer; çağıran, yarım
   * oturumu silmeden önce kullanıcıya sormakla yükümlüdür). Uygun kart yoksa oturum AÇILMAZ ve false döner.
   */
  startDerinlesSession: (conceptId: string) => boolean;
  /**
   * Oturumdaki sıradaki kartın cevabını işler. Sıradaki kart dışındaki (örn. aynı kartın hızlı çift
   * dokunuşuyla gelen ikinci) çağrılar yok sayılır: aynı cevap iki kez kaydedilmez.
   */
  answer: (card: Card, correct: boolean, selfReport: SelfReport, kind?: SessionKind) => void;
  /** Vakayı tamamlar: karar kalitesi ilgili kavramların mastery'sine işlenir. */
  completeCase: (c: PatientCase, run: CaseRun) => void;
  /** "Hasta geri geldi" kararını işler. */
  completeFollowUp: (c: PatientCase, choice: number) => void;
  /** Yalnızca geliştirme için */
  resetAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

/**
 * `paused`: kök yerleşimde prototip (/lab) rotası açıkken true olur. Sağlayıcı yine de yerinde kalır
 * (ağaç değişmediği için gezinme yığını ve süren oturum sıfırlanmaz), ama duraklatılmışken diskten
 * okuma yapmaz. İlk yükleme, ilk kez duraklatılmamış olunduğunda bir kez yapılır.
 */
export function ProgressProvider({ children, paused = false }: { children: ReactNode; paused?: boolean }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [sessions, setSessions] = useState<Record<SessionKind, Session | null>>({ temel: null, derinles: null });
  // Hızlı art arda çağrılarda eski değerle çalışmamak için son ilerleme burada da tutulur.
  const latest = useRef<Progress>(progress);
  const sessionsRef = useRef<Record<SessionKind, Session | null>>({ temel: null, derinles: null });
  // Diskteki kayıt okunamadıysa boş ilerleme onun üzerine yazılmasın.
  const saveBlocked = useRef(false);
  /** Yalnızca verilen türün oturumunu değiştirir; diğer tür korunur. */
  const setSessionOf = useCallback((kind: SessionKind, next: Session | null) => {
    sessionsRef.current = { ...sessionsRef.current, [kind]: next };
    setSessions(sessionsRef.current);
  }, []);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadStarted = useRef(false);
  useEffect(() => {
    if (paused || loadStarted.current) return;
    loadStarted.current = true;
    loadProgress(AsyncStorage)
      .then((loaded) => {
        if (!mounted.current) return;
        latest.current = loaded;
        setProgress(loaded);
      })
      .catch(() => {
        saveBlocked.current = true;
      })
      .finally(() => mounted.current && setReady(true));
  }, [paused]);

  const commit = useCallback((next: Progress) => {
    latest.current = next;
    setProgress(next);
    // Kaydetme başarısız olsa bile uygulama çalışmaya devam eder.
    if (saveBlocked.current) return;
    saveProgress(AsyncStorage, next).catch(() => {});
  }, []);

  const startSession = useCallback(() => {
    const now = new Date();
    const cards = selectDaily(temelPlayableCards, latest.current, now, DAILY_SIZE, temelMasteryCards);
    setSessionOf('temel', { kind: 'temel', day: dayKey(now), cardIds: cards.map((c) => c.id), results: [] });
  }, [setSessionOf]);

  const startDerinlesSession = useCallback(
    (conceptId: string): boolean => {
      const now = new Date();
      const cards = selectDerinles(derinlesPlayableCards, conceptId, latest.current, now, derinlesMasteryCards);
      if (cards.length === 0) return false;
      setSessionOf('derinles', {
        kind: 'derinles',
        conceptId,
        day: dayKey(now),
        cardIds: cards.map((c) => c.id),
        results: [],
      });
      return true;
    },
    [setSessionOf],
  );

  /**
   * Cevabı işler. Son kartın cevabı oturumu da aynı kayıtta tamamlar; böylece son
   * geri bildirim ekranında uygulamadan çıkılsa bile gün tamamlanmış sayılır.
   */
  const answer = useCallback(
    (card: Card, correct: boolean, selfReport: SelfReport, kind: SessionKind = 'temel') => {
      const now = new Date();
      const current = sessionsRef.current[kind];
      // Senkron kontrol (ref): iki hızlı dokunuş aynı render'da gelse bile ikincisi sıradaki kart olmaktan çıkmıştır.
      if (current && current.cardIds[current.results.length] !== card.id) return;
      let next = reviewCard(latest.current, card, correct, selfReport, now, kind);
      const updated = current
        ? { ...current, results: [...current.results, { cardId: card.id, correct, selfReport }] }
        : current;
      let nextSession = updated;
      if (updated && updated.cardIds.length > 0 && updated.results.length >= updated.cardIds.length) {
        next = markSessionComplete(next, now);
        nextSession = { ...updated, completedDay: dayKey(now) };
      }
      commit(next);
      setSessionOf(kind, nextSession);
    },
    [commit, setSessionOf],
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
    setSessionOf('temel', null);
    setSessionOf('derinles', null);
    commit(emptyProgress());
  }, [commit, setSessionOf]);

  const value = useMemo<Store>(
    () => ({
      ready,
      progress,
      session: sessions.temel,
      derinlesSession: sessions.derinles,
      startSession,
      startDerinlesSession,
      answer,
      completeCase,
      completeFollowUp,
      resetAll,
    }),
    [
      ready,
      progress,
      sessions,
      startSession,
      startDerinlesSession,
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
