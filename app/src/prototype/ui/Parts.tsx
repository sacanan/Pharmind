import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../ui/Button';
import { colors, space, type } from '../../ui/theme';
import { LAB_NOTICE } from '../lab-content';
import type { LabCell } from '../types';

/** Her ekranda görünen test uyarısı. */
export function NoticeBar() {
  return (
    <View style={styles.notice} accessibilityRole="alert">
      <Text style={type.small}>{LAB_NOTICE}</Text>
    </View>
  );
}

interface FeedbackProps {
  title: string;
  cell: LabCell;
  explain: string;
  /** Kullanıcı "tahmin ettim" dediyse kısa not. */
  flaggedGuess: boolean;
  isLast: boolean;
  onNext: () => void;
}

/** Cevaptan sonra aynı ekranda görünen kısa geri bildirim ve tek "Devam" düğmesi. */
export function FeedbackPanel({ title, cell, explain, flaggedGuess, isLast, onNext }: FeedbackProps) {
  const color =
    cell === 'correct' ? colors.correct : cell === 'wrong' ? colors.wrong : colors.attention;
  return (
    <View style={[styles.feedback, { borderTopColor: color }]}>
      <Text style={[type.heading, { color: cell === 'shaky' ? colors.ink : color }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={type.body}>{explain}</Text>
      {flaggedGuess ? <Text style={type.small}>Bunu tahmin olarak işaretlemiştin.</Text> : null}
      <View style={styles.next}>
        <Button label={isLast ? 'Sonucu gör' : 'Devam'} onPress={onNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginBottom: space.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.attention,
    paddingLeft: 12,
  },
  feedback: {
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 4,
    gap: space.xs,
  },
  next: { marginTop: space.xs },
});
