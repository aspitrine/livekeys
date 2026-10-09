import type { LayerConfig } from '../../modules/audio-engine';
import { newId } from '../lib/id';
import { PIANO_HIGH, PIANO_LOW } from '../lib/notes';
import { EFFECT_PRESETS } from './effectCategories';
import { SOUNDS } from './sounds';
import type { Concert, EffectDef, LayerDef, Patch, SoundRef } from './types';

/** Layer colors, assigned round-robin when a layer is created. Saved with the concert, so part of the model. */
export const LAYER_COLORS = ['#4f8cff', '#f5a524', '#46a758', '#d6409f', '#8e4ec6', '#12a594', '#e54d2e', '#ffc53d'];

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
    color: LAYER_COLORS[index % LAYER_COLORS.length]!,
    sound,
    effects: [],
  };
}

/** A chord pad following the keyboard, on a warm pad sound. */
export function makePadLayer(index: number): LayerDef {
  return {
    ...makeLayer(SOUNDS.warmPad, index, { volume: 0.1 }),
    name: 'Pad',
    pad: { mode: 'follow', chord: { root: 0, quality: 'maj' }, base: 48, playing: true },
  };
}

/** A ready-to-use effect (`EFFECT_PRESETS` id, e.g. "rv-chamber"), Apple Audio Units available on every iPad. */
export function makeEffect(presetId: string): EffectDef {
  const preset = EFFECT_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new Error(`Unknown effect preset ${presetId}`);
  return { id: newId(), plugin: preset.plugin, bypass: false };
}

type LayerSpec = { sound: SoundRef; config?: Partial<LayerConfig>; effects?: string[] };

export function makePatch(name: string, layers: LayerSpec[], extra: Partial<Omit<Patch, 'id' | 'name'>> = {}): Patch {
  return {
    id: newId(),
    name,
    layers: layers.map((l, i) => ({ ...makeLayer(l.sound, i, l.config), effects: (l.effects ?? []).map(makeEffect) })),
    ...extra,
  };
}

/** A new patch: the sampled upright piano in a small room, playable as is. */
export const newPatch = (name: string) => makePatch(name, [{ sound: SOUNDS.upright, effects: ['rv-chamber'] }]);

export function defaultConcert(): Concert {
  return {
    id: newId(),
    name: 'Mon concert',
    mappings: [],
    masterEffects: [],
    sets: [
      {
        id: newId(),
        name: 'Set 1',
        // Ready to play with the bundled sounds and Apple effects only (nothing to download). Levels are set by ear
        // over the measured per-sound correction: layered sounds sit under the main one.
        patches: [
          makePatch('Piano', [{ sound: SOUNDS.upright, effects: ['rv-chamber'] }]),
          makePatch('Piano + Pad', [
            { sound: SOUNDS.upright, effects: ['rv-room'] },
            // Under the piano and without its low end, so the left hand stays clear.
            { sound: SOUNDS.warmPad, config: { volume: 0.35 }, effects: ['eq-lowcut', 'rv-large-hall'] },
          ]),
          makePatch(
            'Basse / EP',
            [
              { sound: SOUNDS.fingerBass, config: { keyHigh: 47, volume: 0.85, sustainEnabled: false } },
              { sound: SOUNDS.wurlitzer, config: { keyLow: 48 }, effects: ['rv-plate'] },
            ],
            { notes: 'Basse à la main gauche jusqu’au Si 2, Wurlitzer à droite.' },
          ),
          makePatch('Orgue', [{ sound: SOUNDS.drawbar, config: { volume: 0.7 }, effects: ['rv-room'] }]),
          makePatch('Cordes', [{ sound: SOUNDS.strings, effects: ['rv-large-hall'] }]),
          makePatch('Piano pop', [{ sound: SOUNDS.brightUpright, effects: ['dy-light', 'rv-plate'] }]),
          makePatch('Wurlitzer', [{ sound: SOUNDS.wurlitzer, effects: ['dl-slap', 'rv-plate'] }]),
          makePatch('Piano & cordes', [
            { sound: SOUNDS.upright, effects: ['rv-chamber'] },
            { sound: SOUNDS.strings, config: { volume: 0.4 }, effects: ['eq-lowcut', 'rv-large-hall'] },
          ]),
          makePatch('Nappe ambient', [
            { sound: SOUNDS.choirPad, config: { volume: 0.6 }, effects: ['dl-ambient', 'rv-cathedral'] },
            { sound: SOUNDS.warmPad, config: { volume: 0.5, transpose: -12 }, effects: ['eq-lowcut'] },
          ]),
        ],
      },
    ],
  };
}

/** What the layer plays, for display. */
export const instrumentName = (layer: LayerDef) => layer.plugin?.name ?? layer.sound.name;
