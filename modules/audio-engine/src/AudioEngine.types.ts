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
  /** Set by `start` when audio runs but CoreMIDI could not be set up yet: retry with `startMidi`. */
  midiError?: string;
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
  /** false for chord pads: ignore the keyboard, play only notes sent with setLayerNotes. Default true. */
  keyboard?: boolean;
};
export type VelocityCurveKind = 'light' | 'normal' | 'heavy';

export type BundledSoundFont = { name: string; path: string };

export type SoundFontPreset = { name: string; program: number; bank: number };

export type PluginKind = 'instrument' | 'effect';
/** `all` lists every Audio Unit type (diagnostics). */
export type PluginQuery = PluginKind | 'all';

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

export type PluginPreset = { number: number; name: string };

/** `"instrument"` or an effect id. */
export type PluginSlot = string;

export type BluetoothMidiDevice = {
  /** CoreBluetooth peripheral identifier (stable per iPad). */
  id: string;
  name: string;
  state: 'connected' | 'connecting' | 'disconnected';
};

export type PerformanceInfo = {
  /** Average render time of the whole graph since the last call, in % of the buffer duration. */
  load: number;
  /** Worst render cycle since the last call, in %. Above 100 % the audio glitches. */
  peak: number;
  /** Render cycles over 100 % since the last call. */
  overloads: number;
  /** Same measures per layer (instrument + its effects). */
  layers: { id: string; load: number; peak: number }[];
  /** CPU used by the app, % of the whole device. */
  cpu: number;
  memoryMB: number;
  /** Memory the app can still use before iOS terminates it. */
  availableMemoryMB: number;
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
  /** `peak`: real output peak (after limiter and −1 dBFS ceiling). `reductionDb`: what the limiter takes off. */
  onLevel: (event: { peak: number; reductionDb: number }) => void;
  /** Audio came back after an interruption (call, Siri) or a route change. */
  onEngineRestarted: () => void;
  onBluetoothMidiChanged: (event: { devices: BluetoothMidiDevice[] }) => void;
};
