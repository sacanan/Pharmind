import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { TOUCH, colors, fonts } from './theme';

interface Props {
  label: string;
  onPress: () => void;
  /** primary: ana eylem. secondary: çerçeveli. text: yalnızca yazı. */
  variant?: 'primary' | 'secondary' | 'text';
  disabled?: boolean;
  /** Yan yana dizilirken eşit genişlik için */
  grow?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled, grow }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'text' && styles.textOnly,
        grow && styles.grow,
        pressed && styles.pressed,
        disabled && styles.disabled,
        focused && styles.focus,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' ? styles.labelOnInk : styles.labelOnPaper,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH + 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.ink },
  secondary: { borderWidth: 2, borderColor: colors.ink },
  textOnly: { minHeight: TOUCH, paddingHorizontal: 8 },
  grow: { flex: 1 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
  focus: {
    outlineWidth: 3,
    outlineColor: colors.ink,
    outlineOffset: 2,
    outlineStyle: 'solid',
  },
  label: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  labelOnInk: { color: colors.paper },
  labelOnPaper: { color: colors.ink },
});
