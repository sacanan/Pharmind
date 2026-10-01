import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { playableCases } from '../content';
import {
  askQuestion,
  cellForRating,
  choose,
  emptyRun,
  isFinished,
  pickTodaysCase,
  questionsLeft,
  summarizeCase,
} from '../core/case';
import type { CaseRun, DecisionRating, PatientCase } from '../core/types';
import { useStore } from '../state/progress-context';
import { Blister } from '../ui/Blister';
import { Button } from '../ui/Button';
import { Option } from '../ui/Option';
import { Screen } from '../ui/Screen';
import { colors, space, type } from '../ui/theme';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Stage = 'brief' | 'ask' | 'decide' | 'feedback' | 'result';

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

export default function CaseScreen() {
  const { ready, progress, completeCase } = useStore();
  // Vaka tamamlanınca "bugün bitti" durumuna geçileceği için seçim ilk açılışta sabitlenir.
  const picked = useRef<{ case: PatientCase; done: boolean } | null>(null);
  if (ready && !picked.current) {
    picked.current = pickTodaysCase(playableCases, progress, new Date());
  }
  if (!ready) return null;
  if (!picked.current || picked.current.done) return <Redirect href="/" />;
  return <CaseFlow c={picked.current.case} onComplete={completeCase} />;
}

