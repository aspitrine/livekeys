import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { useEngineStatus } from '../engine/boot';
import { noteName } from '../lib/notes';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { LevelMeter } from './LevelMeter';

export function TopBar() {
  const patch = useConcert(selectCurrentPatch);
  const stepPatch = useConcert((s) => s.stepPatch);
  const { info, error, sources, lastEvent } = useEngineStatus();

  const midi = sources.length ? sources.map((s) => s.name).join(', ') : 'Aucune source MIDI';
  const event =
    lastEvent &&
    (lastEvent.type.startsWith('note')
      ? `${lastEvent.type} ${noteName(lastEvent.data1)} ${lastEvent.data2}`
      : `${lastEvent.type} ${lastEvent.data1} ${lastEvent.data2}`);

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <Button label="◀" onPress={() => stepPatch(-1)} style={styles.nav} />
        <Text style={styles.patch} numberOfLines={1}>
          {patch?.name ?? '—'}
        </Text>
        <Button label="▶" onPress={() => stepPatch(1)} style={styles.nav} />
        <Button label="Scène" variant="primary" onPress={() => router.push('/stage')} />
        <Button label="PANIC" variant="danger" onPress={() => AudioEngine.panic()} />
      </View>
      <View style={styles.row}>
        <Text style={[styles.info, error && { color: colors.danger }]} numberOfLines={1}>
          {error ??
            (info
              ? `${info.sampleRate / 1000} kHz · ${info.bufferFrames} frames (${info.ioBufferMs.toFixed(1)} ms) · ${info.outputRoute}`
              : 'Démarrage…')}
        </Text>
        <LevelMeter />
      </View>
      <Text style={styles.info} numberOfLines={1}>
        {midi}
        {event ? `  ·  ${event}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nav: { width: 52, height: 44 },
  patch: { flex: 1, color: colors.text, fontSize: 30, fontWeight: '700', textAlign: 'center' },
  info: { color: colors.textMuted, fontSize: 13 },
});
