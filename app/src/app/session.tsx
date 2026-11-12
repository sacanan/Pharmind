import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { playableCards } from '../content';
import { sessionCells, summarize } from '../core/session';
import type { SelfReport, SessionKind } from '../core/types';
import { weeklyProgress } from '../core/weekly';
import { useStore } from '../state/progress-context';
import { Blister } from '../ui/Blister';
import { Button } from '../ui/Button';
import { GuessToggle } from '../ui/GuessToggle';
import { Option } from '../ui/Option';
import { Screen } from '../ui/Screen';
import { colors, space, type } from '../ui/theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface Feedback {
  cardId: string;
  selected: number;
  correct: boolean;
  selfReport: SelfReport;
}

export default function SessionScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: SessionKind = params.kind === 'derinles' ? 'derinles' : 'temel';
  const store = useStore();
  const { ready, progress, answer } = store;
  const session = kind === 'derinles' ? store.derinlesSession : store.session;
  const [guess, setGuess] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const total = session?.cardIds.length ?? 0;
  const answered = session?.results.length ?? 0;
  const allDone = total > 0 && answered >= total && feedback === null;

  if (!ready) return null;
  if (!session || total === 0) return <Redirect href={kind === 'derinles' ? '/derinles' : '/'} />;

  const cells = sessionCells(total, session.results);

  if (allDone) {
    const summary = summarize(session.results);
    const week = weeklyProgress(progress, new Date());
    return (
      <Screen>
        <Blister cells={cells} />
        <Legend />
        <View style={styles.block}>
          <Text style={type.title} accessibilityRole="header">
            {kind === 'derinles' ? 'Derinleş oturumu tamamlandı' : 'Oturum tamamlandı'}
          </Text>
          <Text style={type.body}>
            {summary.total} kartta {summary.right} doğru.
          </Text>
          {summary.shaky > 0 ? (
            <Text style={type.body}>{summary.shaky} doğru cevabı tahmin olarak işaretledin.</Text>
          ) : null}
        </View>
        <Text style={[type.heading, styles.block]}>
          Bu hafta {week.done} / {week.goal} oturum
        </Text>
        <View style={styles.action}>
          <Button label="Ana ekrana dön" onPress={leave} />
        </View>
      </Screen>
    );
  }

  if (feedback) {
    const card = playableCards.find((c) => c.id === feedback.cardId);
    if (!card) return <Redirect href="/" />;
    const isLast = answered >= total;
    const flaggedRight = feedback.correct && feedback.selfReport === 'guess';
    return (
      <Screen>
        <TopBar cells={cells} />
        <View style={styles.block}>
          <Text
            style={[type.title, { color: feedback.correct ? colors.correct : colors.wrong }]}
            accessibilityRole="header"
          >
            {feedback.correct ? 'Doğru' : 'Yanlış'}
          </Text>
          {!feedback.correct ? (
            <Text style={type.small}>
              Senin cevabın: {LETTERS[feedback.selected]}, {card.options[feedback.selected]}
            </Text>
          ) : null}
          <Text style={type.bodyStrong}>
            Doğru cevap: {LETTERS[card.correctIndex]}, {card.options[card.correctIndex]}
          </Text>
          <Text style={type.body}>{card.explanation}</Text>
          {flaggedRight ? (
            <View style={styles.note}>
              <Text style={type.body}>
                Tahmin ettiğini belirttin. Bu kartı biraz daha erken yeniden göstereceğiz.
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.action}>
          <Button
            label={isLast ? 'Oturumu bitir' : 'Sonraki kart'}
            onPress={() => setFeedback(null)}
          />
        </View>
      </Screen>
    );
  }

  const card = playableCards.find((c) => c.id === session.cardIds[answered]);
  if (!card) return <Redirect href="/" />;

  // Tek dokunuş cevabı verir. İşaret yalnızca bu cevap için geçerlidir; sonraki kartta sıfırlanır.
  const submit = (selected: number) => {
    const correct = selected === card.correctIndex;
    answer(card, correct, guess ? 'guess' : 'none', kind);
    setFeedback({ cardId: card.id, selected, correct, selfReport: guess ? 'guess' : 'none' });
    setGuess(false);
  };

  return (
    <Screen>
      <TopBar cells={cells} />
      <View style={styles.block}>
        <Text style={type.question} accessibilityRole="header">
          {card.prompt}
        </Text>
      </View>
      <View style={styles.options}>
        {card.options.map((option, i) => (
          <Option
            key={i}
            letter={LETTERS[i]}
            text={option}
            selected={false}
            immediate
            onPress={() => submit(i)}
          />
        ))}
      </View>
      <View style={styles.block}>
        <GuessToggle checked={guess} onToggle={() => setGuess((g) => !g)} />
      </View>
    </Screen>
  );
}

function TopBar({ cells }: { cells: ReturnType<typeof sessionCells> }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.blisterWrap}>
        <Blister cells={cells} />
      </View>
      <Button variant="text" label="Kapat" onPress={leave} />
    </View>
  );
}

/** Blister gözlerindeki işaretlerin anlamı. Her öğe tek parça kalır, satır ortasından bölünmez. */
function Legend() {
  const items = [
    { mark: '✓', label: 'doğru' },
    { mark: '?', label: 'doğru, tahmin işaretli' },
    { mark: '✕', label: 'yanlış' },
  ];
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <Text key={item.mark} style={type.small}>
          {item.mark} {item.label}
        </Text>
      ))}
    </View>
  );
}

/** Oturumdan çıkar: yığında bir önceki ekrana (ana ekran) döner, yoksa ana ekranı açar. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  blisterWrap: { flex: 1 },
  block: { marginTop: space.lg, gap: space.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: 4, marginTop: space.sm },
  options: { marginTop: space.md, gap: 12 },
  note: {
    marginTop: space.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.attention,
    paddingLeft: 12,
  },
  action: { marginTop: space.lg },
});
