import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { colors, space, type } from './theme';

interface Props {
  title: string;
  detail: string;
  /** Verilmezse satır yalnızca bilgi verir (örn. "tamam"). */
  action?: { label: string; onPress: () => void };
}

/** Ana ekranda ikincil görevler için kompakt satır: solda başlık ve ayrıntı, sağda tek eylem. */
export function ActionRow({ title, detail, action }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={type.bodyStrong}>{title}</Text>
        <Text style={type.small}>{detail}</Text>
      </View>
      {action ? <Button variant="text" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.foil,
  },
  text: { flex: 1, gap: 2 },
});
