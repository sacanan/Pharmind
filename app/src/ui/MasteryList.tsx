import { StyleSheet, Text, View } from 'react-native';
import type { MasteryEntry } from '../core/mastery';
import { colors, space, type } from './theme';

/** Kavram başına mastery: en zayıf kavram en üstte. */
export function MasteryList({ entries }: { entries: MasteryEntry[] }) {
  return (
    <View style={styles.list}>
      {entries.map(({ concept, mastery, seenCount, cardCount }) => {
        const percent = Math.round(mastery * 100);
        return (
          <View
            key={concept.id}
            accessible
            accessibilityLabel={`${concept.name}: yüzde ${percent}, ${cardCount} kartın ${seenCount} tanesi görüldü`}
            style={styles.row}
          >
            <View style={styles.head}>
              <Text style={type.body}>{concept.name}</Text>
              <Text style={type.bodyStrong}>%{percent}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: 2, backgroundColor: colors.foil, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: colors.ink },
});
