import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space, type } from './theme';

interface Props {
  letter: string;
  text: string;
  selected: boolean;
  onPress: () => void;
}

/** Harfli, seçilebilir cevap satırı. Kart ve vaka ekranlarında ortak kullanılır. */
export function Option({ letter, text, selected, onPress }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${letter}, ${text}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.optionPressed,
        focused && styles.focus,
      ]}
    >
      <View style={[styles.letter, selected && styles.letterSelected]}>
        <Text style={[styles.letterText, selected && styles.letterTextSelected]}>{letter}</Text>
      </View>
      <Text style={[type.body, styles.optionText]}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 64,
    padding: 12,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.edge,
  },
  optionSelected: { borderColor: colors.ink, borderWidth: 3, padding: 11 },
  optionPressed: { opacity: 0.75 },
  optionText: { flex: 1 },
  letter: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterSelected: { backgroundColor: colors.ink },
  letterText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, color: colors.ink },
  letterTextSelected: { color: colors.paper },
  focus: {
    outlineWidth: 3,
    outlineColor: colors.ink,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
});