function CaseFlow({
  c,
  onComplete,
}: {
  c: PatientCase;
  onComplete: (c: PatientCase, run: CaseRun) => void;
}) {
  const [stage, setStage] = useState<Stage>('brief');
  const [run, setRun] = useState<CaseRun>(emptyRun);
  const [selected, setSelected] = useState<number | null>(null);
  const saved = useRef(false);

  useEffect(() => {
    if (stage === 'result' && !saved.current) {
      saved.current = true;
      onComplete(c, run);
    }
  }, [stage, c, run, onComplete]);

  const decisionIndex = Math.min(run.choices.length, c.decisions.length - 1);
  const cells = c.decisions.map((d, i) => {
    const choice = run.choices[i];
    if (choice === undefined) return i === run.choices.length ? ('current' as const) : ('pending' as const);
    return cellForRating(d.options[choice].rating);
  });
  const blisterLabel = `Vaka kararları: ${run.choices.length} / ${c.decisions.length} verildi`;

  if (stage === 'brief') {
    return (
      <Screen>
        <TopBar />
        <View style={styles.block}>
          <Text style={type.small}>Günün vakası</Text>
          <Text style={type.title} accessibilityRole="header">
            {c.title}
          </Text>
          <Text style={[type.body, styles.gap]}>{c.presentation}</Text>
          <Text style={[type.small, styles.gap]}>
            Hastaya en fazla {c.questionBudget} soru sorabilirsin, sonra {c.decisions.length} karar
            vereceksin.
          </Text>
        </View>
        <View style={styles.action}>
          <Button label="Hastayla konuş" onPress={() => setStage('ask')} />
        </View>
      </Screen>
    );
  }

  if (stage === 'ask') {
    const left = questionsLeft(c, run);
    const asked = summarizeCase(c, run).asked;
    return (
      <Screen>
        <TopBar />
        <View style={styles.block}>
          <Text style={type.question} accessibilityRole="header">
            Hastaya ne soracaksın?
          </Text>
          <Text style={type.small}>
            {left > 0 ? `${left} soru hakkın kaldı.` : 'Soru hakkın bitti.'}
          </Text>
        </View>
        {asked.length > 0 ? (
          <View style={styles.block}>
            {asked.map((q) => (
              <View key={q.id} style={styles.reply}>
                <Text style={type.small}>{q.ask}</Text>
                <Text style={type.body}>{q.reply}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {left > 0 ? (
          <View style={styles.choices}>
            {c.questions
              .filter((q) => !run.askedIds.includes(q.id))
              .map((q) => (
                <Button
                  key={q.id}
                  variant="secondary"
                  label={q.ask}
                  onPress={() => setRun((r) => askQuestion(c, r, q.id))}
                />
              ))}
          </View>
        ) : null}
        <View style={styles.action}>
          <Button label="Karara geç" onPress={() => setStage('decide')} />
        </View>
      </Screen>
    );
  }

  if (stage === 'decide') {
    const decision = c.decisions[decisionIndex];
    const submit = () => {
      if (selected === null) return;
      setRun((r) => choose(c, r, selected));
      setStage('feedback');
    };
    return (
      <Screen>
        <TopBar />
        <Blister cells={cells} label={blisterLabel} />
        <View style={styles.block}>
          <Text style={type.small}>
            Karar {decisionIndex + 1} / {c.decisions.length}
          </Text>
          <Text style={type.question} accessibilityRole="header">
            {decision.prompt}
          </Text>
        </View>
        <View style={styles.options} accessibilityRole="radiogroup">
          {decision.options.map((option, i) => (
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

  if (stage === 'feedback') {
    const index = run.choices.length - 1;
    const decision = c.decisions[index];
    const option = decision.options[run.choices[index]];
    const best = decision.options.find((o) => o.rating === 'uygun');
    const last = isFinished(c, run);
    return (
      <Screen>
        <TopBar />
        <Blister cells={cells} label={blisterLabel} />
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
            <Text style={type.bodyStrong}>Önerilen: {best.text}</Text>
          ) : null}
          {option.rating !== 'uygun' && best ? <Text style={type.body}>{best.rationale}</Text> : null}
          <View style={styles.note}>
            <Text style={type.body}>{option.consequence}</Text>
          </View>
        </View>
        <View style={styles.action}>
          <Button
            label={last ? 'Vakayı bitir' : 'Sonraki karar'}
            onPress={() => {
              setSelected(null);
              setStage(last ? 'result' : 'decide');
            }}
          />
        </View>
      </Screen>
    );
  }

  const summary = summarizeCase(c, run);
  return (
    <Screen>
      <Blister cells={cells} label={blisterLabel} />
      <View style={styles.legend}>
        <Text style={type.small}>✓ uygun</Text>
        <Text style={type.small}>? kabul edilebilir</Text>
        <Text style={type.small}>✕ uygun değil</Text>
      </View>
      <View style={styles.block}>
        <Text style={type.title} accessibilityRole="header">
          Vaka tamamlandı
        </Text>
        <Text style={type.body}>{c.outcome}</Text>
      </View>

      <View style={styles.block}>
        <Text style={type.heading}>Kararların</Text>
        <Text style={type.body}>
          {summary.counts.uygun} uygun, {summary.counts.kabul} kabul edilebilir,{' '}
          {summary.counts.uygunDegil} uygun değil.
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={type.heading}>Soruların</Text>
        <Text style={type.body}>
          {summary.criticalTotal} kritik bilgiden {summary.criticalAsked} tanesini sordun.
        </Text>
        {summary.unnecessaryAsked > 0 ? (
          <Text style={type.body}>
            {summary.unnecessaryAsked} soruyu karar için gerekmeyen bir bilgiye harcadın.
          </Text>
        ) : null}
        {summary.missedCritical.map((q) => (
          <View key={q.id} style={styles.note}>
            <Text style={type.small}>Sormadığın kritik soru: {q.ask}</Text>
            <Text style={type.body}>{q.reply}</Text>
          </View>
        ))}
      </View>

      <View style={styles.action}>
        <Button label="Ana ekrana dön" onPress={leave} />
      </View>
    </Screen>
  );
}

function TopBar() {
  return (
    <View style={styles.topBar}>
      <Button variant="text" label="Kapat" onPress={leave} />
    </View>
  );
}

/** Vakadan çıkar: yığında bir önceki ekrana (ana ekran) döner, yoksa ana ekranı açar. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'flex-end' },
  block: { marginTop: space.lg, gap: space.xs },
  gap: { marginTop: space.xs },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: 4,
    marginTop: space.sm,
  },
  options: { marginTop: space.md, gap: 12 },
  choices: { marginTop: space.md, gap: 8 },
  reply: { gap: 2, borderLeftWidth: 4, borderLeftColor: colors.foil, paddingLeft: 12, marginTop: 4 },
  note: {
    marginTop: space.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.attention,
    paddingLeft: 12,
    gap: 2,
  },
  action: { marginTop: space.lg },
});
