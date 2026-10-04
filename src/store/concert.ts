import type { VelocityCurveKind } from '../../modules/audio-engine';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { defaultConcert, makeLayer, makePadLayer, makePatch } from '../model/defaults';
import { SOUNDS } from '../model/sounds';
import {
  type Concert,
  type EffectDef,
  type LayerDef,
  MASTER_ID,
  type MidiMapping,
  type Patch,
  type PluginRef,
  type SetList,
  type SoundRef,
} from '../model/types';
import { newId } from '../lib/id';
import { clampPatchLevel } from '../lib/patchLevel';
import { placeAt } from '../lib/reorder';
import { clampTempo } from '../lib/tempo';
import { debouncedStorage } from './storage';

export type Settings = {
  /** Load previous / next patches in the background so switching is instant. */
  preloadNeighbors: boolean;
  /** Safety limiter on the master output. */
  limiter: boolean;
  /** Gentle master compression: louder, more even sound. */
  glue: boolean;
  /** High-pass on the iPad's own speakers (they distort on deep bass). */
  speakerProtection: boolean;
  /** Room of the shared reverb. */
  velocityCurve: VelocityCurveKind;
  /** Reconnect remembered Bluetooth MIDI keyboards automatically. */
  bluetoothAutoReconnect: boolean;
  /** Bluetooth MIDI keyboards seen connected at least once. */
  bluetoothDevices: { id: string; name: string }[];
};

const DEFAULT_SETTINGS: Settings = {
  preloadNeighbors: true,
  limiter: true,
  glue: true,
  speakerProtection: true,
  velocityCurve: 'normal',
  bluetoothAutoReconnect: true,
  bluetoothDevices: [],
};

type ConcertState = {
  concert: Concert;
  currentPatchId: string | null;
  masterVolume: number;
  settings: Settings;

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Replaces the whole concert (import). */
  loadConcert: (concert: Concert) => void;
  renameConcert: (name: string) => void;
  addMapping: (mapping: Omit<MidiMapping, 'id'>) => void;
  removeMapping: (id: string) => void;
  setMappingPickup: (id: string, pickup: boolean) => void;

  selectPatch: (id: string) => void;
  /** Moves through all patches of the concert, across sets. */
  stepPatch: (delta: number) => void;
  setMasterVolume: (volume: number) => void;

  addSet: (name: string) => void;
  renameSet: (id: string, name: string) => void;
  removeSet: (id: string) => void;
  moveSet: (id: string, delta: number) => void;
  /** Drag and drop: puts the set at `index` of the list without it. */
  placeSet: (id: string, index: number) => void;

  addPatch: (setId: string, name: string) => void;
  renamePatch: (id: string, name: string) => void;
  setPatchGainDb: (id: string, db: number) => void;
  setPatchNotes: (id: string, notes: string) => void;
  setPatchTempo: (id: string, bpm: number) => void;
  duplicatePatch: (id: string) => void;
  removePatch: (id: string) => void;
  movePatch: (id: string, delta: number) => void;
  movePatchToSet: (id: string, setId: string) => void;
  /** Drag and drop: puts the patch at `index` of the target set's patches (without it), in any set. */
  placePatch: (id: string, setId: string, index: number) => void;

  addLayer: (patchId: string, sound?: SoundRef) => string;
  /** Adds the patch's chord pad (at most one per patch; returns the existing one). */
  addPadLayer: (patchId: string) => string;
  updateLayer: (layerId: string, patch: Partial<Omit<LayerDef, 'id'>>) => void;
  removeLayer: (layerId: string) => void;

  /** Effect actions take a layer id, or MASTER_ID for the master bus. */
  addEffect: (layerId: string, plugin: PluginRef) => void;
  removeEffect: (layerId: string, effectId: string) => void;
  /** Moves an effect earlier (-1) or later (+1) in the layer's signal chain. */
  moveEffect: (layerId: string, effectId: string, delta: number) => void;
  /** Moves a layer left (-1) or right (+1) among the mixer strips; pads have no position. */
  moveLayer: (layerId: string, delta: number) => void;
  /** Drag and drop among the mixer strips (pads excluded): `index` in the strips without this layer. */
  placeLayer: (layerId: string, index: number) => void;
  setEffectBypass: (layerId: string, effectId: string, bypass: boolean) => void;
  /** Stores a plugin state captured from the engine. `slot`: "instrument" or an effect id. */
  savePluginState: (layerId: string, slot: string, state: string) => void;
};

const allPatches = (c: Concert) => c.sets.flatMap((s) => s.patches);

