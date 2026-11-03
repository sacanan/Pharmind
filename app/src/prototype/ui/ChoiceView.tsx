import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space, type } from '../../ui/theme';
import type { LabChoice } from '../types';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

interface Props {
  activity: LabChoice;
  /** Cevaplandıysa seçilen seçenek; cevaplandıktan sonra düğmeler kilitlenir. */
  selected: number | null;
  /** Seçeneğe dokunmak cevabı doğrudan verir; ayrı bir onay adımı yoktur. */
  onAnswer: (index: number, flaggedGuess: boolean) => void;
}

/**
 * Doğru/yanlış (iki büyük düğme), boşluk doldurma (cümle içinde boşluk) ve çoktan seçmeli
 * (harfli satırlar) için ortak görünüm. Seçeneğe dokunmak cevabı verir; "Tahmin ettim" isteğe
 * bağlıdır ve işaretlenmezse yalnızca "belirtilmedi" demektir.
 */
export function ChoiceView({ activity, selected, onAnswer }: Props) {
  const [flagged, setFlagged] = useState(false);
  const answered = selected !== null;
  const stateOf = (i: number): AnswerState => {
    if (!answered) return 'idle';
    if (i === activity.correctIndex) return 'correct';
    return i === selected ? 'wrong' : 'dim';
  };
  const press = (i: number) => {
    if (!answered) onAnswer(i, flagged);
  };

  return (
    <View>
      <Prompt activity={activity} selected={selected} />

      <GuessToggle checked={flagged} locked={answered} onToggle={() => setFlagged((f) => !f)} />

      {activity.kind === 'tf' ? (
        <View style={styles.binary} accessibilityRole="radiogroup">
          {activity.options.map((text, i) => (
            <AnswerButton
              key={i}
              text={text}
              state={stateOf(i)}
              big
              disabled={answered}
              onPress={() => press(i)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.list} accessibilityRole="radiogroup">
          {activity.options.map((text, i) => (
            <AnswerButton
              key={i}
              letter={LETTERS[i]}
              text={text}
              state={stateOf(i)}
              disabled={answered}
              onPress={() => press(i)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function Prompt({ activity, selected }: { activity: LabChoice; selected: number | null }) {
  if (activity.kind !== 'cloze') {
    return (
      <Text style={type.question} accessibilityRole="header">
        {activity.prompt}
      </Text>
    );
  }
  const [before, ...rest] = activity.prompt.split('___');
  const after = rest.join('___');
  const filled = selected !== null ? activity.options[selected] : '          ';
  const right = selected !== null && selected === activity.correctIndex;
  const wrong = selected !== null && !right;
  return (
    <Text style={type.question} accessibilityRole="header">
      {before}
      <Text style={[styles.blank, right && styles.blankRight, wrong && styles.blankWrong]}>
        {filled}
      </Text>
      {after}
    </Text>
  );
}

function GuessToggle({
  checked,
  locked,
  onToggle,
}: {
  checked: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Tahmin ettim (isteğe bağlı)"
      accessibilityState={{ checked, disabled: locked }}
      disabled={locked}
      onPress={onToggle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.toggle, locked && styles.toggleLocked, focused && styles.focus]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.boxMark}>✓</Text> : null}
      </View>
      <Text style={type.small}>Tahmin ettim (isteğe bağlı)</Text>
    </Pressable>
  );
}

type AnswerState = 'idle' | 'correct' | 'wrong' | 'dim';

function AnswerButton({
  text,
  letter,
  state,
  big,
  disabled,
  onPress,
}: {
  text: string;
  letter?: string;
  state: AnswerState;
  big?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const mark = state === 'correct' ? '✓' : state === 'wrong' ? '✕' : null;
  const spoken =
    state === 'correct' ? ', doğru cevap' : state === 'wrong' ? ', senin cevabın, yanlış' : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${letter ? `${letter}, ` : ''}${text}${spoken}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.answer,
        big && styles.answerBig,
        state === 'correct' && styles.answerCorrect,
        state === 'wrong' && styles.answerWrong,
        state === 'dim' && styles.answerDim,
        pressed && !disabled && styles.pressed,
        focused && styles.focus,
      ]}
    >
      {letter ? (
        <View style={styles.letter}>
          <Text style={styles.letterText}>{letter}</Text>
        </View>
      ) : null}
      <Text style={[big ? styles.bigText : type.body, styles.answerText]}>{text}</Text>
      {mark ? (
        <Text
          style={[styles.markText, { color: state === 'correct' ? colors.correct : colors.wrong }]}
        >
          {mark}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blank: {
    borderBottomWidth: 3,
    borderBottomColor: colors.ink,
    color: colors.ink,
  },
  blankRight: { color: colors.correct, borderBottomColor: colors.correct },
  blankWrong: { color: colors.wrong, borderBottomColor: colors.wrong },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
  toggleLocked: { opacity: 0.6 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.ink },
  boxMark: { color: colors.paper, fontFamily: fonts.bold, fontSize: 16, lineHeight: 18 },
  binary: { flexDirection: 'row', gap: 12, marginTop: space.sm },
  list: { gap: 12, marginTop: space.sm },
  answer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    padding: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.edge,
  },
  answerBig: { flex: 1, minHeight: 96, justifyContent: 'center' },
  answerCorrect: { borderColor: colors.correct, borderWidth: 3, padding: 11 },
  answerWrong: { borderColor: colors.wrong, borderWidth: 3, padding: 11 },
  answerDim: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  answerText: { flexShrink: 1 },
  bigText: { fontFamily: fonts.heavy, fontSize: 24, lineHeight: 30, color: colors.ink },
  letter: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  markText: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 28, marginLeft: 'auto' },
  focus: {
    outlineWidth: 3,
    outlineColor: colors.ink,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
});
