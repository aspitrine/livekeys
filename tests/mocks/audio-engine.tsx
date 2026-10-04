/** Only the native boundary is replaced; store, MIDI controls and pad logic stay real in tests. */
import { View } from 'react-native';

/** Native Audio Unit interface: a plain view that reports « no custom UI ». */
export function PluginEditorView({ onLoad }: { onLoad?: (e: { nativeEvent: { hasView: boolean } }) => void }) {
  return <View testID="plugin-editor" onLayout={() => onLoad?.({ nativeEvent: { hasView: false } })} />;
}

export default {
  setMidiVolumeControls: jest.fn(),
  setMidiVolumeLearn: jest.fn(),
  setTempo: jest.fn(),
  setMasterVolume: jest.fn(),
  setLimiterEnabled: jest.fn(),
  setMidiMonitorEnabled: jest.fn(),
  setBluetoothMidiDevices: jest.fn(),
  getConnectedBluetoothMidi: jest.fn(() => []),
  getPerformance: jest.fn(() => ({
    load: 0,
    peak: 0,
    overloads: 0,
    layers: [],
    cpu: 0,
    memoryMB: 0,
    availableMemoryMB: 0,
  })),
  addLayer: jest.fn(),
  updateLayer: jest.fn(),
  removeLayer: jest.fn(),
  isLayerHeld: jest.fn(() => false),
  setActiveLayers: jest.fn(),
  loadSoundFont: jest.fn(),
  loadPlugin: jest.fn(),
  addEffect: jest.fn(),
  removeEffect: jest.fn(),
  setEffectOrder: jest.fn(),
  setEffectBypass: jest.fn(),
  getPluginState: jest.fn(),
  getPluginPresets: jest.fn(() => ({ presets: [] })),
  getPluginParameters: jest.fn(() => []),
  selectPluginPreset: jest.fn(),
  setPluginParameter: jest.fn(),
  setLayerNotes: jest.fn(),
  panic: jest.fn(),
  setGlueEnabled: jest.fn(),
  setSpeakerProtection: jest.fn(),
  setVelocityCurve: jest.fn(),
  noteOn: jest.fn(),
  noteOff: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  start: jest.fn(),
  getInfo: jest.fn(),
  getMidiSources: jest.fn(() => []),
  refreshMidi: jest.fn(),
  listPlugins: jest.fn(() => Promise.resolve([])),
  getBundledSoundFonts: jest.fn(() => [
    { name: 'GeneralUser-GS', path: '/test/GeneralUser-GS.sf2' },
    { name: 'UprightPianoKW-small', path: '/test/UprightPianoKW-small.sf2' },
  ]),
  getSoundFontPresets: jest.fn(),
};
