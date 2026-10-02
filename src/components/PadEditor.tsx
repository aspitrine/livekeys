import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_FADE, usePadChord } from '../engine/pads';
import { chordName, QUALITIES, ROOT_NAMES, ROOT_NAMES_FR } from '../lib/chords';
import type { LayerDef, PadConfig } from '../model/types';
import { colors } from '../theme';
import { Button } from './Button';

const FADES = [
  { seconds: 0.5, label: 'Rapide' },
  { seconds: 2, label: 'Normale' },
  { seconds: 4, label: 'Lente' },
  { seconds: 8, label: 'Très lente' },
];

const REGISTERS = [
  { base: 36, label: 'Grave' },
  { base: 48, label: 'Médium' },
  { base: 60, label: 'Aigu' },
];

/** Chord-pad settings: follow the keyboard or hold a chosen chord, register, on/off. */
export function PadEditor({ layer, onChange }: { layer: LayerDef; onChange: (pad: PadConfig) => void }) {
  const pad = layer.pad!;
  const detected = usePadChord((s) => s.detected);
  const set = (patch: Partial<PadConfig>) => onChange({ ...pad, ...patch });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Pad d’accords</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Button
            icon="waveform.badge.magnifyingglass"
            label="Suit les accords joués"
            active={pad.mode === 'follow'}
            onPress={() => set({ mode: 'follow' })}
          />
          <Button
            icon="lock.fill"
            label="Accord fixe"
            active={pad.mode === 'fixed'}
            onPress={() => set({ mode: 'fixed' })}
          />
          <View style={styles.flex} />
          <Button
            icon={pad.playing ? 'stop.fill' : 'play.fill'}
            label={pad.playing ? 'Stop' : 'Jouer'}
            active={pad.playing}
            activeColor={layer.color}
            onPress={() => set({ playing: !pad.playing })}
          />
        </View>

        {pad.mode === 'follow' ? (
          <View style={styles.detected}>
            <Text style={styles.chord}>{detected ? chordName(detected) : '—'}</Text>
            <Text style={styles.hint}>
              Joue un accord sur ton piano : le pad le reprend et le tient jusqu’au suivant. La note la plus grave donne
              la tonique (C/E reste un accord de C).
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Tonique</Text>
            <View style={styles.grid}>
              {ROOT_NAMES.map((name, root) => (
                <Button
                  key={name}
                  label={`${name}  ${ROOT_NAMES_FR[root]}`}
                  active={pad.chord.root === root}
                  onPress={() => set({ chord: { ...pad.chord, root } })}
                  style={styles.rootButton}
                />
              ))}
            </View>
            <Text style={styles.label}>Type d’accord</Text>
            <View style={styles.grid}>
              {QUALITIES.map((q) => (
                <Button
                  key={q.id}
                  label={q.label}
                  active={pad.chord.quality === q.id}
                  onPress={() => set({ chord: { ...pad.chord, quality: q.id } })}
                />
              ))}
            </View>
            <Text style={styles.chord}>{chordName(pad.chord)}</Text>
          </>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>Transition</Text>
          {FADES.map((f) => (
            <Button
              key={f.seconds}
              label={f.label}
              active={(pad.fade ?? DEFAULT_FADE) === f.seconds}
              onPress={() => set({ fade: f.seconds })}
            />
          ))}
        </View>
        <Text style={styles.hint}>
          Durée du fondu enchaîné quand l’accord change (le nouvel accord monte pendant que l’ancien s’éteint).
        </Text>

        <View style={styles.row}>
          <Text style={styles.label}>Registre</Text>
          {REGISTERS.map((r) => (
            <Button key={r.base} label={r.label} active={pad.base === r.base} onPress={() => set({ base: r.base })} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rootButton: { minWidth: 92 },
  label: { color: colors.textDim, width: 90 },
  detected: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  chord: { color: colors.text, fontSize: 40, fontWeight: '800', textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});
