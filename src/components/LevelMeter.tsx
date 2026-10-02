import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { colors } from '../theme';

/** Output ceiling of the engine (−1 dBFS): a full bar means the output is at its maximum. */
const CEILING = 0.891;

/** Colour from what the limiter is taking off: none, a little (fine), a lot (too loud, it squashes). */
export const reductionColor = (db: number) => (db > 6 ? colors.danger : db > 1 ? colors.warning : colors.success);

/** Real output peak (after limiter), ~30 Hz. Coloured by how hard the limiter works. */
export function LevelMeter() {
  const [level, setLevel] = useState({ peak: 0, reductionDb: 0 });
  useEffect(() => {
    const sub = AudioEngine.addListener('onLevel', (e) => setLevel(e));
    return () => sub.remove();
  }, []);

  const pct = Math.min(level.peak / CEILING, 1) * 100;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: reductionColor(level.reductionDb) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.control, borderRadius: 4, overflow: 'hidden', flex: 1 },
  fill: { height: '100%' },
});
