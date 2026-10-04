import { useRef } from 'react';
import { PanResponder, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  /** Direction the item moves: rows (`y`, default) or mixer strips (`x`). */
  axis?: 'x' | 'y';
  onStart: () => void;
  /** Finger offset along the axis since the start. */
  onMove: (delta: number) => void;
  onEnd: (delta: number) => void;
  /** VoiceOver alternative to dragging: one position before (−1) or after (+1). */
  onStep: (delta: number) => void;
  style?: StyleProp<ViewStyle>;
};

/** Grip that drags its item. The rest of the item keeps its own taps and long-press menu. */
export function DragHandle({ label, axis = 'y', onStep, style, ...drag }: Props) {
  const latest = useRef({ ...drag, axis });
  latest.current = { ...drag, axis };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => latest.current.onStart(),
      onPanResponderMove: (_, g) => latest.current.onMove(latest.current.axis === 'x' ? g.dx : g.dy),
      onPanResponderRelease: (_, g) => latest.current.onEnd(latest.current.axis === 'x' ? g.dx : g.dy),
      onPanResponderTerminate: (_, g) => latest.current.onEnd(latest.current.axis === 'x' ? g.dx : g.dy),
    }),
  ).current;
  const [before, after] = axis === 'x' ? ['Vers la gauche', 'Vers la droite'] : ['Monter', 'Descendre'];
  return (
    <View
      testID={label}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityActions={[
        { name: 'decrement', label: before },
        { name: 'increment', label: after },
      ]}
      onAccessibilityAction={(e) => onStep(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      hitSlop={8}
      style={[styles.handle, style]}
      {...responder.panHandlers}
    >
      <Icon name={axis === 'x' ? 'arrow.left.and.right' : 'line.3.horizontal'} size={16} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: { minWidth: 24, height: 28, alignItems: 'center', justifyContent: 'center' },
});
