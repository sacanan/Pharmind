import { StyleSheet, Text, View } from 'react-native';
import type { WeekDay } from '../core/weekly';
import { colors, fonts } from './theme';

/** Bu haftanın 7 günü: oturum tamamlanan gün dolu, bugün çerçeveli. */
export function WeekDots({ days }: { days: WeekDay[] }) {
  return (
    <View style={styles.row}>
      {days.map((day) => (
        <View
          key={day.key}
          style={styles.item}
          accessible
          accessibilityLabel={`${day.label}${day.isToday ? ', bugün' : ''}: ${
            day.done ? 'oturum tamamlandı' : 'oturum yok'
          }`}
        >
          <View
            style={[
              styles.dot,
              day.done && styles.dotDone,
              day.isToday && !day.done && styles.dotToday,
            ]}
          />
          <Text style={[styles.label, day.isToday && styles.labelToday]}>{day.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center', gap: 8, minWidth: 40 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.edge,
  },
  dotDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  dotToday: { borderColor: colors.ink, borderWidth: 3 },
  label: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 18, color: colors.inkSoft },
  labelToday: { fontFamily: fonts.bold, color: colors.ink },
});