const mapSets = (c: Concert, fn: (s: SetList) => SetList): Concert => ({ ...c, sets: c.sets.map(fn) });

const mapPatches = (c: Concert, fn: (p: Patch) => Patch): Concert =>
  mapSets(c, (s) => ({ ...s, patches: s.patches.map(fn) }));

const mapLayers = (c: Concert, fn: (l: LayerDef) => LayerDef): Concert =>
  mapPatches(c, (p) => ({ ...p, layers: p.layers.map(fn) }));

/** Edits the effect chain of a layer, or of the master bus for MASTER_ID. */
const mapEffects = (c: Concert, hostId: string, fn: (effects: EffectDef[]) => EffectDef[]): Concert =>
  hostId === MASTER_ID
    ? { ...c, masterEffects: fn(c.masterEffects ?? []) }
    : mapLayers(c, (l) => (l.id === hostId ? { ...l, effects: fn(l.effects) } : l));

/** Moves the item with `id` by `delta` positions (clamped). */
function move<T extends { id: string }>(items: T[], id: string, delta: number): T[] {
  const from = items.findIndex((i) => i.id === id);
  const to = Math.min(Math.max(from + delta, 0), items.length - 1);
  if (from < 0 || from === to) return items;
  const next = [...items];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/** Keeps the selection valid after a deletion. */
const ensureSelection = (c: Concert, current: string | null) =>
  allPatches(c).some((p) => p.id === current) ? current : (allPatches(c)[0]?.id ?? null);

const initialConcert = defaultConcert();

export const useConcert = create<ConcertState>()(
  persist(
    (set, get) => ({
      concert: initialConcert,
      currentPatchId: initialConcert.sets[0].patches[0].id,
      masterVolume: 0.9,
      settings: DEFAULT_SETTINGS,

      setSetting: (key, value) => set(({ settings }) => ({ settings: { ...settings, [key]: value } })),

      loadConcert: (concert) => set({ concert, currentPatchId: allPatches(concert)[0]?.id ?? null }),

      renameConcert: (name) => set(({ concert }) => ({ concert: { ...concert, name } })),

      addMapping: (mapping) =>
        set(({ concert }) => ({
          concert: {
            ...concert,
            // One controller drives one thing: replace any mapping on the same CC / channel.
            mappings: [
              ...concert.mappings.filter((m) => !(m.cc === mapping.cc && m.channel === mapping.channel)),
              { ...mapping, id: newId() },
            ],
          },
        })),

      removeMapping: (id) =>
        set(({ concert }) => ({ concert: { ...concert, mappings: concert.mappings.filter((m) => m.id !== id) } })),

      setMappingPickup: (id, pickup) =>
        set(({ concert }) => ({
          concert: { ...concert, mappings: concert.mappings.map((m) => (m.id === id ? { ...m, pickup } : m)) },
        })),

      selectPatch: (id) => set({ currentPatchId: id }),

      stepPatch: (delta) => {
        const patches = allPatches(get().concert);
        const index = patches.findIndex((p) => p.id === get().currentPatchId);
        const next = patches[Math.min(Math.max(index + delta, 0), patches.length - 1)];
        if (next) set({ currentPatchId: next.id });
      },

      setMasterVolume: (masterVolume) => set({ masterVolume }),

      addSet: (name) =>
        set(({ concert }) => ({
          concert: { ...concert, sets: [...concert.sets, { id: newId(), name, patches: [] }] },
        })),

      renameSet: (id, name) =>
        set(({ concert }) => ({ concert: mapSets(concert, (s) => (s.id === id ? { ...s, name } : s)) })),

      removeSet: (id) =>
        set(({ concert, currentPatchId }) => {
          const next = { ...concert, sets: concert.sets.filter((s) => s.id !== id) };
          return { concert: next, currentPatchId: ensureSelection(next, currentPatchId) };
        }),

      moveSet: (id, delta) => set(({ concert }) => ({ concert: { ...concert, sets: move(concert.sets, id, delta) } })),

      placeSet: (id, index) =>
        set(({ concert }) => ({ concert: { ...concert, sets: placeAt(concert.sets, id, index) } })),

      placePatch: (id, setId, index) =>
        set(({ concert }) => {
          const patch = concert.sets.flatMap((s) => s.patches).find((p) => p.id === id);
          if (!patch || !concert.sets.some((s) => s.id === setId)) return {};
          return {
            concert: mapSets(concert, (s) =>
              s.id === setId
                ? { ...s, patches: placeAt([...s.patches.filter((p) => p.id !== id), patch], id, index) }
                : { ...s, patches: s.patches.filter((p) => p.id !== id) },
            ),
          };
        }),

      movePatch: (id, delta) =>
        set(({ concert }) => ({ concert: mapSets(concert, (s) => ({ ...s, patches: move(s.patches, id, delta) })) })),

      movePatchToSet: (id, setId) =>
        set(({ concert }) => {
          const source = concert.sets.find((s) => s.patches.some((p) => p.id === id));
          const patch = source?.patches.find((p) => p.id === id);
          if (!patch || source?.id === setId || !concert.sets.some((s) => s.id === setId)) return {};
          return {
            concert: mapSets(concert, (s) => ({
              ...s,
              patches: s.id === setId ? [...s.patches, patch] : s.patches.filter((p) => p.id !== id),
            })),
          };
        }),

      addPatch: (setId, name) => {
        const patch = makePatch(name, [{ sound: SOUNDS.grand }]);
        set(({ concert }) => ({
          concert: mapSets(concert, (s) => (s.id === setId ? { ...s, patches: [...s.patches, patch] } : s)),
          currentPatchId: patch.id,
        }));
      },

      renamePatch: (id, name) =>
        set(({ concert }) => ({ concert: mapPatches(concert, (p) => (p.id === id ? { ...p, name } : p)) })),

      setPatchNotes: (id, notes) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => (p.id === id ? { ...p, notes: notes.slice(0, 400) } : p)),
        })),

      setPatchTempo: (id, bpm) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => (p.id === id ? { ...p, tempo: clampTempo(bpm) } : p)),
        })),

      setPatchGainDb: (id, db) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => (p.id === id ? { ...p, gainDb: clampPatchLevel(db) } : p)),
        })),

      duplicatePatch: (id) =>
        set(({ concert }) => {
          let copyId: string | null = null;
          const next = mapSets(concert, (s) => {
            const index = s.patches.findIndex((p) => p.id === id);
            if (index < 0) return s;
            const source = s.patches[index];
            const copy: Patch = {
              ...source,
              id: newId(),
              name: `${source.name} (copie)`,
              layers: source.layers.map((l) => ({ ...l, id: newId() })),
            };
            copyId = copy.id;
            return { ...s, patches: [...s.patches.slice(0, index + 1), copy, ...s.patches.slice(index + 1)] };
          });
          return { concert: next, currentPatchId: copyId };
        }),

      removePatch: (id) =>
        set(({ concert, currentPatchId }) => {
          const next = mapSets(concert, (s) => ({ ...s, patches: s.patches.filter((p) => p.id !== id) }));
          return { concert: next, currentPatchId: ensureSelection(next, currentPatchId) };
        }),

      addPadLayer: (patchId) => {
        let layerId = '';
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => {
            if (p.id !== patchId) return p;
            // One pad per patch: return the existing one.
            const existing = p.layers.find((l) => l.pad);
            if (existing) {
              layerId = existing.id;
              return p;
            }
            const layer = makePadLayer(p.layers.length);
            layerId = layer.id;
            return { ...p, layers: [...p.layers, layer] };
          }),
        }));
        return layerId;
      },

      addLayer: (patchId, sound = SOUNDS.grand) => {
        let layerId = '';
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => {
            if (p.id !== patchId) return p;
            const layer = makeLayer(sound, p.layers.length);
            layerId = layer.id;
            return { ...p, layers: [...p.layers, layer] };
          }),
        }));
        return layerId;
      },

      updateLayer: (layerId, patch) =>
        set(({ concert }) => ({ concert: mapLayers(concert, (l) => (l.id === layerId ? { ...l, ...patch } : l)) })),

      addEffect: (layerId, plugin) => {
        const effect: EffectDef = { id: newId(), plugin, bypass: false };
        set(({ concert }) => ({ concert: mapEffects(concert, layerId, (effects) => [...effects, effect]) }));
      },

      moveEffect: (layerId, effectId, delta) =>
        set(({ concert }) => ({ concert: mapEffects(concert, layerId, (effects) => move(effects, effectId, delta)) })),

      moveLayer: (layerId, delta) => {
        const patch = allPatches(get().concert).find((p) => p.layers.some((l) => l.id === layerId));
        const index = mixerLayers(patch).findIndex((l) => l.id === layerId);
        if (index >= 0) get().placeLayer(layerId, index + delta);
      },

      placeLayer: (layerId, index) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => {
            if (!p.layers.some((l) => l.id === layerId && !l.pad)) return p;
            // Pads are not strips: they keep their slots, keyboard layers fill the others in the new order.
            const strips = placeAt(mixerLayers(p), layerId, index);
            let next = 0;
            return { ...p, layers: p.layers.map((l) => (l.pad ? l : strips[next++])) };
          }),
        })),

      removeEffect: (layerId, effectId) =>
        set(({ concert }) => ({
          concert: mapEffects(concert, layerId, (effects) => effects.filter((e) => e.id !== effectId)),
        })),

      setEffectBypass: (layerId, effectId, bypass) =>
        set(({ concert }) => ({
          concert: mapEffects(concert, layerId, (effects) =>
            effects.map((e) => (e.id === effectId ? { ...e, bypass } : e)),
          ),
        })),

      savePluginState: (layerId, slot, state) =>
        set(({ concert }) => ({
          concert:
            slot === 'instrument'
              ? mapLayers(concert, (l) => (l.id === layerId && l.plugin ? { ...l, plugin: { ...l.plugin, state } } : l))
              : mapEffects(concert, layerId, (effects) =>
                  effects.map((e) => (e.id === slot ? { ...e, plugin: { ...e.plugin, state } } : e)),
                ),
        })),

      removeLayer: (layerId) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => ({ ...p, layers: p.layers.filter((l) => l.id !== layerId) })),
        })),
    }),
    {
      name: 'livekeys-concert',
      version: 6,
      migrate: (persisted, version) => {
        const state = persisted as { concert: Concert };
        // v1 layers had no effects list.
        if (version < 2) state.concert = mapLayers(state.concert, (l) => ({ ...l, effects: l.effects ?? [] }));
        // v2 concerts had no MIDI mappings.
        if (version < 3) state.concert = { ...state.concert, mappings: state.concert.mappings ?? [] };
        // v6 replaced the shared reverb and its per-layer sends by master insert effects.
        if (version < 6) {
          state.concert = mapLayers(
            state.concert,
            ({ reverbSend: _send, ...l }: LayerDef & { reverbSend?: number }) => l,
          );
          state.concert = { ...state.concert, masterEffects: state.concert.masterEffects ?? [] };
          delete (state as { settings?: { ambience?: string } }).settings?.ambience;
        }
        // v4 / v5 added settings: fill any missing setting with its default.
        const withSettings = state as { settings?: Partial<Settings> };
        withSettings.settings = { ...DEFAULT_SETTINGS, ...withSettings.settings };
        return state as never;
      },
      storage: createJSONStorage(() => debouncedStorage),
      partialize: ({ concert, currentPatchId, masterVolume, settings }) => ({
        concert,
        currentPatchId,
        masterVolume,
        settings,
      }),
    },
  ),
);

