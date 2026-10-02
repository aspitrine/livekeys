import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AudioEngine from '../../modules/audio-engine';
import { LevelMeter } from '../components/LevelMeter';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';

/** Stage view: readable from a distance, nothing to mis-tap. Halves of the screen switch patches. */
export default function StageScreen() {
  const concert = useConcert((s) => s.concert);
  const patch = useConcert(selectCurrentPatch);
  const stepPatch = useConcert((s) => s.stepPatch);

  const patches = concert.sets.flatMap((s) => s.patches.map((p) => ({ patch: p, set: s })));
  const index = patches.findIndex((p) => p.patch.id === patch?.id);
  const prev = patches[index - 1]?.patch;
  const next = patches[index + 1]?.patch;
  const set = patches[index]?.set;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} style={styles.topButton}>
          <Text style={styles.topText}>Quitter</Text>
        </Pressable>
        <View style={styles.meter}>
          <LevelMeter />
        </View>
        <Pressable onPress={() => AudioEngine.panic()} style={[styles.topButton, styles.panic]}>
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
      </View>

      <View style={styles.nav}>
        <Pressable
          onPress={() => stepPatch(-1)}
          disabled={!prev}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Text style={styles.navArrow}>◀</Text>
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
          <Text style={styles.navArrow}>▶</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000', padding: 24 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  topButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.control },
  topText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  panic: { backgroundColor: colors.danger },
  meter: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  set: { color: colors.textMuted, fontSize: 22, textTransform: 'uppercase', letterSpacing: 2 },
  index: { color: colors.textMuted, fontSize: 20, fontVariant: ['tabular-nums'] },
  current: { color: colors.text, fontSize: 96, fontWeight: '800', textAlign: 'center' },
  layers: { color: colors.textDim, fontSize: 20 },
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
  navArrow: { color: colors.text, fontSize: 40 },
  navName: { color: colors.textDim, fontSize: 26, flexShrink: 1 },
});
