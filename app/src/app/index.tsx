import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { concepts, hasDemoContent, playableCards, playableCases } from '../content';
import { decisionCards, pendingFollowUp, pickTodaysCase } from '../core/case';
import { DAILY_SIZE } from '../core/daily';
import { masteryMap } from '../core/mastery';
import { sessionCells, todaysCells, type CellState } from '../core/session';
import { completedToday, streakStatus, weekDays, weekStart, dayKey, weeklyProgress } from '../core/weekly';
import { useStore } from '../state/progress-context';
import { Blister } from '../ui/Blister';
import { Button } from '../ui/Button';
import { MasteryList } from '../ui/MasteryList';
import { Screen } from '../ui/Screen';
import { WeekDots } from '../ui/WeekDots';
import { colors, fonts, space, type } from '../ui/theme';

export default function Home() {
  const { ready, progress, session, startSession, resetAll } = useStore();
  if (!ready) return null;

  const now = new Date();
  const done = completedToday(progress, now);
  const total = Math.min(DAILY_SIZE, playableCards.length);
  const inProgress = !!session && session.results.length < session.cardIds.length;

  const cells: CellState[] = inProgress
    ? sessionCells(session.cardIds.length, session.results).map((c) =>
        c === 'current' ? 'pending' : c,
      )
    : done
      ? todaysCells(progress, now, DAILY_SIZE)
      : Array<CellState>(DAILY_SIZE).fill('pending');

  const week = weeklyProgress(progress, now);
  const streak = streakStatus(progress, now);
  const lastWeek = dayKey(
    new Date(weekStart(now).getFullYear(), weekStart(now).getMonth(), weekStart(now).getDate() - 7),
  );
  const usedFreezeLastWeek = streak.frozenWeeks.includes(lastWeek);
  const mastery = masteryMap(
    concepts,
    [...playableCards, ...decisionCards(playableCases)],
    progress,
    now,
  );
  const todaysCase = pickTodaysCase(playableCases, progress, now);
  const returning = pendingFollowUp(playableCases, progress, now);

  const start = () => {
    if (!inProgress) startSession();
    router.push('/session');
  };

  return (
    <Screen>
      <Text style={styles.wordmark}>Pharmind</Text>

      {hasDemoContent ? (
        <View style={styles.demo}>
          <Text style={type.small}>
            Demo içerik: kartlar yer tutucudur ve tıbbi bilgi içermez.
          </Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Text style={type.title} accessibilityRole="header">
          {done ? 'Bugünkü oturum tamam' : 'Bugünkü oturum'}
        </Text>
        <Text style={[type.body, styles.lead]}>
          {total === 0
            ? 'Henüz kart yok. İçerik eklenince burada görünecek.'
            : done
              ? 'Yarın devam edebilirsin.'
              : inProgress
                ? `${session.results.length} / ${session.cardIds.length} kart cevaplandı.`
                : `${total} kart, yaklaşık 3 dakika.`}
        </Text>
      </View>

      <Blister cells={cells} />

      {!done && total > 0 ? (
        <View style={styles.action}>
          <Button label={inProgress ? 'Oturuma devam et' : 'Oturumu başlat'} onPress={start} />
        </View>
      ) : null}

      {returning ? (
        <View style={styles.section}>
          <Text style={type.heading} accessibilityRole="header">
            Hasta geri geldi
          </Text>
          <Text style={type.body}>{returning.case.title}</Text>
          <Text style={type.small}>1 karar, yaklaşık 1 dakika.</Text>
          <View style={styles.caseAction}>
            <Button variant="secondary" label="Hastayı dinle" onPress={() => router.push('/followup')} />
          </View>
        </View>
      ) : null}

      {todaysCase ? (
        <View style={styles.section}>
          <Text style={type.heading} accessibilityRole="header">
            Günün vakası
          </Text>
          {todaysCase.done ? (
            <Text style={type.body}>Bugünkü vaka tamam. Yarın devam edebilirsin.</Text>
          ) : (
            <>
              <Text style={type.body}>{todaysCase.case.title}</Text>
              <Text style={type.small}>
                {todaysCase.case.questionBudget} soru, {todaysCase.case.decisions.length} karar,
                yaklaşık 3 dakika.
              </Text>
              <View style={styles.caseAction}>
                <Button
                  variant="secondary"
                  label="Vakayı aç"
                  onPress={() => router.push('/case')}
                />
              </View>
            </>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={type.heading} accessibilityRole="header">
          Bu hafta {week.done} / {week.goal} oturum
        </Text>
        <WeekDots days={weekDays(progress, now)} />
        {streak.streak > 0 || streak.freezes > 0 ? (
          <View style={styles.streak}>
            {streak.streak > 0 ? (
              <Text style={type.bodyStrong}>{streak.streak} haftalık seri</Text>
            ) : null}
            {usedFreezeLastWeek ? (
              <Text style={type.body}>Geçen hafta dondurma hakkın kullanıldı, seri bozulmadı.</Text>
            ) : null}
            <Text style={type.small}>
              {streak.freezes} dondurma hakkı. Hedefi tutturamadığın haftada kendiliğinden kullanılır.
              {streak.freezes < 2
                ? ` Bir sonraki hak için ${streak.untilNextFreeze} başarılı hafta.`
                : ''}
            </Text>
          </View>
        ) : null}
      </View>

      {mastery.length > 0 ? (
        <View style={styles.section}>
          <Text style={type.heading} accessibilityRole="header">
            Kavramlar
          </Text>
          <MasteryList entries={mastery} />
        </View>
      ) : null}

      {__DEV__ ? (
        <View style={styles.dev}>
          <Button variant="text" label="İlerlemeyi sıfırla (geliştirici)" onPress={resetAll} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: fonts.heavy,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  demo: {
    marginTop: space.sm,
    borderWidth: 2,
    borderColor: colors.attention,
    borderRadius: 4,
    padding: 12,
  },
  hero: { marginTop: space.xl, marginBottom: space.md, gap: space.xs },
  lead: { color: colors.inkSoft },
  action: { marginTop: space.md },
  section: { marginTop: space.xl, gap: space.sm },
  streak: { gap: 4 },
  caseAction: { marginTop: space.xs },
  dev: { marginTop: space.xl, alignItems: 'flex-start' },
});
