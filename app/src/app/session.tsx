import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { playableCards } from '../content';
import { sessionCells, summarize } from '../core/session';
import type { Confidence } from '../core/types';
import { weeklyProgress } from '../core/weekly';
import { useStore } from '../state/progress-context';
import { Blister } from '../ui/Blister';
import { Button } from '../ui/Button';
import { Option } from '../ui/Option';
import { Screen } from '../ui/Screen';
import { colors, space, type } from '../ui/theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface Feedback {
  cardId: string;
  selected: number;
  correct: boolean;
  confidence: Confidence;
}

const CONFIDENCE_CHOICES: { value: Confidence; label: string }[] = [
  { value: 'sure', label: 'Eminim' },
  { value: 'unsure', label: 'Kararsızım' },
  { value: 'guess', label: 'Tahmin ettim' },
];

export default function SessionScreen() {
  const { ready, progress, session, answer, finishSession } = useStore();
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const finished = useRef(false);

  const total = session?.cardIds.length ?? 0;
  const answered = session?.results.length ?? 0;
  const allDone = total > 0 && answered >= total && feedback === null;

  useEffect(() => {
    if (allDone && !finished.current) {
      finished.current = true;
      finishSession();
    }
  }, [allDone, finishSession]);

  if (!ready) return null;
  if (!session || total === 0) return <Redirect href="/" />;

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
            Oturum tamamlandı
          </Text>
          <Text style={type.body}>
            {summary.total} kartta {summary.right} doğru.
          </Text>
          {summary.shaky > 0 ? (
            <Text style={type.body}>{summary.shaky} doğru cevabından emin değildin.</Text>
          ) : null}
          {summary.confidentErrors > 0 ? (
            <Text style={type.body}>
              {summary.confidentErrors} kartta emin olduğun halde yanlış yaptın.
            </Text>
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
    const confidentError = !feedback.correct && feedback.confidence === 'sure';
    const shakyRight = feedback.correct && feedback.confidence !== 'sure';
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
          {confidentError ? (
            <View style={styles.note}>
              <Text style={type.body}>
                Emin olduğun bir cevap yanlıştı. Bu kart yakında yeniden karşına çıkacak.
              </Text>
            </View>
          ) : null}
          {shakyRight ? (
            <View style={styles.note}>
              <Text style={type.body}>
                Doğru bildin ama emin değildin. Bu kart daha sık karşına çıkacak.
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

  const submit = (confidence: Confidence) => {
    if (selected === null) return;
    const correct = selected === card.correctIndex;
    answer(card, correct, confidence);
    setFeedback({ cardId: card.id, selected, correct, confidence });
    setSelected(null);
  };

  return (
    <Screen>
      <TopBar cells={cells} />
      <View style={styles.block}>
        <Text style={type.question} accessibilityRole="header">
          {card.prompt}
        </Text>
      </View>
      <View style={styles.options} accessibilityRole="radiogroup">
        {card.options.map((option, i) => (
          <Option
            key={i}
            letter={LETTERS[i]}
            text={option}
            selected={selected === i}
            onPress={() => setSelected(i)}
          />
        ))}
      </View>
      {selected !== null ? (
        <View style={styles.block}>
          <Text style={type.heading}>Ne kadar eminsin?</Text>
          <View style={styles.choices}>
            {CONFIDENCE_CHOICES.map((choice) => (
              <Button
                key={choice.value}
                variant="secondary"
                label={choice.label}
                onPress={() => submit(choice.value)}
              />
            ))}
          </View>
        </View>
      ) : null}
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
    { mark: '✓', label: 'doğru ve emin' },
    { mark: '?', label: 'doğru ama kararsız' },
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
  choices: { marginTop: space.xs, gap: 8 },
  note: {
    marginTop: space.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.attention,
    paddingLeft: 12,
  },
  action: { marginTop: space.lg },
});
