import type { LayerConfig } from '../../modules/audio-engine';

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
  | { kind: 'panic' };

export type MidiMapping = {
  id: string;
  cc: number;
  /** -1 = any channel. */
  channel: number;
  target: MappingTarget;
};

export type Concert = { id: string; name: string; sets: SetList[]; mappings: MidiMapping[] };
