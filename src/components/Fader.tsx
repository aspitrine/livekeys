import { useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type Props = {
  value: number;
  onChange: (value: number) => void;
  color?: string;
  /** Fixed height; omit to fill the parent (flex: 1). */
  height?: number;
};

const THUMB = 28;

/** Vertical mixer fader, 0...1. Drag anywhere on the track; the value follows the finger relatively. */
export function Fader({ value, onChange, color = colors.accent, height }: Props) {
  const [trackHeight, setTrackHeight] = useState(height ?? 220);
  const start = useRef(value);
  const latest = useRef({ value, onChange, trackHeight });
  latest.current = { value, onChange, trackHeight };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.value;
      },
      onPanResponderMove: (_, g) => {
        const range = latest.current.trackHeight - THUMB;
        const next = Math.min(Math.max(start.current - g.dy / range, 0), 1);
        latest.current.onChange(Math.round(next * 100) / 100);
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setTrackHeight(e.nativeEvent.layout.height);
  const thumbTop = (1 - value) * (trackHeight - THUMB);

  return (
    <View style={[styles.track, height ? { height } : styles.fill1]} onLayout={onLayout} {...responder.panHandlers}>
      <View style={styles.rail} />
      <View style={[styles.fill, { top: thumbTop + THUMB / 2, backgroundColor: color }]} />
      <View style={[styles.thumb, { top: thumbTop }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 56, alignItems: 'center' },
  fill1: { flex: 1, minHeight: 160 },
  rail: {
    position: 'absolute',
    top: THUMB / 2,
    bottom: THUMB / 2,
    width: 6,
    borderRadius: 3,
    backgroundColor: colors.control,
  },
  fill: { position: 'absolute', bottom: THUMB / 2, width: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 52,
    height: THUMB,
    borderRadius: 6,
    backgroundColor: '#d9dbe3',
    borderWidth: 1,
    borderColor: '#9a9cab',
  },
});
