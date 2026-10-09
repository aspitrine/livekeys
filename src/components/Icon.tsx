import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import type { IconName } from '../model/icons';
import { colors } from '../theme';

export type { IconName };

type Props = { name: IconName; size?: number; color?: ColorValue; weight?: SymbolWeight };

/** SF Symbol (native iOS icon). */
export function Icon({ name, size = 18, color = colors.text, weight = 'semibold' }: Props) {
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} resizeMode="scaleAspectFit" />;
}
