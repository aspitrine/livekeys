import AudioEngine, { type LayerConfig } from '../../modules/audio-engine';
import type { EffectDef, LayerDef, Patch, PluginRef } from '../model/types';
import { useConcert } from '../store/concert';
import { bankPath, soundGainDb, soundKey } from './catalog';

type Loaded = {
  config: LayerConfig;
  /** What the instrument slot holds: "sf:<bank/bankNumber/program>" or "plugin:<componentId>". */
  instrument: string;
  effects: { id: string; bypass: boolean }[];
  hasPlugins: boolean;
};

/** What the native engine currently holds, by layer id. */
const loaded = new Map<string, Loaded>();
let queue: Promise<void> = Promise.resolve();

const CONFIG_KEYS: (keyof LayerConfig)[] = [
  'volume',
  'pan',
  'mute',
  'solo',
  'keyLow',
  'keyHigh',
  'velocityLow',
  'velocityHigh',
  'transpose',
  'midiChannel',
  'sustainEnabled',
  'keyboard',
  'reverbSend',
];

/** Pads use a squared gain curve for finer control at low levels; keyboard layers keep linear gain. */
const configOf = (layer: LayerDef) =>
  ({
    ...Object.fromEntries(CONFIG_KEYS.map((k) => [k, layer[k]])),
    volume: layer.pad ? Math.min(Math.max(layer.volume, 0), 1) ** 2 : layer.volume,
    keyboard: !layer.pad,
  }) as LayerConfig;

const instrumentKey = (layer: LayerDef) =>
  layer.plugin ? `plugin:${layer.plugin.componentId}` : `sf:${soundKey(layer.sound)}`;

function diff(prev: LayerConfig, next: LayerConfig): Partial<LayerConfig> | null {
  const changed = CONFIG_KEYS.filter((k) => prev[k] !== next[k]);
  return changed.length ? (Object.fromEntries(changed.map((k) => [k, next[k]])) as Partial<LayerConfig>) : null;
}

/** How long a patch we left keeps ringing (release, sustain, reverb tails) before being unloaded. */
const TAIL_MS = 6000;
/** Layer id → time after which it may be unloaded. */
const tailing = new Map<string, number>();
let target: { active?: Patch; preload: Patch[] } = { preload: [] };
let revision = 0;

/**
 * Keeps the native engine in step with the concert:
 * - `active` patch: loaded first, then made the only one receiving new notes;
 * - `preload` patches (neighbours): loaded in the background so switching to them is instant;
 * - any other loaded layer rings out for TAIL_MS (held / sustained notes keep sounding), then is unloaded.
 * Only changed settings are pushed and instruments reload only when they change.
 * Calls are serialized. Obsolete requests are skipped, including after a slow native load.
 */
export function syncPatches(active: Patch | undefined, preload: Patch[] = []) {
  target = { active, preload };
  const request = ++revision;
  queue = queue.then(() => apply(active, preload, request)).catch((e) => console.warn('[engine sync]', e));
  // Callers (notably pad scheduling) wait for the latest queued state too.
  return queue.then(() => queue);
}

/**
 * Pushes mix / routing changes of already-loaded layers right away, outside the queue: a slow bank
 * load (a preloaded neighbour, seconds for a big piano) must not delay Mute, Solo or a fader.
 * The queued sync sees them as already applied.
 */
export function applyLiveSettings(patch: Patch | undefined) {
  for (const layer of patch?.layers ?? []) {
    const current = loaded.get(layer.id);
    if (!current) continue;
    const config = configOf(layer);
    const changes = diff(current.config, config);
    if (!changes) continue;
    AudioEngine.updateLayer(layer.id, changes);
    current.config = config;
  }
}

/** Captures the live state of every plugin of a layer into the store (before unloading it). */
export async function capturePluginStates(layerId: string, layer?: LayerDef) {
  const { savePluginState } = useConcert.getState();
  const slots = [
    'instrument',
    ...(layer?.effects.map((e) => e.id) ?? loaded.get(layerId)?.effects.map((e) => e.id) ?? []),
  ];
  for (const slot of slots) {
    if (slot === 'instrument' && layer && !layer.plugin) continue;
    try {
      const state = await AudioEngine.getPluginState(layerId, slot);
      if (state) savePluginState(layerId, slot, state);
    } catch (e) {
      // Slot gone or AU without state: nothing to keep.
      console.warn(`[engine sync] no state for ${layerId}/${slot}`, e);
    }
  }
}

