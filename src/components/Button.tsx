import { Pressable, type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '../theme';
import { Icon, type IconName } from './Icon';

type Props = {
  /** Visible text. Omit for an icon-only button (then set `accessibilityLabel`). */
  label?: string;
  icon?: IconName;
  onPress: () => void;
  onLongPress?: () => void;
  active?: boolean;
  activeColor?: string;
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

const SIZES = {
  sm: { height: 32, paddingHorizontal: 10, font: 14, icon: 14, radius: 8 },
  md: { height: 40, paddingHorizontal: 14, font: 15, icon: 16, radius: 10 },
  lg: { height: 52, paddingHorizontal: 18, font: 17, icon: 20, radius: 14 },
};

export function Button({
  label,
  icon,
  onPress,
  onLongPress,
  active,
  activeColor = colors.accent,
  variant = 'default',
  size = 'md',
  accessibilityLabel,
  style,
  disabled,
}: Props) {
  const s = SIZES[size];
  const bg = active
    ? activeColor
    : variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'subtle'
          ? colors.panelRaised
          : variant === 'ghost'
            ? 'transparent'
            : colors.control;
  const fg = variant === 'ghost' && !active ? colors.accent : colors.text;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          height: s.height,
          minWidth: s.height,
          paddingHorizontal: label ? s.paddingHorizontal : 0,
          borderRadius: s.radius,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon && <Icon name={icon} size={s.icon} color={fg} />}
      {label && <Text style={[styles.label, { color: fg, fontSize: s.font }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  label: { fontWeight: '600' },
});
