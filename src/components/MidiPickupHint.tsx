import { StyleSheet, Text } from 'react-native';
import { sameTarget, useMidiPickup } from '../engine/controls';
import type { MappingTarget } from '../model/types';
import { useConcert } from '../store/concert';
import { colors } from '../theme';

export function MidiPickupHint({ target }: { target: MappingTarget }) {
  const mappings = useConcert((s) => s.concert.mappings);
  const waiting = useMidiPickup((s) => s.waiting);
  const directions = mappings.filter((m) => m.pickup && sameTarget(m.target, target)).map((m) => waiting[m.id]);
  const direction = directions.find(Boolean);
  return direction ? (
    <Text style={styles.hint}>{direction === 'up' ? '↑ Monter le fader' : '↓ Baisser le fader'}</Text>
  ) : null;
}
const styles = StyleSheet.create({ hint: { color: colors.warning, fontSize: 12, textAlign: 'center' } });
