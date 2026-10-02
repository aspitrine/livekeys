import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  active?: boolean;
  activeColor?: string;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function Button({
  label,
  onPress,
  onLongPress,
  active,
  activeColor = colors.accent,
  variant = 'default',
  style,
  disabled,
}: Props) {
  const bg = active
    ? activeColor
    : variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? 'transparent'
          : colors.control;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'ghost' && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.text, fontWeight: '600', fontSize: 15 },
});
