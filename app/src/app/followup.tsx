import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { playableCases } from '../content';
import { cellForRating, pendingFollowUp } from '../core/case';
import type { CaseTier, DecisionRating, PatientCase } from '../core/types';
import { useStore } from '../state/progress-context';
import { Blister } from '../ui/Blister';
import { Button } from '../ui/Button';
import { Option } from '../ui/Option';
import { Screen } from '../ui/Screen';
import { colors, space, type } from '../ui/theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const RATING_LABEL: Record<DecisionRating, string> = {
  uygun: 'Uygun',
  kabul: 'Kabul edilebilir',
  uygunDegil: 'Uygun değil',
};

const RATING_COLOR: Record<DecisionRating, string> = {
  uygun: colors.correct,
  kabul: colors.attention,
  uygunDegil: colors.wrong,
};

export default function FollowUpScreen() {
  const { ready } = useStore();
  if (!ready) return null;
  return <FollowUpGate />;
}

/** İlerleme okunduktan sonra bağlanır; cevap kaydedilince bekleyen hasta kalmayacağı için seçim açılışta sabitlenir. */
function FollowUpGate() {
  const { progress, completeFollowUp } = useStore();
  const [picked] = useState(() => pendingFollowUp(playableCases, progress, new Date()));
  if (!picked?.case.followUp) return <Redirect href="/" />;
  return <FollowUp c={picked.case} tier={picked.tier} onChoose={completeFollowUp} />;
}

function FollowUp({
  c,
  tier,
  onChoose,
}: {
  c: PatientCase;
  tier: CaseTier;
  onChoose: (c: PatientCase, choice: number) => void;
}) {
  const followUp = c.followUp!;
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<number | null>(null);

  if (answered !== null) {
    const option = followUp.decision.options[answered];
    const best = followUp.decision.options.find((o) => o.rating === 'uygun');
    return (
      <Screen>
        <Blister cells={[cellForRating(option.rating)]} label={`Geri dönüş kararı: ${RATING_LABEL[option.rating]}`} />
        <View style={styles.block}>
          <Text
            style={[type.title, { color: RATING_COLOR[option.rating] }]}
            accessibilityRole="header"
          >
            {RATING_LABEL[option.rating]}
          </Text>
          <Text style={type.small}>Senin seçimin: {option.text}</Text>
          <Text style={type.body}>{option.rationale}</Text>
          {option.rating !== 'uygun' && best ? (
            <>
              <Text style={type.bodyStrong}>Önerilen: {best.text}</Text>
              <Text style={type.body}>{best.rationale}</Text>
            </>
          ) : null}
          <View style={styles.note}>
            <Text style={type.body}>{option.consequence}</Text>
          </View>
        </View>
        <View style={styles.action}>
          <Button label="Ana ekrana dön" onPress={leave} />
        </View>
      </Screen>
    );
  }

  const submit = () => {
    if (selected === null) return;
    onChoose(c, selected);
    setAnswered(selected);
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Button variant="text" label="Kapat" onPress={leave} />
      </View>
      <View style={styles.block}>
        <Text style={type.small}>Hasta geri geldi: {c.title}</Text>
        <Text style={type.body}>{followUp.returns[tier]}</Text>
        <Text style={[type.question, styles.gap]} accessibilityRole="header">
          {followUp.decision.prompt}
        </Text>
      </View>
      <View style={styles.options} accessibilityRole="radiogroup">
        {followUp.decision.options.map((option, i) => (
          <Option
            key={i}
            letter={LETTERS[i]}
            text={option.text}
            selected={selected === i}
            onPress={() => setSelected(i)}
          />
        ))}
      </View>
      <View style={styles.action}>
        <Button label="Kararı ver" onPress={submit} disabled={selected === null} />
      </View>
    </Screen>
  );
}

/** Ekrandan çıkar: yığında bir önceki ekrana (ana ekran) döner, yoksa ana ekranı açar. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  block: { marginTop: space.lg, gap: space.xs },
  gap: { marginTop: space.sm },
  options: { marginTop: space.md, gap: 12 },
  note: {
    marginTop: space.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.attention,
    paddingLeft: 12,
  },
  action: { marginTop: space.lg },
});
