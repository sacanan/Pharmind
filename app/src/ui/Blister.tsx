import { StyleSheet, Text, View } from 'react-native';
import type { CellState } from '../core/session';
import { colors, fonts } from './theme';

interface Props {
  cells: CellState[];
  /** Ekran okuyucu için özel açıklama; verilmezse günlük kart özeti okunur. */
  label?: string;
}

const FILL: Partial<Record<CellState, string>> = {
  correct: colors.correct,
  wrong: colors.wrong,
  shaky: colors.attention,
};

// Renk tek başına anlam taşımasın diye her dolu göze bir işaret konur.
const MARK: Partial<Record<CellState, string>> = {
  correct: '✓',
  wrong: '✕',
  shaky: '?',
};

function describe(cells: CellState[]): string {
  const count = (s: CellState) => cells.filter((c) => c === s).length;
  const parts = [
    `${count('correct')} doğru`,
    `${count('shaky')} kararsız doğru`,
    `${count('wrong')} yanlış`,
    `${count('pending') + count('current')} bekliyor`,
  ];
  return `Günün kartları: ${parts.join(', ')}`;
}

/**
 * Günün kartları, bir blister paketindeki gözler gibi. Cevaplandıkça içi dolar
 * ve rengi sonucu gösterir. Hem ilerleme hem sonuç göstergesidir.
 */
export function Blister({ cells, label }: Props) {
  return (
    <View accessible accessibilityLabel={label ?? describe(cells)} style={styles.row}>
      {cells.map((state, i) => {
        const fill = FILL[state];
        return (
          <View
            key={i}
            style={[
              styles.cell,
              fill ? { backgroundColor: fill, borderColor: fill } : null,
              state === 'current' ? styles.current : null,
            ]}
          >
            {MARK[state] ? (
              <Text style={[styles.mark, state === 'shaky' && styles.markOnAmber]}>{MARK[state]}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cell: {
    flex: 1,
    maxWidth: 56,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: {
    borderColor: colors.ink,
    borderWidth: 3,
  },
  mark: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.paper,
  },
  // Beyaz yazı kehribarda yetersiz kontrast verir (2,8:1); koyu yazı 5,6:1.
  markOnAmber: { color: colors.ink },
});
