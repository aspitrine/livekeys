import { requireNativeView } from 'expo';
import type { StyleProp, ViewStyle } from 'react-native';

import type { PluginSlot } from './AudioEngine.types';

export type PluginEditorViewProps = {
  layerId: string;
  slot: PluginSlot;
  /** `hasView: false` when the Audio Unit has no custom UI. */
  onLoad?: (event: { nativeEvent: { hasView: boolean } }) => void;
  style?: StyleProp<ViewStyle>;
};

/** Native host for an Audio Unit's own interface. */
export const PluginEditorView = requireNativeView<PluginEditorViewProps>('AudioEngine');
