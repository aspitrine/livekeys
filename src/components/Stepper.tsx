import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { Button } from './Button';

type Props = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Extra coarse steps, e.g. [12] for octaves. */
  bigStep?: number;
  format?: (value: number) => string;
};

export function Stepper({ value, onChange, min, max, bigStep, format = String }: Props) {
  const set = (v: number) => onChange(Math.min(Math.max(v, min), max));
  return (
    <View style={styles.row}>
      {bigStep && <Button label={`−${bigStep}`} onPress={() => set(value - bigStep)} />}
      <Button label="−" onPress={() => set(value - 1)} style={styles.small} />
      <Text style={styles.value}>{format(value)}</Text>
      <Button label="+" onPress={() => set(value + 1)} style={styles.small} />
      {bigStep && <Button label={`+${bigStep}`} onPress={() => set(value + bigStep)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  small: { width: 40 },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    minWidth: 64,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
