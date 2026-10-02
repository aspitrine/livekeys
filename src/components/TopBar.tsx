import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { useEngineStatus } from '../engine/boot';
import { panic } from '../engine/pads';
import { LOAD_COLORS, loadLevel, usePerformance } from '../engine/performance';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { LevelMeter } from './LevelMeter';

/** Current patch with prev/next, status pills (MIDI, audio) and main actions. */
export function TopBar() {
  const concert = useConcert((s) => s.concert);
  const currentPatchId = useConcert((s) => s.currentPatchId);
  const stepPatch = useConcert((s) => s.stepPatch);
  // iPad portrait: icon-only actions to leave room for the patch name.
  const compact = useWindowDimensions().width < 1150;

  const patches = concert.sets.flatMap((set) => set.patches.map((patch) => ({ patch, set })));
  const index = patches.findIndex((p) => p.patch.id === currentPatchId);
  const current = patches[index];
  const next = patches[index + 1]?.patch;

  return (
    <View style={styles.bar}>
      <View style={styles.nav}>
        <Button
          icon="chevron.left"
          size="lg"
          variant="subtle"
          accessibilityLabel="Patch précédent"
          disabled={index <= 0}
          onPress={() => stepPatch(-1)}
        />
        <View style={styles.patch}>
          <Text style={styles.context} numberOfLines={1}>
            {current ? `${current.set.name} · ${index + 1}/${patches.length}` : 'Aucun patch'}
          </Text>
          <Text style={styles.patchName} numberOfLines={1} adjustsFontSizeToFit>
            {current?.patch.name ?? '—'}
          </Text>
          <Text style={styles.context} numberOfLines={1}>
            {next ? `Ensuite : ${next.name}` : 'Fin du concert'}
          </Text>
        </View>
        <Button
          icon="chevron.right"
          size="lg"
          variant="subtle"
          accessibilityLabel="Patch suivant"
          disabled={index < 0 || index >= patches.length - 1}
          onPress={() => stepPatch(1)}
        />
      </View>

      <View style={[styles.status, compact && styles.statusCompact]}>
        <MidiPill />
        <AudioPill />
      </View>

      <View style={styles.actions}>
        <Button
          icon="theatermasks.fill"
          label={compact ? undefined : 'Scène'}
          accessibilityLabel="Mode scène"
          variant="primary"
          size="lg"
          onPress={() => router.push('/stage')}
        />
        <Button
          icon="gearshape.fill"
          size="lg"
          variant="subtle"
          accessibilityLabel="Réglages"
          onPress={() => router.push('/settings')}
        />
        <Button
          icon="exclamationmark.octagon.fill"
          label={compact ? undefined : 'Panic'}
          variant="danger"
          size="lg"
          accessibilityLabel="Panic : coupe toutes les notes"
          onPress={panic}
        />
      </View>
    </View>
  );
}

/** MIDI input name with an activity LED that flashes on every note. */
function MidiPill() {
  const sources = useEngineStatus((s) => s.sources);
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const sub = AudioEngine.addListener('onMidiEvent', (e) => {
      if (e.type !== 'noteOn' && e.type !== 'cc') return;
      setActive(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setActive(false), 120);
    });
    return () => sub.remove();
  }, []);

  const connected = sources.length > 0;
  const led = active ? colors.accent : connected ? colors.success : colors.textMuted;

  return (
    <View style={styles.pill}>
      <View style={[styles.led, { backgroundColor: led }, active && styles.ledActive]} />
      <Icon name="pianokeys" size={14} color={connected ? colors.textDim : colors.textMuted} />
      <Text style={[styles.pillText, !connected && styles.muted]} numberOfLines={1}>
        {connected ? sources.map((s) => s.name).join(', ') : 'Aucun clavier'}
      </Text>
    </View>
  );
}

/** Audio engine load (tap for details) and output level. */
function AudioPill() {
  const { error } = useEngineStatus();
  const current = usePerformance((p) => p.current);
  const overloads = usePerformance((p) => p.overloads);
  const load = current?.load ?? 0;
  const color = error ? colors.danger : LOAD_COLORS[loadLevel(Math.max(load, (current?.peak ?? 0) * 0.75))];

  return (
    <Pressable
      onPress={() => router.push('/performance')}
      accessibilityLabel="Performance"
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Icon name={error ? 'exclamationmark.triangle.fill' : 'cpu'} size={14} color={color} />
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {error ? 'Audio indisponible' : current ? `DSP ${Math.round(load)} %` : 'Démarrage…'}
        {overloads > 0 && !error ? `  ·  ${overloads} ⚠︎` : ''}
      </Text>
      <View style={styles.meter}>
        <LevelMeter />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.panel,
    borderRadius: 16,
    padding: 10,
  },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  patch: { flex: 1, alignItems: 'center', minWidth: 0 },
  patchName: { color: colors.text, fontSize: 28, fontWeight: '800' },
  context: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  status: { width: 220, gap: 6 },
  statusCompact: { width: 170 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.panelRaised,
  },
  pillPressed: { opacity: 0.7 },
  pillText: { color: colors.textDim, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  muted: { color: colors.textMuted },
  led: { width: 8, height: 8, borderRadius: 4 },
  ledActive: { transform: [{ scale: 1.3 }] },
  meter: { flex: 1, minWidth: 40 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
