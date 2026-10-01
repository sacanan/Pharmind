import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLUMN_WIDTH, colors, space } from './theme';

/** Güvenli alan + sola hizalı tek sütun. Geniş ekranda sütun azami genişlikte kalır. */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1 },
  column: {
    width: '100%',
    maxWidth: COLUMN_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xl,
  },
});
