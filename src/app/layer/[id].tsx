import Slider from '@react-native-community/slider';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import AudioEngine from '../../../modules/audio-engine';
import { Button } from '../../components/Button';
import { SplitKeyboard } from '../../components/SplitKeyboard';
import { Stepper } from '../../components/Stepper';
import { BANK_LABELS } from '../../engine/catalog';
import { instrumentName } from '../../model/defaults';
import { noteName } from '../../lib/notes';
import type { LayerDef } from '../../model/types';
import { selectLayer, selectPatchOfLayer, useConcert } from '../../store/concert';
import { colors } from '../../theme';

type LearnTarget = 'keyLow' | 'keyHigh' | null;

const CHANNELS = [-1, ...Array.from({ length: 16 }, (_, i) => i)];

export default function LayerEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const layer = useConcert(selectLayer(id));
  const patch = useConcert(selectPatchOfLayer(id));
  const updateLayer = useConcert((s) => s.updateLayer);
  const removeLayer = useConcert((s) => s.removeLayer);
  const removeEffect = useConcert((s) => s.removeEffect);
  const setEffectBypass = useConcert((s) => s.setEffectBypass);
  const [learn, setLearn] = useState<LearnTarget>(null);

  const update = (p: Partial<LayerDef>) => updateLayer(id, p);

  // MIDI learn: the next note played on the hardware keyboard sets the split point.
  useEffect(() => {
    if (!learn) return;
    const sub = AudioEngine.addListener('onMidiEvent', (e) => {
      if (e.type !== 'noteOn') return;
      pick(e.data1);
    });
    return () => sub.remove();
  });

  if (!layer) return null;

  function pick(note: number) {
    if (!learn || !layer) return;
    if (learn === 'keyLow') update({ keyLow: note, keyHigh: Math.max(note, layer.keyHigh) });
    else update({ keyHigh: note, keyLow: Math.min(note, layer.keyLow) });
    setLearn(null);
  }

  const confirmDelete = () =>
    Alert.alert(`Supprimer « ${layer.name} » ?`, undefined, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          router.back();
          removeLayer(id);
        },
      },
    ]);

  return (
    <>
      <Stack.Screen options={{ title: layer.name }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Button label="Terminé" variant="primary" onPress={() => router.back()} style={styles.done} />
        <Section title="Nom">
          <TextInput
            value={layer.name}
            onChangeText={(name) => update({ name })}
            style={styles.input}
            placeholderTextColor={colors.textMuted}
          />
        </Section>

        <Section title="Instrument">
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.value}>{instrumentName(layer)}</Text>
              <Text style={styles.hint}>
                {layer.plugin
                  ? `Plugin · ${layer.plugin.manufacturer}`
                  : `${BANK_LABELS[layer.sound.bank] ?? layer.sound.bank} · banque ${layer.sound.bankNumber} · prog ${layer.sound.program + 1}`}
              </Text>
            </View>
            {layer.plugin && (
              <Button
                label="Interface"
                onPress={() =>
                  router.push({ pathname: '/plugin/[layerId]', params: { layerId: id, slot: 'instrument' } })
                }
              />
            )}
            <Button
              label="Changer"
              variant="primary"
              onPress={() => router.push({ pathname: '/sound/[layerId]', params: { layerId: id } })}
            />
          </View>
        </Section>

        <Section title="Effets">
          {layer.effects.length === 0 && <Text style={styles.hint}>Aucun effet. Ajoute une reverb, un delay…</Text>}
          {layer.effects.map((effect, index) => (
            <View key={effect.id} style={styles.row}>
              <Text style={styles.effectIndex}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text style={[styles.value, effect.bypass && styles.bypassed]}>{effect.plugin.name}</Text>
                <Text style={styles.hint}>{effect.plugin.manufacturer}</Text>
              </View>
              <Text style={styles.hint}>Actif</Text>
              <Switch value={!effect.bypass} onValueChange={(on) => setEffectBypass(id, effect.id, !on)} />
              <Button
                label="Régler"
                onPress={() => router.push({ pathname: '/plugin/[layerId]', params: { layerId: id, slot: effect.id } })}
              />
              <Button label="✕" variant="danger" onPress={() => removeEffect(id, effect.id)} />
            </View>
          ))}
          <Button
            label="＋ Ajouter un effet"
            onPress={() => router.push({ pathname: '/effect/[layerId]', params: { layerId: id } })}
            style={styles.alignStart}
          />
        </Section>

        <Section title="Zone de clavier (split)">
          <RangeRow
            label="Note basse"
            value={layer.keyLow}
            learning={learn === 'keyLow'}
            onLearn={() => setLearn(learn === 'keyLow' ? null : 'keyLow')}
            onChange={(keyLow) => update({ keyLow, keyHigh: Math.max(keyLow, layer.keyHigh) })}
          />
          <RangeRow
            label="Note haute"
            value={layer.keyHigh}
            learning={learn === 'keyHigh'}
            onLearn={() => setLearn(learn === 'keyHigh' ? null : 'keyHigh')}
            onChange={(keyHigh) => update({ keyHigh, keyLow: Math.min(keyHigh, layer.keyLow) })}
          />
          <Text style={styles.hint}>
            {learn
              ? 'Joue une note sur ton piano ou touche le clavier ci-dessous…'
              : '« Apprendre » puis joue la note sur ton piano.'}
          </Text>
          <SplitKeyboard layers={patch?.layers ?? [layer]} onPickNote={learn ? pick : undefined} height={90} />
          <Button
            label="Tout le clavier"
            onPress={() => update({ keyLow: 0, keyHigh: 127 })}
            style={styles.alignStart}
          />
        </Section>

        <Section title="Transposition">
          <Stepper
            value={layer.transpose}
            onChange={(transpose) => update({ transpose })}
            min={-48}
            max={48}
            bigStep={12}
            format={(v) => `${v > 0 ? '+' : ''}${v} st`}
          />
        </Section>

        <Section title="Vélocité">
          <View style={styles.row}>
            <Text style={styles.label}>Min</Text>
            <Stepper
              value={layer.velocityLow}
              onChange={(velocityLow) =>
                update({ velocityLow, velocityHigh: Math.max(velocityLow, layer.velocityHigh) })
              }
              min={1}
              max={127}
              bigStep={10}
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Max</Text>
            <Stepper
              value={layer.velocityHigh}
              onChange={(velocityHigh) =>
                update({ velocityHigh, velocityLow: Math.min(velocityHigh, layer.velocityLow) })
              }
              min={1}
              max={127}
              bigStep={10}
            />
          </View>
        </Section>

        <Section title="Canal MIDI">
          <View style={styles.chips}>
            {CHANNELS.map((ch) => (
              <Button
                key={ch}
                label={ch < 0 ? 'Omni' : String(ch + 1)}
                active={layer.midiChannel === ch}
                onPress={() => update({ midiChannel: ch })}
              />
            ))}
          </View>
        </Section>

        <Section title="Mix">
          <View style={styles.row}>
            <Text style={styles.label}>Pan</Text>
            <Slider
              style={styles.flex}
              value={layer.pan}
              minimumValue={-1}
              maximumValue={1}
              onValueChange={(pan) => update({ pan: Math.round(pan * 100) / 100 })}
              minimumTrackTintColor={layer.color}
            />
            <Text style={styles.value}>
              {layer.pan === 0
                ? 'C'
                : layer.pan < 0
                  ? `L${Math.round(-layer.pan * 100)}`
                  : `R${Math.round(layer.pan * 100)}`}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, styles.flex]}>Pédale de sustain</Text>
            <Switch value={layer.sustainEnabled} onValueChange={(sustainEnabled) => update({ sustainEnabled })} />
          </View>
        </Section>

        <Button label="Supprimer ce layer" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function RangeRow(props: {
  label: string;
  value: number;
  learning: boolean;
  onLearn: () => void;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{props.label}</Text>
      <Stepper value={props.value} onChange={props.onChange} min={0} max={127} bigStep={12} format={noteName} />
      <Button
        label={props.learning ? 'En attente…' : 'Apprendre'}
        active={props.learning}
        activeColor={colors.warning}
        onPress={props.onLearn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 60 },
  section: { gap: 8 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  flex: { flex: 1 },
  label: { color: colors.textDim, width: 90 },
  value: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 13 },
  input: { color: colors.text, fontSize: 17, backgroundColor: colors.control, borderRadius: 8, padding: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  alignStart: { alignSelf: 'flex-start' },
  effectIndex: { color: colors.textMuted, width: 18, textAlign: 'right' },
  bypassed: { color: colors.textMuted, textDecorationLine: 'line-through' },
  done: { alignSelf: 'flex-end', paddingHorizontal: 20 },
});
