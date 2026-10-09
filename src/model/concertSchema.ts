import * as v from 'valibot';

import type { Concert } from './types';

/**
 * Shape of a concert coming from outside the app (imported file). Everything the engine and the UI rely on is
 * checked here, so a hand-edited or corrupted file is refused at the door instead of crashing a screen later.
 * Fields added over time are optional with their default, and unknown fields (e.g. the old per-layer reverb send)
 * are dropped.
 */

const midiValue = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(127));
const unit = v.pipe(v.number(), v.minValue(0), v.maxValue(1));

const SoundRefSchema = v.object({
  bank: v.string(),
  bankNumber: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(128)),
  program: midiValue,
  name: v.string(),
});

const PluginRefSchema = v.object({
  componentId: v.string(),
  name: v.string(),
  manufacturer: v.string(),
  state: v.optional(v.string()),
  preset: v.optional(v.string()),
  params: v.optional(v.record(v.string(), v.number())),
});

const EffectDefSchema = v.object({ id: v.string(), plugin: PluginRefSchema, bypass: v.boolean() });

const ChordSchema = v.object({
  root: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(11)),
  quality: v.picklist(['maj', 'min', '7', 'maj7', 'm7', 'sus2', 'sus4', 'add9', 'dim', 'aug', '5']),
});

const PadConfigSchema = v.object({
  mode: v.picklist(['follow', 'fixed']),
  chord: ChordSchema,
  base: midiValue,
  playing: v.boolean(),
  fade: v.optional(v.pipe(v.number(), v.minValue(0))),
});

const LayerDefSchema = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  volume: unit,
  pan: v.pipe(v.number(), v.minValue(-1), v.maxValue(1)),
  mute: v.boolean(),
  solo: v.boolean(),
  keyLow: midiValue,
  keyHigh: midiValue,
  velocityLow: midiValue,
  velocityHigh: midiValue,
  transpose: v.pipe(v.number(), v.integer(), v.minValue(-48), v.maxValue(48)),
  midiChannel: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(15)),
  sustainEnabled: v.boolean(),
  keyboard: v.optional(v.boolean()),
  sound: SoundRefSchema,
  plugin: v.optional(PluginRefSchema),
  effects: v.optional(v.array(EffectDefSchema), []),
  pad: v.optional(PadConfigSchema),
});

const PatchSchema = v.object({
  id: v.string(),
  name: v.string(),
  layers: v.array(LayerDefSchema),
  gainDb: v.optional(v.number()),
  notes: v.optional(v.string()),
  tempo: v.optional(v.number()),
});

const SetListSchema = v.object({ id: v.string(), name: v.string(), patches: v.array(PatchSchema) });

const indexed = (kind: 'layerVolume' | 'layerMute') =>
  v.object({ kind: v.literal(kind), index: v.pipe(v.number(), v.integer(), v.minValue(0)) });
const bare = (kind: 'masterVolume' | 'nextPatch' | 'prevPatch' | 'padToggle' | 'tapTempo' | 'panic') =>
  v.object({ kind: v.literal(kind) });

const MappingTargetSchema = v.variant('kind', [
  bare('masterVolume'),
  indexed('layerVolume'),
  indexed('layerMute'),
  bare('nextPatch'),
  bare('prevPatch'),
  bare('padToggle'),
  bare('tapTempo'),
  bare('panic'),
]);

const MidiMappingSchema = v.object({
  id: v.string(),
  cc: midiValue,
  channel: v.pipe(v.number(), v.integer(), v.minValue(-1), v.maxValue(15)),
  target: MappingTargetSchema,
  pickup: v.optional(v.boolean()),
});

/** Ids every list keys on: sets, patches, layers and effects must be unique across the whole concert. */
const concertIds = (c: Pick<Concert, 'sets' | 'masterEffects'>) => [
  ...c.sets.map((s) => s.id),
  ...c.sets.flatMap((s) => s.patches).map((p) => p.id),
  ...c.sets.flatMap((s) => s.patches.flatMap((p) => p.layers)).map((l) => l.id),
  ...c.sets.flatMap((s) => s.patches.flatMap((p) => p.layers.flatMap((l) => l.effects))).map((e) => e.id),
  ...(c.masterEffects ?? []).map((e) => e.id),
];

export const ConcertSchema = v.pipe(
  v.object({
    id: v.string(),
    name: v.string(),
    sets: v.array(SetListSchema),
    mappings: v.optional(v.array(MidiMappingSchema), []),
    masterEffects: v.optional(v.array(EffectDefSchema), []),
  }),
  v.check((c) => {
    const ids = concertIds(c);
    return new Set(ids).size === ids.length;
  }, 'Identifiants en double dans le concert.'),
);

/** Parses untrusted data into a concert, or returns the first problem in French with where it is. */
export function parseConcert(data: unknown): { concert: Concert } | { error: string } {
  const result = v.safeParse(ConcertSchema, data);
  if (result.success) return { concert: result.output };
  const issue = result.issues[0];
  const path = v.getDotPath(issue);
  return { error: path ? `${path} : ${issue.message}` : issue.message };
}
