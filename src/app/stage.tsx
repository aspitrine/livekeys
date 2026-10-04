import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../components/Icon';
import { StageNotes } from '../components/StageNotes';
import { usePadChord } from '../engine/pads';
import { chordName } from '../lib/chords';
import { panic } from '../engine/pads';
import { patchTempo, tap } from '../engine/tempo';
import { LevelMeter } from '../components/LevelMeter';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';

/** Stage view: readable from a distance, nothing to mis-tap. Halves of the screen switch patches. */
export default function StageScreen() {
  const concert = useConcert((s) => s.concert);
  const patch = useConcert(selectCurrentPatch);
  const stepPatch = useConcert((s) => s.stepPatch);
  const detected = usePadChord((s) => s.detected);
  const pad = patch?.layers.find((l) => l.pad);
  const padChord = pad?.pad ? (pad.pad.mode === 'fixed' ? pad.pad.chord : detected) : null;

  const patches = concert.sets.flatMap((s) => s.patches.map((p) => ({ patch: p, set: s })));
  const index = patches.findIndex((p) => p.patch.id === patch?.id);
  const prev = patches[index - 1]?.patch;
  const next = patches[index + 1]?.patch;
  const set = patches[index]?.set;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.topButton}>
          <Icon name="xmark" size={16} />
          <Text style={styles.topText}>Quitter</Text>
        </Pressable>
        <View style={styles.meter}>
          <LevelMeter />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Tap Tempo, ${patchTempo(patch)} BPM`}
          onPress={() => tap()}
          disabled={!patch}
          style={({ pressed }) => [styles.topButton, pressed && styles.pressed]}
        >
          <Icon name="metronome.fill" size={16} />
          <Text style={styles.topText}>{patchTempo(patch)} BPM</Text>
        </Pressable>
        <Pressable onPress={panic} style={[styles.topButton, styles.panic]}>
          <Icon name="exclamationmark.octagon.fill" size={16} />
          <Text style={styles.topText}>PANIC</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text style={styles.set}>{set?.name}</Text>
        <Text style={styles.index}>
          {index + 1} / {patches.length}
        </Text>
        <Text style={styles.current} numberOfLines={2} adjustsFontSizeToFit>
          {patch?.name ?? '—'}
        </Text>
        <Text style={styles.layers} numberOfLines={1}>
          {patch?.layers
            .filter((l) => !l.mute)
            .map((l) => l.name)
            .join('  ·  ')}
        </Text>
        <StageNotes notes={patch?.notes} />
        {pad?.pad?.playing && (
          <View style={styles.padPill}>
            <Icon name="waveform" size={18} color={pad.color} />
            <Text style={styles.padText}>Pad {padChord ? chordName(padChord) : '—'}</Text>
          </View>
        )}
      </View>

      <View style={styles.nav}>
        <Pressable
          onPress={() => stepPatch(-1)}
          disabled={!prev}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Icon name="chevron.left" size={40} weight="bold" color={prev ? colors.text : colors.textMuted} />
          <Text style={styles.navName} numberOfLines={1}>
            {prev?.name ?? ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => stepPatch(1)}
          disabled={!next}
          style={({ pressed }) => [styles.navButton, styles.navNext, pressed && styles.pressed]}
        >
          <Text style={styles.navName} numberOfLines={1}>
            {next?.name ?? ''}
          </Text>
          <Icon name="chevron.right" size={40} weight="bold" color={next ? colors.text : colors.textMuted} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', padding: 24 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  topButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.control,
  },
  topText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  panic: { backgroundColor: colors.danger },
  meter: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  set: { color: colors.textMuted, fontSize: 22, textTransform: 'uppercase', letterSpacing: 2 },
  index: { color: colors.textMuted, fontSize: 20, fontVariant: ['tabular-nums'] },
  current: { color: colors.text, fontSize: 96, fontWeight: '800', textAlign: 'center' },
  layers: { color: colors.textDim, fontSize: 20 },
  padPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.panel,
  },
  padText: { color: colors.text, fontSize: 26, fontWeight: '700' },
  nav: { flexDirection: 'row', gap: 16, height: 160 },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: colors.panel,
  },
  navNext: { justifyContent: 'flex-end' },
  pressed: { backgroundColor: colors.accent },
  navName: { color: colors.textDim, fontSize: 26, flexShrink: 1 },
});