// MARK: - Selectors

/**
 * Keyboard layers in mixer order. The chord pad lives in the sidebar: it has no strip, no position, and is not
 * counted by « Layer N » MIDI controls.
 */
export const mixerLayers = (patch: Patch | undefined): LayerDef[] => patch?.layers.filter((l) => !l.pad) ?? [];

export const selectCurrentPatch = (s: ConcertState): Patch | undefined =>
  allPatches(s.concert).find((p) => p.id === s.currentPatchId);

/** Previous and next patches across the whole concert (for preloading). */
export const selectNeighborPatches = (s: ConcertState): Patch[] => {
  const patches = allPatches(s.concert);
  const index = patches.findIndex((p) => p.id === s.currentPatchId);
  if (index < 0) return [];
  return [patches[index - 1], patches[index + 1]].filter((p): p is Patch => !!p);
};

export const selectLayer = (layerId: string) => (s: ConcertState) =>
  allPatches(s.concert)
    .flatMap((p) => p.layers)
    .find((l) => l.id === layerId);

/**
 * Effect chain shown by the plugin screens: a layer's, or the master bus for MASTER_ID.
 * The master host object is cached: a selector returning a new object on every call would make
 * `useConcert` re-render forever (crash when opening a master effect).
 */
export const selectEffectHost = (hostId: string) => (s: ConcertState) => {
  if (hostId !== MASTER_ID) return selectLayer(hostId)(s);
  const effects = s.concert.masterEffects ?? EMPTY_EFFECTS;
  if (masterHost.effects !== effects) masterHost = { effects, plugin: undefined };
  return masterHost;
};
const EMPTY_EFFECTS: EffectDef[] = [];
let masterHost: { effects: EffectDef[]; plugin: undefined } = { effects: EMPTY_EFFECTS, plugin: undefined };

/** Patch that owns a layer — used by the editor to know solo context. */
export const selectPatchOfLayer = (layerId: string) => (s: ConcertState) =>
  allPatches(s.concert).find((p) => p.layers.some((l) => l.id === layerId));
