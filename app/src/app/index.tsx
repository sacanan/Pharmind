import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  concepts,
  derinlesMasteryCards,
  derinlesPlayableCards,
  hasDemoContent,
  playableCases,
  temelMasteryCards,
  temelPlayableCards,
} from '../content';
import { pendingFollowUp, pickTodaysCase } from '../core/case';
import { DAILY_SIZE } from '../core/daily';
import { masteryMap } from '../core/mastery';
import { homeCells, isSessionActive, temelCompletedToday } from '../core/session';
import { completedToday, streakStatus, weekDays, weekStart, dayKey, weeklyProgress } from '../core/weekly';
import { useStore } from '../state/progress-context';
import { ActionRow } from '../ui/ActionRow';
import { Blister } from '../ui/Blister';
import { Button } from '../ui/Button';
import { MasteryList } from '../ui/MasteryList';
import { Screen } from '../ui/Screen';
import { WeekDots } from '../ui/WeekDots';
import { colors, fonts, space, type } from '../ui/theme';

export default function Home() {
  const { ready, progress, session, derinlesSession, startSession, resetAll } = useStore();
  if (!ready) return null;

  const now = new Date();
  const done = completedToday(progress, now);
  const total = Math.min(DAILY_SIZE, temelPlayableCards.length);
  const inProgress = !!session && isSessionActive(session);
  // Günlük HEDEF (done) ile Temel oturumun durumu ayrıdır: hedef Derinleş ile de tamamlanabilir.
  const temelDone = temelCompletedToday(session, progress, now, total);
  const cells = homeCells(session, progress, now, total || DAILY_SIZE, temelDone);

  const week = weeklyProgress(progress, now);
  const streak = streakStatus(progress, now);
  const lastWeek = dayKey(
    new Date(weekStart(now).getFullYear(), weekStart(now).getMonth(), weekStart(now).getDate() - 7),
  );
  const usedFreezeLastWeek = streak.frozenWeeks.includes(lastWeek);
  // Oynanabilir hiçbir içeriği olmayan kavram (örn. yalnızca taslak kartlarda geçen) gösterilmez.
  const mastery = masteryMap(concepts, temelMasteryCards, progress, now).filter((e) => e.cardCount > 0);
  const derinlesMastery = masteryMap(concepts, derinlesMasteryCards, progress, now).filter((e) => e.cardCount > 0);
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
          {temelDone ? 'Bugünkü oturum tamam' : 'Bugünkü oturum'}
        </Text>
        <Text style={[type.body, styles.lead]}>
          {total === 0
            ? 'Henüz kart yok. İçerik eklenince burada görünecek.'
            : temelDone
              ? 'Yarın devam edebilirsin.'
              : inProgress
                ? `${session.results.length} / ${session.cardIds.length} kart cevaplandı.`
                : `${total} kart, yaklaşık 3 dakika.`}
        </Text>
        {done && !temelDone ? (
          <Text style={type.small}>Günlük hedef Derinleş ile tamamlandı. Temel oturum henüz tamamlanmadı.</Text>
        ) : null}
      </View>

      <Blister cells={cells} />

      {!temelDone && total > 0 ? (
        <View style={styles.action}>
          <Button label={inProgress ? 'Oturuma devam et' : 'Oturumu başlat'} onPress={start} />
        </View>
      ) : null}

      <View style={styles.rows}>
        <ActionRow
          title="Derinleş"
          detail={
            derinlesSession && isSessionActive(derinlesSession)
              ? `Yarım oturum var: ${derinlesSession.results.length} / ${derinlesSession.cardIds.length} kart`
              : derinlesPlayableCards.length > 0
                ? 'Bir kavram seç, en fazla 5 derin soruyla çalış'
                : 'Henüz içerik yok; bölüm açık'
          }
          action={{ label: 'Derinleş', onPress: () => router.push('/derinles') }}
        />
      </View>

      {returning || todaysCase ? (
        <View style={styles.rows}>
          {returning ? (
            <ActionRow
              title="Hasta geri geldi"
              detail={`${returning.case.title}, 1 karar`}
              action={{ label: 'Hastayı dinle', onPress: () => router.push('/followup') }}
            />
          ) : null}
          {todaysCase ? (
            todaysCase.done ? (
              <ActionRow title="Günün vakası" detail="Tamam. Yarın devam edebilirsin." />
            ) : (
              <ActionRow
                title="Günün vakası"
                detail={`${todaysCase.case.title}, ${todaysCase.case.questionBudget} soru, ${todaysCase.case.decisions.length} karar`}
                action={{ label: 'Vakayı aç', onPress: () => router.push('/case') }}
              />
            )
          ) : null}
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
              <Text style={type.body}>Geçen hafta dondurma hakkın kullanıldı.</Text>
            ) : null}
            <Text style={type.small}>
              {streak.freezes} dondurma hakkı: hedefi tutturamadığın haftada kendiliğinden kullanılır.
            </Text>
          </View>
        ) : null}
      </View>

      {mastery.length > 0 ? (
        <View style={styles.section}>
          <Text style={type.heading} accessibilityRole="header">
            Temel kavramlar
          </Text>
          <MasteryList entries={mastery} />
        </View>
      ) : null}

      {derinlesMastery.length > 0 ? (
        <View style={styles.section}>
          <Text style={type.heading} accessibilityRole="header">
            Derinleş kavramları
          </Text>
          <MasteryList entries={derinlesMastery} />
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
  rows: { marginTop: space.lg },
  dev: { marginTop: space.xl, alignItems: 'flex-start' },
});
