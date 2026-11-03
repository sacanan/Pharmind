import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../ui/Button';
import { colors, space, type } from '../../ui/theme';
import { cellOf, summarizeRun, type LabRun } from '../engine';
import type { LabActivity, LabCell } from '../types';

const KIND_LABEL: Record<LabActivity['kind'], string> = {
  tf: 'Doğru/yanlış',
  cloze: 'Boşluk doldurma',
  choice: 'Çoktan seçmeli',
  match: 'Eşleştirme',
};

const MARK: Record<LabCell, string> = {
  correct: '✓',
  shaky: '?',
  wrong: '✕',
  current: '',
  pending: '',
};

interface Props {
  activities: LabActivity[];
  run: LabRun;
  onReplay: () => void;
  onExit: () => void;
}

/** Basit sonuç ekranı. XP, mastery veya kayıt yok; yalnızca bu turun özeti. */
export function ResultView({ activities, run, onReplay, onExit }: Props) {
  const s = summarizeRun(activities, run);
  return (
    <View>
      <Text style={type.title} accessibilityRole="header">
        Tur bitti
      </Text>
      <Text style={[type.heading, styles.gap]}>
        {s.total} etkinliğin {s.correct} tanesini hatasız tamamladın.
      </Text>

      <View style={[styles.list, styles.gap]}>
        {run.entries.map((entry, i) => {
          const activity = activities[i];
          const cell = cellOf(entry.outcome);
          const note =
            activity.kind === 'match' && entry.outcome.mistakes > 0
              ? `${entry.outcome.mistakes} hata`
              : entry.outcome.flaggedGuess
                ? 'tahmin'
                : '';
          return (
            <View
              key={entry.activityId}
              style={styles.row}
              accessible
              accessibilityLabel={`${i + 1}. ${KIND_LABEL[activity.kind]}: ${
                cell === 'correct' ? 'doğru' : cell === 'wrong' ? 'yanlış' : 'tam doğru değil'
              }${note ? `, ${note}` : ''}`}
            >
              <Text
                style={[
                  styles.mark,
                  { color: cell === 'correct' ? colors.correct : cell === 'wrong' ? colors.wrong : colors.ink },
                ]}
              >
                {MARK[cell]}
              </Text>
              <Text style={type.body}>
                {i + 1}. {KIND_LABEL[activity.kind]}
                {note ? ` (${note})` : ''}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[type.small, styles.gap]}>
        ✓ hatasız · ? tahmin ya da eşleştirmede hata · ✕ yanlış
      </Text>
      {s.flaggedGuesses > 0 ? (
        <Text style={type.small}>{s.flaggedGuesses} etkinliği tahmin olarak işaretledin.</Text>
      ) : null}
      <Text style={[type.small, styles.gap]}>
        Bu bir test prototipidir. Hiçbir ilerleme, puan veya kayıt saklanmadı.
      </Text>

      <View style={styles.actions}>
        <Button label="Tekrar oyna" onPress={onReplay} />
        <Button label="Çık" variant="secondary" onPress={onExit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: space.md },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  mark: { width: 24, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  actions: { marginTop: space.lg, gap: 12 },
});
