import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from './theme';

interface Props {
  checked: boolean;
  onToggle: () => void;
}

/**
 * İsteğe bağlı "Tahmin ettim" işareti. Cevaptan ÖNCE işaretlenir; işaretlememek "emin" anlamına gelmez
 * (yalnızca bildirim verilmemiş olur). Zorunlu bir adım değildir.
 */
export function GuessToggle({ checked, onToggle }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel="Tahmin ettim (isteğe bağlı)"
      accessibilityState={{ checked }}
      onPress={onToggle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.row, focused && styles.focus]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.mark}>✓</Text> : null}
      </View>
      <Text style={type.small}>Tahmin ettim (isteğe bağlı)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, alignSelf: 'flex-start' },
  box: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.ink },
  mark: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 22, color: colors.paper },
  focus: { outlineWidth: 3, outlineColor: colors.ink, outlineOffset: 2, outlineStyle: 'solid' },
});
