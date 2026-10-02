import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { defaultConcert, makeLayer, makePadLayer, makePatch } from '../model/defaults';
import { SOUNDS } from '../model/sounds';
import type { Concert, EffectDef, LayerDef, MidiMapping, Patch, PluginRef, SetList, SoundRef } from '../model/types';
import { newId } from '../lib/id';
import { debouncedStorage } from './storage';

export type Settings = {
  /** Load previous / next patches in the background so switching is instant. */
  preloadNeighbors: boolean;
  /** Safety limiter on the master output. */
  limiter: boolean;
  /** Reconnect remembered Bluetooth MIDI keyboards automatically. */
  bluetoothAutoReconnect: boolean;
  /** Bluetooth MIDI keyboards seen connected at least once. */
  bluetoothDevices: { id: string; name: string }[];
};

const DEFAULT_SETTINGS: Settings = {
  preloadNeighbors: true,
  limiter: true,
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

  selectPatch: (id: string) => void;
  /** Moves through all patches of the concert, across sets. */
  stepPatch: (delta: number) => void;
  setMasterVolume: (volume: number) => void;

  addSet: (name: string) => void;
  renameSet: (id: string, name: string) => void;
  removeSet: (id: string) => void;

  addPatch: (setId: string, name: string) => void;
  renamePatch: (id: string, name: string) => void;
  duplicatePatch: (id: string) => void;
  removePatch: (id: string) => void;

  addLayer: (patchId: string, sound?: SoundRef) => string;
  /** Adds the patch's chord pad (at most one per patch; returns the existing one). */
  addPadLayer: (patchId: string) => string;
  updateLayer: (layerId: string, patch: Partial<Omit<LayerDef, 'id'>>) => void;
  removeLayer: (layerId: string) => void;

  addEffect: (layerId: string, plugin: PluginRef) => void;
  removeEffect: (layerId: string, effectId: string) => void;
  /** Moves an effect earlier (-1) or later (+1) in the layer's signal chain. */
  moveEffect: (layerId: string, effectId: string, delta: number) => void;
  /** Moves a layer left (-1) or right (+1) in its patch. */
  moveLayer: (layerId: string, delta: number) => void;
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

      addPatch: (setId, name) => {
        const patch = makePatch(name, [{ sound: SOUNDS.grand }]);
        set(({ concert }) => ({
          concert: mapSets(concert, (s) => (s.id === setId ? { ...s, patches: [...s.patches, patch] } : s)),
          currentPatchId: patch.id,
        }));
      },

      renamePatch: (id, name) =>
        set(({ concert }) => ({ concert: mapPatches(concert, (p) => (p.id === id ? { ...p, name } : p)) })),

      duplicatePatch: (id) =>
        set(({ concert }) => {
          let copyId: string | null = null;
          const next = mapSets(concert, (s) => {
            const index = s.patches.findIndex((p) => p.id === id);
            if (index < 0) return s;
            const source = s.patches[index];
            const copy: Patch = {
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
        set(({ concert }) => ({
          concert: mapLayers(concert, (l) => (l.id === layerId ? { ...l, effects: [...l.effects, effect] } : l)),
        }));
      },

      moveEffect: (layerId, effectId, delta) =>
        set(({ concert }) => ({
          concert: mapLayers(concert, (l) =>
            l.id === layerId ? { ...l, effects: move(l.effects, effectId, delta) } : l,
          ),
        })),

      moveLayer: (layerId, delta) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) =>
            p.layers.some((l) => l.id === layerId) ? { ...p, layers: move(p.layers, layerId, delta) } : p,
          ),
        })),

      removeEffect: (layerId, effectId) =>
        set(({ concert }) => ({
          concert: mapLayers(concert, (l) =>
            l.id === layerId ? { ...l, effects: l.effects.filter((e) => e.id !== effectId) } : l,
          ),
        })),

      setEffectBypass: (layerId, effectId, bypass) =>
        set(({ concert }) => ({
          concert: mapLayers(concert, (l) =>
            l.id === layerId ? { ...l, effects: l.effects.map((e) => (e.id === effectId ? { ...e, bypass } : e)) } : l,
          ),
        })),

      savePluginState: (layerId, slot, state) =>
        set(({ concert }) => ({
          concert: mapLayers(concert, (l) => {
            if (l.id !== layerId) return l;
            if (slot === 'instrument') return l.plugin ? { ...l, plugin: { ...l.plugin, state } } : l;
            return {
              ...l,
              effects: l.effects.map((e) => (e.id === slot ? { ...e, plugin: { ...e.plugin, state } } : e)),
            };
          }),
        })),

      removeLayer: (layerId) =>
        set(({ concert }) => ({
          concert: mapPatches(concert, (p) => ({ ...p, layers: p.layers.filter((l) => l.id !== layerId) })),
        })),
    }),
    {
      name: 'livekeys-concert',
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as { concert: Concert };
        // v1 layers had no effects list.
        if (version < 2) state.concert = mapLayers(state.concert, (l) => ({ ...l, effects: l.effects ?? [] }));
        // v2 concerts had no MIDI mappings.
        if (version < 3) state.concert = { ...state.concert, mappings: state.concert.mappings ?? [] };
        // v4 added Bluetooth settings: fill any missing setting with its default.
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

/** Patch that owns a layer — used by the editor to know solo context. */
export const selectPatchOfLayer = (layerId: string) => (s: ConcertState) =>
  allPatches(s.concert).find((p) => p.layers.some((l) => l.id === layerId));
