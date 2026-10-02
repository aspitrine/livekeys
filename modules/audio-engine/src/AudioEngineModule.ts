import { NativeModule, requireNativeModule } from 'expo';

import type {
  AudioEngineModuleEvents,
  BluetoothMidiDevice,
  BundledSoundFont,
  EngineInfo,
  EngineOptions,
  LayerConfig,
  MidiSource,
  PluginInfo,
  PluginKind,
  PluginParameter,
  PluginSlot,
  SoundFontPreset,
} from './AudioEngine.types';

declare class AudioEngineModule extends NativeModule<AudioEngineModuleEvents> {
  start(options: EngineOptions): Promise<EngineInfo>;
  stop(): void;
  getInfo(): EngineInfo;
  setMasterVolume(volume: number): void;
  panic(): void;
  setLimiterEnabled(enabled: boolean): void;
  showBluetoothMidi(): Promise<void>;
  /** BLE MIDI keyboards currently connected to the device. */
  getConnectedBluetoothMidi(): BluetoothMidiDevice[];
  /** Keeps these keyboards connected (auto-reconnect); [] releases them. */
  setBluetoothMidiDevices(ids: string[]): void;
  /** Only these layers receive new notes; other loaded layers ring out (patch change tails) or wait (preload). */
  setActiveLayers(ids: string[]): void;

  addLayer(id: string, config: Partial<LayerConfig>): Promise<void>;
  updateLayer(id: string, config: Partial<LayerConfig>): void;
  removeLayer(id: string): Promise<void>;
  /**
   * `path`: local file path or file:// URI to an .sf2/.dls file.
   * `bank`: SF2 bank number (0 = melodic, 1...127 = variations, 128 = drum kits).
   */
  loadSoundFont(layerId: string, path: string, program: number, bank: number): Promise<void>;
  /** Lists the presets of an .sf2 file, sorted by bank then program. */
  getSoundFontPresets(path: string): Promise<SoundFontPreset[]>;

  /** Sound banks shipped inside the app. */
  getBundledSoundFonts(): BundledSoundFont[];

  listPlugins(kind: PluginKind): Promise<PluginInfo[]>;
  /** Replaces the layer instrument by an Audio Unit, restoring `state` (base64) if given. */
  loadPlugin(layerId: string, componentId: string, state: string | null): Promise<void>;
  addEffect(
    layerId: string,
    effectId: string,
    componentId: string,
    state: string | null,
    bypass: boolean,
  ): Promise<void>;
  removeEffect(layerId: string, effectId: string): Promise<void>;
  setEffectBypass(layerId: string, effectId: string, bypass: boolean): void;
  getPluginState(layerId: string, slot: PluginSlot): Promise<string | null>;
  getPluginParameters(layerId: string, slot: PluginSlot): PluginParameter[];
  setPluginParameter(layerId: string, slot: PluginSlot, address: number, value: number): void;

  getMidiSources(): MidiSource[];
  setMidiMonitorEnabled(enabled: boolean): void;
  noteOn(note: number, velocity: number, channel: number): void;
  noteOff(note: number, channel: number): void;
}

export default requireNativeModule<AudioEngineModule>('AudioEngine');
