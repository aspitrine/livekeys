import type { LayerConfig } from '../../modules/audio-engine';
import { newId } from '../lib/id';
import { PIANO_HIGH, PIANO_LOW } from '../lib/notes';
import { layerColors } from '../theme';
import { SOUNDS } from './sounds';
import type { Concert, LayerDef, Patch, SoundRef } from './types';

export const DEFAULT_LAYER_CONFIG: LayerConfig = {
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  keyLow: PIANO_LOW,
  keyHigh: PIANO_HIGH,
  velocityLow: 1,
  velocityHigh: 127,
  transpose: 0,
  midiChannel: -1,
  sustainEnabled: true,
};

export function makeLayer(sound: SoundRef, index: number, config: Partial<LayerConfig> = {}): LayerDef {
  return {
    ...DEFAULT_LAYER_CONFIG,
    ...config,
    id: newId(),
    name: sound.name,
    color: layerColors[index % layerColors.length],
    sound,
    effects: [],
  };
}

export function makePatch(name: string, layers: { sound: SoundRef; config?: Partial<LayerConfig> }[]): Patch {
  return { id: newId(), name, layers: layers.map((l, i) => makeLayer(l.sound, i, l.config)) };
}

export function defaultConcert(): Concert {
  return {
    id: newId(),
    name: 'Mon concert',
    mappings: [],
    sets: [
      {
        id: newId(),
        name: 'Set 1',
        patches: [
          makePatch('Piano', [{ sound: SOUNDS.upright }]),
          makePatch('Piano + Pad', [{ sound: SOUNDS.grand }, { sound: SOUNDS.warmPad, config: { volume: 0.4 } }]),
          makePatch('Basse / EP', [
            { sound: SOUNDS.fingerBass, config: { keyHigh: 47 } },
            { sound: SOUNDS.tineEP, config: { keyLow: 48 } },
          ]),
          makePatch('Orgue', [{ sound: SOUNDS.drawbar }]),
          makePatch('Cordes', [{ sound: SOUNDS.strings }]),
        ],
      },
    ],
  };
}

/** What the layer plays, for display. */
export const instrumentName = (layer: LayerDef) => layer.plugin?.name ?? layer.sound.name;
