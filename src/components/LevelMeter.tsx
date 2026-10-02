import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { colors } from '../theme';

/** Master peak meter fed by the native tap (~30 Hz). */
export function LevelMeter() {
  const [peak, setPeak] = useState(0);
  useEffect(() => {
    const sub = AudioEngine.addListener('onLevel', (e) => setPeak(e.peak));
    return () => sub.remove();
  }, []);

  const pct = Math.min(peak, 1) * 100;
  const color = peak > 0.95 ? colors.danger : peak > 0.7 ? colors.warning : colors.success;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.control, borderRadius: 4, overflow: 'hidden', flex: 1 },
  fill: { height: '100%' },
});