async function apply(active: Patch | undefined, preload: Patch[], request: number) {
  if (request !== revision) return;
  const keep = new Set([active, ...preload].flatMap((p) => p?.layers.map((l) => l.id) ?? []));

  // 1. The current patch first, so it plays as soon as possible.
  for (const layer of active?.layers ?? []) {
    await safeApplyLayer(layer);
    if (request !== revision) return;
  }
  AudioEngine.setActiveLayers(active?.layers.map((l) => l.id) ?? []);

  // 2. Layers we left: let them ring, then unload.
  const now = Date.now();
  for (const [id, state] of loaded) {
    if (keep.has(id)) {
      tailing.delete(id);
      continue;
    }
    const expiry = tailing.get(id);
    if (expiry === undefined) {
      tailing.set(id, now + TAIL_MS);
      setTimeout(() => syncPatches(target.active, target.preload), TAIL_MS + 50);
      continue;
    }
    if (expiry > now) continue;
    if (AudioEngine.isLayerHeld(id)) {
      // A key or the pedal still holds notes on it (e.g. the last chord of the previous song):
      // unloading would cut them. Check again after another tail period.
      tailing.set(id, now + TAIL_MS);
      setTimeout(() => syncPatches(target.active, target.preload), TAIL_MS + 50);
      continue;
    }
    tailing.delete(id);
    if (state.hasPlugins) {
      await capturePluginStates(id);
      if (request !== revision) return;
    }
    loaded.delete(id);
    await AudioEngine.removeLayer(id);
    if (request !== revision) return;
  }

  // 3. Neighbours in the background.
  for (const patch of preload)
    for (const layer of patch.layers) {
      await safeApplyLayer(layer);
      if (request !== revision) return;
    }
}

async function safeApplyLayer(layer: LayerDef) {
  try {
    await applyLayer(layer);
  } catch (e) {
    console.warn(`[engine sync] layer ${layer.name}`, e);
  }
}

async function applyLayer(layer: LayerDef) {
  const config = configOf(layer);
  let prev = loaded.get(layer.id);

  if (!prev) {
    await AudioEngine.addLayer(layer.id, config);
    prev = { config, instrument: '', effects: [], hasPlugins: false };
  } else {
    const changes = diff(prev.config, config);
    if (changes) AudioEngine.updateLayer(layer.id, changes);
  }
  const current: Loaded = { ...prev, config, hasPlugins: !!layer.plugin || layer.effects.length > 0 };
  loaded.set(layer.id, current);

  const instrument = instrumentKey(layer);
  if (current.instrument !== instrument) {
    if (layer.plugin) await AudioEngine.loadPlugin(layer.id, layer.plugin.componentId, layer.plugin.state ?? null);
    else
      await AudioEngine.loadSoundFont(
        layer.id,
        bankPath(layer.sound.bank),
        layer.sound.program,
        layer.sound.bankNumber,
        soundGainDb(layer.sound),
      );
    current.instrument = instrument;
  }

  current.effects = await applyEffects(layer.id, current.effects, layer.effects);
}

async function applyEffects(layerId: string, have: Loaded['effects'], want: EffectDef[]) {
  const wantIds = new Set(want.map((e) => e.id));
  // Commit each successful native operation immediately. A later AU can fail;
  // retrying must preserve effects that are already installed and configured.
  const next = have;
  for (const e of have.filter((e) => !wantIds.has(e.id))) {
    await AudioEngine.removeEffect(layerId, e.id);
    next.splice(next.indexOf(e), 1);
  }

  for (const effect of want) {
    const existing = next.find((e) => e.id === effect.id);
    if (!existing) {
      await AudioEngine.addEffect(
        layerId,
        effect.id,
        effect.plugin.componentId,
        effect.plugin.state ?? null,
        effect.bypass,
      );
      if (!effect.plugin.state) applyInitialSetup(layerId, effect.id, effect.plugin);
      next.push({ id: effect.id, bypass: effect.bypass });
    } else if (existing.bypass !== effect.bypass) {
      AudioEngine.setEffectBypass(layerId, effect.id, effect.bypass);
      existing.bypass = effect.bypass;
    }
  }
  // Effects were reordered: rewire the chain in the stored order.
  const order = want.map((e) => e.id);
  if (next.map((e) => e.id).join() !== order.join()) {
    AudioEngine.setEffectOrder(layerId, order);
    next.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  return next;
}

/** Ready-to-use effects: select their factory preset, then set their parameters. */
function applyInitialSetup(layerId: string, slot: string, plugin: PluginRef) {
  try {
    if (plugin.preset) {
      const { presets } = AudioEngine.getPluginPresets(layerId, slot);
      const match = presets.find((p) => p.name === plugin.preset);
      if (match) AudioEngine.selectPluginPreset(layerId, slot, match.number);
    }
    for (const [address, value] of Object.entries(plugin.params ?? {})) {
      AudioEngine.setPluginParameter(layerId, slot, Number(address), value);
    }
  } catch (e) {
    console.warn('[engine sync] effect setup', plugin.name, e);
  }
}
