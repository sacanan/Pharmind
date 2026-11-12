import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space, type } from '../../ui/theme';
import type { MatchSide, MatchState } from '../engine';
import type { LabMatch } from '../types';

interface Props {
  activity: LabMatch;
  state: MatchState;
  onPick: (side: MatchSide, index: number) => void;
}

type ItemStatus = 'idle' | 'picked' | 'matched' | 'wrong';

/**
 * Dokunarak eşleştirme: iki sütun, sırası serbest iki dokunuş. Doğru çift ✓ ile kilitlenir,
 * yanlış çift kısa süre ✕ ile işaretlenir (renk tek başına anlam taşımaz).
 */
export function MatchView({ activity, state, onPick }: Props) {
  const done = state.matched.every(Boolean);
  const matchedCount = state.matched.filter(Boolean).length;
  const statusOf = (side: MatchSide, index: number): ItemStatus => {
    const pair = side === 'left' ? index : state.order[index];
    if (state.matched[pair]) return 'matched';
    const wrong = state.lastWrong;
    if (wrong && (side === 'left' ? wrong.left === index : wrong.slot === index)) return 'wrong';
    if (state.picked && state.picked.side === side && state.picked.index === index) return 'picked';
    return 'idle';
  };

  return (
    <View>
      <Text style={type.question} accessibilityRole="header">
        {activity.prompt}
      </Text>
      <Text style={[type.small, styles.hint]}>
        {done
          ? 'Hepsi eşleşti.'
          : 'Soldan bir ifadeye, sonra sağdan tamamlayıcısına dokunun.'}
      </Text>
      <View style={styles.columns}>
        <View style={styles.column}>
          {activity.pairs.map((pair, i) => (
            <Item
              key={`l${i}`}
              text={pair.left}
              side="sol"
              status={statusOf('left', i)}
              disabled={done}
              onPress={() => onPick('left', i)}
            />
          ))}
        </View>
        <View style={styles.column}>
          {state.order.map((pairIndex, slot) => (
            <Item
              key={`r${slot}`}
              text={activity.pairs[pairIndex].right}
              side="sağ"
              status={statusOf('right', slot)}
              disabled={done}
              onPress={() => onPick('right', slot)}
            />
          ))}
        </View>
      </View>
      <Text style={[type.small, styles.count]} accessibilityLiveRegion="polite">
        Eşleşen: {matchedCount} / {activity.pairs.length}
        {state.mistakes > 0 ? ` · Hata: ${state.mistakes}` : ''}
      </Text>
    </View>
  );
}

function Item({
  text,
  side,
  status,
  disabled,
  onPress,
}: {
  text: string;
  side: 'sol' | 'sağ';
  status: ItemStatus;
  disabled: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const locked = disabled || status === 'matched';
  const spoken =
    status === 'matched'
      ? ', eşleşti'
      : status === 'picked'
        ? ', seçili'
        : status === 'wrong'
          ? ', yanlış eşleşme'
          : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${side} sütun: ${text}${spoken}`}
      accessibilityState={{ selected: status === 'picked', disabled: locked }}
      disabled={locked}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.item,
        status === 'picked' && styles.itemPicked,
        status === 'matched' && styles.itemMatched,
        status === 'wrong' && styles.itemWrong,
        pressed && !locked && styles.pressed,
        focused && styles.focus,
      ]}
    >
      <Text style={[type.body, styles.itemText]}>{text}</Text>
      {status === 'matched' ? <Text style={[styles.mark, { color: colors.correct }]}>✓</Text> : null}
      {status === 'wrong' ? <Text style={[styles.mark, { color: colors.wrong }]}>✕</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: space.xs },
  columns: { flexDirection: 'row', gap: 12, marginTop: space.sm },
  column: { flex: 1, gap: 12 },
  item: {
    minHeight: 88,
    padding: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.edge,
    justifyContent: 'center',
  },
  itemPicked: { borderColor: colors.ink, borderWidth: 3, padding: 11 },
  itemMatched: { borderColor: colors.correct, borderWidth: 3, padding: 11 },
  itemWrong: { borderColor: colors.wrong, borderWidth: 3, padding: 11 },
  pressed: { opacity: 0.75 },
  itemText: { fontSize: 16, lineHeight: 22 },
  mark: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24, marginTop: 4 },
  count: { marginTop: space.sm },
  focus: {
    outlineWidth: 3,
    outlineColor: colors.ink,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
});
