import type { LayerConfig } from '../../modules/audio-engine';
import type { Chord } from '../lib/chords';

/** A preset inside a bundled sound bank. */
export type SoundRef = {
  /** Bundled bank file name without extension, e.g. "GeneralUser-GS". */
  bank: string;
  /** SF2 bank number: 0 = melodic, 1...127 = variations, 128 = drum kits. */
  bankNumber: number;
  program: number;
  name: string;
};

/** An Audio Unit (AUv3 or Apple built-in) with its saved state. */
export type PluginRef = {
  componentId: string;
  name: string;
  manufacturer: string;
  /** Base64 plist from the AU's fullState, captured when its editor closes or its patch unloads. */
  state?: string;
  /** Initial setup when there is no saved state yet: factory preset name, then parameter values by address. */
  preset?: string;
  params?: Record<string, number>;
};

export type EffectDef = { id: string; plugin: PluginRef; bypass: boolean };

export type LayerDef = LayerConfig & {
  id: string;
  name: string;
  color: string;
  /** SoundFont preset, used when `plugin` is not set. */
  sound: SoundRef;
  /** AUv3 instrument replacing the SoundFont sampler. */
  plugin?: PluginRef;
  effects: EffectDef[];
  /** Set on chord-pad layers: they ignore the keyboard and hold a chord. */
  pad?: PadConfig;
};

/** Chord pad: holds the chord detected from the keyboard (`follow`) or a chosen one (`fixed`). */
export type PadConfig = {
  mode: 'follow' | 'fixed';
  /** Chord played in `fixed` mode. */
  chord: Chord;
  /** MIDI note of the C the voicing is built around (48 = C3). */
  base: number;
  /** Pad on/off. Starts on when its patch is selected. */
  playing: boolean;
  /** Crossfade between chords, in seconds (default 2). */
  fade?: number;
};

export type Patch = { id: string; name: string; layers: LayerDef[] };

export type SetList = { id: string; name: string; patches: Patch[] };

/** What a hardware controller (fader, knob, pedal, button) drives. */
export type MappingTarget =
  | { kind: 'masterVolume' }
  /** Volume of the Nth layer of whatever patch is current (like MainStage screen controls). */
  | { kind: 'layerVolume'; index: number }
  | { kind: 'nextPatch' }
  | { kind: 'prevPatch' }
  | { kind: 'padToggle' }
  | { kind: 'panic' };

export type MidiMapping = {
  id: string;
  cc: number;
  /** -1 = any channel. */
  channel: number;
  target: MappingTarget;
};

export type Concert = { id: string; name: string; sets: SetList[]; mappings: MidiMapping[] };
