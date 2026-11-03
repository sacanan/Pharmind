import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Blister } from '../../ui/Blister';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { space, type } from '../../ui/theme';
import {
  answerChoice,
  cellOf,
  currentActivity,
  feedbackTitle,
  isMatchDone,
  isRunDone,
  matchOutcome,
  pickItem,
  recordOutcome,
  runCells,
  startMatch,
  startRun,
  summarizeRun,
  type LabRun,
  type MatchSide,
  type MatchState,
} from '../engine';
import { LAB_ACTIVITIES, LAB_SOURCE } from '../lab-content';
import type { LabActivity, Outcome } from '../types';
import { ChoiceView } from './ChoiceView';
import { MatchView } from './MatchView';
import { FeedbackPanel, NoticeBar } from './Parts';
import { ResultView } from './ResultView';

type Stage = 'intro' | 'play' | 'result' | 'closed';

interface Pending {
  activityId: string;
  outcome: Outcome;
  /** Seçimli etkinlikte seçilen seçenek */
  selected: number | null;
}

const activities = LAB_ACTIVITIES;
const MATCH_SEED_BASE = 1234;

/**
 * M1 prototipinin tüm akışı: açılış, beş etkinlik, sonuç. Durum yalnızca bu bileşenin belleğindedir;
 * hiçbir depoya, FSRS'e veya ilerleme kaydına yazılmaz.
 */
export function LabFlow() {
  const [stage, setStage] = useState<Stage>('intro');
  const [round, setRound] = useState(0);
  const [run, setRun] = useState<LabRun>(startRun);
  const [pending, setPending] = useState<Pending | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);

  const leave = () => setStage('closed');

  const begin = (nextRound: number) => {
    const fresh = startRun();
    setRound(nextRound);
    setRun(fresh);
    setPending(null);
    setMatch(prepare(currentActivity(activities, fresh), nextRound));
    setStage('play');
  };

  if (stage === 'closed') {
    return (
      <Screen>
        <NoticeBar />
        <Text style={type.title} accessibilityRole="header">
          Deneme kapatıldı
        </Text>
        <Text style={[type.body, styles.gap]}>
          Bu, ayrı bir test prototipiydi; bu ekrandan gerçek uygulamaya geçiş yoktur. Gerçek uygulama
          ilerleme kaydeden başka bir deneyimdir.
        </Text>
        <View style={styles.actions}>
          <Button label="Baştan aç" onPress={() => setStage('intro')} />
        </View>
      </Screen>
    );
  }

  if (stage === 'intro') {
    return (
      <Screen>
        <NoticeBar />
        <Text style={type.title} accessibilityRole="header">
          Mini oyun denemesi
        </Text>
        <Text style={[type.body, styles.gap]}>
          Beş kısa etkinlik: doğru/yanlış, boşluk doldurma, çoktan seçmeli ve eşleştirme. Bir seçeneğe
          dokunmak cevabı verir.
        </Text>
        <Text style={[type.small, styles.gap]}>
          Hiçbir şey kaydedilmez: ilerleme, puan veya tekrar zamanı yok.
        </Text>
        <Text style={[type.small, styles.gap]}>
          Kaynak: {LAB_SOURCE.publisher}, {LAB_SOURCE.title}. Durum: {LAB_SOURCE.status}.
        </Text>
        <View style={styles.actions}>
          <Button label="Başla" onPress={() => begin(0)} />
          <Button label="Çık" variant="secondary" onPress={leave} />
        </View>
      </Screen>
    );
  }

  if (stage === 'result') {
    return (
      <Screen>
        <NoticeBar />
        <ResultView
          activities={activities}
          run={run}
          onReplay={() => begin(round + 1)}
          onExit={leave}
        />
      </Screen>
    );
  }

  const activity = currentActivity(activities, run);
  if (!activity) {
    // Tur bitmiş ama sonuç aşamasına geçilmemişse (olağan akışta olmaz) sonucu göster.
    return (
      <Screen>
        <NoticeBar />
        <ResultView
          activities={activities}
          run={run}
          onReplay={() => begin(round + 1)}
          onExit={leave}
        />
      </Screen>
    );
  }

  const shownRun = pending ? recordOutcome(activities, run, pending.activityId, pending.outcome) : run;
  const summary = summarizeRun(activities, shownRun);
  const isLast = run.entries.length + 1 >= activities.length;

  const answer = (outcome: Outcome | null, selected: number | null) => {
    if (!outcome || pending) return;
    setPending({ activityId: activity.id, outcome, selected });
  };

  const next = () => {
    if (!pending) return;
    const updated = recordOutcome(activities, run, pending.activityId, pending.outcome);
    setRun(updated);
    setPending(null);
    if (isRunDone(activities, updated)) {
      setStage('result');
      setMatch(null);
    } else {
      setMatch(prepare(currentActivity(activities, updated), round));
    }
  };

  return (
    <Screen>
      <NoticeBar />
      <View style={styles.topBar}>
        <View style={styles.blisterWrap}>
          <Blister
            cells={runCells(activities, shownRun)}
            label={`Etkinlikler: ${summary.answered} / ${summary.total} tamamlandı`}
          />
        </View>
        <Button variant="text" label="Kapat" onPress={leave} />
      </View>

      <View style={styles.block}>
        {activity.kind === 'match' ? (
          match ? (
            <MatchView
              key={activity.id}
              activity={activity}
              state={match}
              onPick={(side: MatchSide, index: number) => {
                if (pending) return;
                const nextState = pickItem(match, side, index);
                setMatch(nextState);
                if (isMatchDone(nextState)) answer(matchOutcome(nextState), null);
              }}
            />
          ) : null
        ) : (
          <ChoiceView
            key={activity.id}
            activity={activity}
            selected={pending ? pending.selected : null}
            onAnswer={(index, flagged) => answer(answerChoice(activity, index, flagged), index)}
          />
        )}
      </View>

      {pending ? (
        <FeedbackPanel
          title={feedbackTitle(activity, pending.outcome)}
          cell={cellOf(pending.outcome)}
          explain={activity.explain}
          flaggedGuess={pending.outcome.flaggedGuess}
          isLast={isLast}
          onNext={next}
        />
      ) : null}
    </Screen>
  );
}

/** Sıradaki etkinlik eşleştirmeyse başlangıç durumunu hazırlar. Tohum tur sayısına bağlıdır. */
function prepare(activity: LabActivity | null, round: number): MatchState | null {
  return activity && activity.kind === 'match' ? startMatch(activity, MATCH_SEED_BASE + round * 17) : null;
}

const styles = StyleSheet.create({
  gap: { marginTop: space.md },
  actions: { marginTop: space.lg, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  blisterWrap: { flex: 1 },
  block: { marginTop: space.lg },
});
