/** Only the native boundary is replaced; store, MIDI controls and pad logic stay real in tests. */
import { type LayoutChangeEvent, View } from 'react-native';

/** Native Audio Unit interface: a plain view that reports « no custom UI » unless a test lays it out with one. */
export function PluginEditorView({ onLoad }: { onLoad?: (e: { nativeEvent: { hasView: boolean } }) => void }) {
  return (
    <View
      testID="plugin-editor"
      onLayout={(e: LayoutChangeEvent | undefined) =>
        onLoad?.({ nativeEvent: { hasView: (e?.nativeEvent as { hasView?: boolean } | undefined)?.hasView ?? false } })
      }
    />
  );
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
  showBluetoothMidi: jest.fn(async () => {}),
  startMidi: jest.fn(async () => {}),
  listPlugins: jest.fn(() => Promise.resolve([])),
  getBundledSoundFonts: jest.fn(() => [
    { name: 'GeneralUser-GS', path: '/test/GeneralUser-GS.sf2' },
    { name: 'UprightPianoKW-small', path: '/test/UprightPianoKW-small.sf2' },
    { name: 'UprightPianoKW-bright', path: '/test/UprightPianoKW-bright.sf2' },
    { name: 'Wurlitzer-EP200', path: '/test/Wurlitzer-EP200.sf2' },
  ]),
  getSoundFontPresets: jest.fn(),
};
