import { NativeModule, requireNativeModule } from 'expo';

import type {
  AudioEngineModuleEvents,
  BluetoothMidiDevice,
  BundledSoundFont,
  EngineInfo,
  EngineOptions,
  LayerConfig,
  MidiSource,
  PerformanceInfo,
  PluginInfo,
  PluginQuery,
  PluginParameter,
  PluginPreset,
  PluginSlot,
  SoundFontPreset,
  VelocityCurveKind,
} from './AudioEngine.types';

declare class AudioEngineModule extends NativeModule<AudioEngineModuleEvents> {
  start(options: EngineOptions): Promise<EngineInfo>;
  stop(): void;
  getInfo(): EngineInfo;
  setMasterVolume(volume: number): void;
  /** Tempo (BPM, 20…300) reported to Audio Units through the host musical context (4/4, no transport). */
  setTempo(bpm: number): void;
  setMidiVolumeControls(bindings: { cc: number; channel: number }[]): void;
  setMidiVolumeLearn(enabled: boolean): void;
  panic(): void;
  /** Load figures since the previous call. */
  getPerformance(): PerformanceInfo;
  setLimiterEnabled(enabled: boolean): void;
  /** Gentle bus compression: louder average level, peaks held before the limiter. */
  setGlueEnabled(enabled: boolean): void;
  /** High-pass on the built-in speakers only (they distort on deep bass). */
  setSpeakerProtection(enabled: boolean): void;
  setVelocityCurve(curve: VelocityCurveKind): void;
  showBluetoothMidi(): Promise<void>;
  /** BLE MIDI keyboards currently connected to the device. */
  getConnectedBluetoothMidi(): BluetoothMidiDevice[];
  /** Keeps these keyboards connected (auto-reconnect); [] releases them. */
  setBluetoothMidiDevices(ids: string[]): void;
  /** Only these layers receive new notes; other loaded layers ring out (patch change tails) or wait (preload). */
  setActiveLayers(ids: string[]): void;

  addLayer(id: string, config: Partial<LayerConfig>): Promise<void>;
  /** Chord pads: the layer holds exactly `notes` (MIDI numbers); [] releases them. Changes crossfade over `fade` s. */
  setLayerNotes(layerId: string, notes: number[], velocity: number, fade: number): void;
  updateLayer(id: string, config: Partial<LayerConfig>): void;
  removeLayer(id: string): Promise<void>;
  /** True while a key or the sustain pedal still holds notes on the layer. */
  isLayerHeld(id: string): boolean;
  /**
   * `path`: local file path or file:// URI to an .sf2/.dls file.
   * `bank`: SF2 bank number (0 = melodic, 1...127 = variations, 128 = drum kits).
   */
  loadSoundFont(layerId: string, path: string, program: number, bank: number, gainDb: number): Promise<void>;
  /** Lists the presets of an .sf2 file, sorted by bank then program. */
  getSoundFontPresets(path: string): Promise<SoundFontPreset[]>;

  /** Sound banks shipped inside the app. */
  getBundledSoundFonts(): BundledSoundFont[];

  listPlugins(kind: PluginQuery): Promise<PluginInfo[]>;
  /** Replaces the layer instrument by an Audio Unit, restoring `state` (base64) if given. */
  loadPlugin(layerId: string, componentId: string, state: string | null): Promise<void>;
  /** Effect and plugin APIs also take `"master"` as layer id: the master bus insert chain (before the limiter). */
  addEffect(
    layerId: string,
    effectId: string,
    componentId: string,
    state: string | null,
    bypass: boolean,
  ): Promise<void>;
  removeEffect(layerId: string, effectId: string): Promise<void>;
  /** Reorders a layer's insert effects (ids in signal order). */
  setEffectOrder(layerId: string, ids: string[]): void;
  setEffectBypass(layerId: string, effectId: string, bypass: boolean): void;
  getPluginState(layerId: string, slot: PluginSlot): Promise<string | null>;
  getPluginParameters(layerId: string, slot: PluginSlot): PluginParameter[];
  /** Factory presets of the AU and the current preset number (-1 if none). */
  getPluginPresets(layerId: string, slot: PluginSlot): { presets: PluginPreset[]; current: number };
  selectPluginPreset(layerId: string, slot: PluginSlot, number: number): void;
  setPluginParameter(layerId: string, slot: PluginSlot, address: number, value: number): void;

  getMidiSources(): MidiSource[];
  setMidiMonitorEnabled(enabled: boolean): void;
  /** Re-scans and reconnects MIDI sources. */
  refreshMidi(): void;
  /** Retries CoreMIDI setup after `start` reported `midiError`. Throws while CoreMIDI is still unavailable. */
  startMidi(): Promise<void>;
  noteOn(note: number, velocity: number, channel: number): void;
  noteOff(note: number, channel: number): void;
}

export default requireNativeModule<AudioEngineModule>('AudioEngine');
