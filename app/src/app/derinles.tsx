import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { concepts, derinlesMasteryCards, derinlesPlayableCards } from '../content';
import { selectDerinles } from '../core/derinles';
import { masteryMap } from '../core/mastery';
import { isSessionActive } from '../core/session';
import { useStore } from '../state/progress-context';
import { Button } from '../ui/Button';
import { Screen } from '../ui/Screen';
import { space, type } from '../ui/theme';

/**
 * Derinleş girişi. Her zaman erişilebilir: kilit yok, günlük oturumu bitirmek gerekmez. Kullanıcı
 * kavramı kendisi seçer (otomatik öneri yok). Yarım Derinleş oturumu sessizce silinmez.
 */
export default function Derinles() {
  const { ready, progress, derinlesSession, startDerinlesSession } = useStore();
  const [pendingConcept, setPendingConcept] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  if (!ready) return null;

  const now = new Date();
  const entries = masteryMap(concepts, derinlesMasteryCards, progress, now).filter((e) => e.cardCount > 0);
  const nameOf = (id?: string) => concepts.find((c) => c.id === id)?.name ?? 'seçili kavram';
  const active = derinlesSession && isSessionActive(derinlesSession) ? derinlesSession : null;

  const open = () => router.push({ pathname: '/session', params: { kind: 'derinles' } });
  const begin = (conceptId: string) => {
    if (startDerinlesSession(conceptId)) {
      setPendingConcept(null);
      open();
    } else {
      setEmpty(true);
    }
  };
  const choose = (conceptId: string) => {
    setEmpty(false);
    if (active && active.conceptId === conceptId) return open(); // aynı kavram: kaldığı yerden
    if (active) return setPendingConcept(conceptId); // başka kavram: yarım oturum için açık seçim
    begin(conceptId);
  };

  return (
    <Screen>
      <View style={styles.block}>
        <Text style={type.title} accessibilityRole="header">
          Derinleş
        </Text>
        <Text style={type.body}>
          Bir kavram seç; o kavramın derin sorularından en fazla 5 kartla çalışırsın. Seçtiğin kartların
          hepsini cevaplamak günlük hedefi tamamlar, doğru olması şart değildir.
        </Text>
      </View>

      {entries.length === 0 || derinlesPlayableCards.length === 0 ? (
        <View style={styles.block}>
          <Text style={type.heading}>Henüz Derinleş içeriği yok</Text>
          <Text style={type.body}>
            Bu bölüm açık; içerik eklenince kavramlar burada listelenir. Şimdilik günlük oturumla devam
            edebilirsin.
          </Text>
        </View>
      ) : (
        <>
          {active ? (
            <View style={styles.block}>
              <Text style={type.bodyStrong}>Devam eden oturum: {nameOf(active.conceptId)}</Text>
              <Text style={type.small}>
                {active.results.length} / {active.cardIds.length} kart cevaplandı
              </Text>
              <Button label="Oturuma devam et" onPress={open} />
            </View>
          ) : null}

          {pendingConcept ? (
            <View style={styles.block}>
              <Text style={type.bodyStrong}>
                Yarım Derinleş oturumun var ({nameOf(active?.conceptId)}).
              </Text>
              <Text style={type.body}>
                {nameOf(pendingConcept)} için yeni oturum başlatırsan o yarım oturum silinir.
              </Text>
              <Button label="Mevcut oturuma devam et" onPress={open} />
              <Button variant="text" label="Yeni oturumu başlat, yarım oturum silinsin" onPress={() => begin(pendingConcept)} />
              <Button variant="text" label="Vazgeç" onPress={() => setPendingConcept(null)} />
            </View>
          ) : null}

          {empty ? <Text style={type.body}>Bu kavramda uygun kart kalmadı.</Text> : null}

          <View style={styles.list}>
            {entries.map(({ concept, cardCount }) => {
              const size = selectDerinles(derinlesPlayableCards, concept.id, progress, now, derinlesMasteryCards).length;
              const isActive = active?.conceptId === concept.id;
              return (
                <View key={concept.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={type.bodyStrong}>{concept.name}</Text>
                    <Text style={type.small}>
                      {cardCount} Derinleş kartı; bu oturumda {size} kart
                    </Text>
                  </View>
                  <Button
                    variant="text"
                    label={`${isActive ? 'Devam et' : 'Başla'}: ${concept.name}`}
                    onPress={() => choose(concept.id)}
                  />
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.block}>
        <Button variant="text" label="Ana ekrana dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: space.lg, gap: space.xs },
  list: { marginTop: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  rowText: { flex: 1, gap: 2 },
});
