export type EngineOptions = {
  /** Preferred hardware sample rate. Default 48000. */
  sampleRate?: number;
  /** Preferred IO buffer size in frames. Default 128 (~2.7 ms @ 48 kHz). */
  bufferFrames?: number;
};

export type EngineInfo = {
  running: boolean;
  sampleRate: number;
  bufferFrames: number;
  ioBufferMs: number;
  outputLatencyMs: number;
  outputRoute: string;
};

export type LayerConfig = {
  /** 0...1 */
  volume: number;
  /** -1 (left) ... 1 (right) */
  pan: number;
  mute: boolean;
  solo: boolean;
  /** MIDI note range (split), 0...127 */
  keyLow: number;
  keyHigh: number;
  /** Velocity range, 1...127 */
  velocityLow: number;
  velocityHigh: number;
  /** Semitones, -48...48 */
  transpose: number;
  /** -1 = omni, 0...15 */
  midiChannel: number;
  sustainEnabled: boolean;
};

export type BundledSoundFont = { name: string; path: string };

export type SoundFontPreset = { name: string; program: number; bank: number };

export type PluginKind = 'instrument' | 'effect';

export type PluginInfo = {
  /** "type:subtype:manufacturer" four-char codes. */
  id: string;
  name: string;
  manufacturer: string;
  kind: PluginKind;
  isAUv3: boolean;
};

export type PluginParameter = {
  address: number;
  name: string;
  min: number;
  max: number;
  value: number;
  unit: string;
};

/** `"instrument"` or an effect id. */
export type PluginSlot = string;

export type BluetoothMidiDevice = {
  /** CoreBluetooth peripheral identifier (stable per iPad). */
  id: string;
  name: string;
  state: 'connected' | 'connecting' | 'disconnected';
};

export type MidiSource = { id: number; name: string };

export type MidiEvent = {
  type: 'noteOn' | 'noteOff' | 'cc' | 'pitchBend' | 'programChange';
  channel: number;
  data1: number;
  data2: number;
};

export type AudioEngineModuleEvents = {
  onMidiEvent: (event: MidiEvent) => void;
  onMidiSourcesChanged: (event: { sources: MidiSource[] }) => void;
  onLevel: (event: { peak: number }) => void;
  onBluetoothMidiChanged: (event: { devices: BluetoothMidiDevice[] }) => void;
};
