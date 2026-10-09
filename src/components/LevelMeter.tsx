import { useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { useEngineEvent } from '../engine/events';
import { colors } from '../theme';

/** Output ceiling of the engine (−1 dBFS): a full bar means the output is at its maximum. */
const CEILING = 0.891;

/** Colour from what the limiter is taking off: none, a little (fine), a lot (too loud, it squashes). */
export const reductionColor = (db: number) => (db > 6 ? colors.danger : db > 1 ? colors.warning : colors.success);

/** What the meter shows: bar width in whole %, and its colour. */
const display = ({ peak, reductionDb }: { peak: number; reductionDb: number }) => ({
  pct: Math.round(Math.min(peak / CEILING, 1) * 100),
  color: reductionColor(reductionDb),
});

/** Real output peak (after limiter), ~30 Hz. Coloured by how hard the limiter works. */
export function LevelMeter({ style }: { style?: StyleProp<ViewStyle> }) {
  const [shown, setShown] = useState(() => display({ peak: 0, reductionDb: 0 }));
  useEngineEvent('onLevel', (e) => {
    // Levels arrive ~30 times per second, silence included: re-render only when the bar visibly changes.
    const next = display(e);
    if (next.pct !== shown.pct || next.color !== shown.color) setShown(next);
  });

  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${shown.pct}%`, backgroundColor: shown.color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.control, borderRadius: 4, overflow: 'hidden', flex: 1 },
  fill: { height: '100%' },
});
