import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { patchTempo, tap } from '../engine/tempo';
import { MAX_TEMPO, MIN_TEMPO } from '../lib/tempo';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';

export function PatchEditor({ patchId }: { patchId: string }) {
  const patch = useConcert((s) => s.concert.sets.flatMap((set) => set.patches).find((p) => p.id === patchId));
  const setNotes = useConcert((s) => s.setPatchNotes);
  const setGain = useConcert((s) => s.setPatchGainDb);
  const setTempo = useConcert((s) => s.setPatchTempo);
  if (!patch) return <Text style={styles.hint}>Ce patch n’existe plus.</Text>;
  const db = patch.gainDb ?? 0;
  const tempo = patchTempo(patch);
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{patch.name}</Text>
      <Text style={styles.label}>Niveau du patch</Text>
      <View style={styles.row}>
        <Button
          label="−"
          accessibilityLabel="Baisser le niveau du patch"
          disabled={db <= -24}
          onPress={() => setGain(patch.id, db - 1)}
        />
        <Text style={styles.value}>{db} dB</Text>
        <Button
          label="+"
          accessibilityLabel="Monter le niveau du patch"
          disabled={db >= 0}
          onPress={() => setGain(patch.id, db + 1)}
        />
        <Button label="Réinitialiser" variant="subtle" onPress={() => setGain(patch.id, 0)} />
      </View>
      <Text style={styles.hint}>
        Baisse les patches trop forts pendant la répétition. Le mélange entre les layers reste identique. 0 dB conserve
        le niveau d’origine.
      </Text>
      <Text style={styles.label}>Tempo</Text>
      <View style={styles.row}>
        <Button
          label="−"
          accessibilityLabel="Ralentir le tempo"
          disabled={tempo <= MIN_TEMPO}
          onPress={() => setTempo(patch.id, tempo - 1)}
        />
        <Text style={styles.value}>{tempo} BPM</Text>
        <Button
          label="+"
          accessibilityLabel="Accélérer le tempo"
          disabled={tempo >= MAX_TEMPO}
          onPress={() => setTempo(patch.id, tempo + 1)}
        />
        <Button
          icon="hand.tap.fill"
          label="Tap"
          accessibilityLabel="Tap Tempo"
          variant="primary"
          onPress={() => tap(patch.id)}
        />
      </View>
      <Text style={styles.hint}>
        Tape au moins deux fois en rythme. Les plugins AUv3 compatibles (délais, arpégiateurs, LFO synchronisés) suivent
        le tempo du patch joué, en 4/4. Il n’y a pas de lecture ni de métronome.
      </Text>
      <Text style={styles.label}>Repères pour la scène</Text>
      <TextInput
        accessibilityLabel="Notes du patch"
        value={patch.notes ?? ''}
        onChangeText={(value) => setNotes(patch.id, value)}
        multiline
        maxLength={400}
        placeholder="Entrée après 8 mesures, refrain : cordes…"
        placeholderTextColor={colors.textMuted}
        style={styles.notes}
      />
      <Text style={styles.hint}>Ces notes apparaissent en mode scène. {patch.notes?.length ?? 0}/400 caractères.</Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  notes: {
    color: colors.text,
    backgroundColor: colors.panelRaised,
    borderRadius: 12,
    padding: 16,
    minHeight: 150,
    fontSize: 18,
    textAlignVertical: 'top',
  },
  content: { padding: 24, gap: 16 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700' },
  label: { color: colors.text, fontSize: 18, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  value: { color: colors.text, fontSize: 22, minWidth: 80, textAlign: 'center' },
  hint: { color: colors.textDim, fontSize: 16, lineHeight: 24 },
});
