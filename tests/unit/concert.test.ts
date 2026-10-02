import { defaultConcert, instrumentName, makeLayer, makePadLayer } from '../../src/model/defaults';
import { SOUNDS } from '../../src/model/sounds';
import {
  selectCurrentPatch,
  selectLayer,
  selectNeighborPatches,
  selectPatchOfLayer,
  useConcert,
} from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(resetConcert);

test('starts with a valid concert and a quiet chord pad', () => {
  const concert = defaultConcert();
  expect(concert.sets[0].patches).toHaveLength(5);
  const pad = makePadLayer(1);
  expect(pad.volume).toBe(0.1);
  expect(pad.pad).toMatchObject({ mode: 'follow', playing: true });
  expect(makeLayer(SOUNDS.grand, 0).volume).toBe(0.8);
  expect(instrumentName(pad)).toBe('Warm Pad');
  expect(instrumentName({ ...pad, plugin: { componentId: 'test', name: 'Synth', manufacturer: 'Test' } })).toBe(
    'Synth',
  );
});

test('adds one chord pad per patch even when requested twice', () => {
  const store = useConcert.getState();
  const patch = selectCurrentPatch(store)!;
  const first = store.addPadLayer(patch.id);
  const second = store.addPadLayer(patch.id);
  expect(first).toBe(second);
  expect(selectCurrentPatch(useConcert.getState())!.layers.filter((l) => l.pad)).toHaveLength(1);
});

test('patch navigation stops at either end of the setlist', () => {
  const store = useConcert.getState();
  const patches = store.concert.sets[0].patches;
  store.stepPatch(-1);
  expect(useConcert.getState().currentPatchId).toBe(patches[0].id);
  store.stepPatch(1);
  expect(selectNeighborPatches(useConcert.getState()).map((p) => p.id)).toEqual([patches[0].id, patches[2].id]);
  store.selectPatch(patches.at(-1)!.id);
  store.stepPatch(1);
  expect(useConcert.getState().currentPatchId).toBe(patches.at(-1)!.id);
});

test('duplicates patches without sharing layer identities or later edits', () => {
  const store = useConcert.getState();
  const original = selectCurrentPatch(store)!;
  store.duplicatePatch(original.id);
  const copy = selectCurrentPatch(useConcert.getState())!;
  expect(copy.name).toBe(`${original.name} (copie)`);
  expect(copy.layers[0].id).not.toBe(original.layers[0].id);
  store.updateLayer(copy.layers[0].id, { volume: 0.2 });
  expect(selectLayer(original.layers[0].id)(useConcert.getState())!.volume).toBe(0.8);
});

test('deleting a selected patch restores a valid selection', () => {
  const store = useConcert.getState();
  store.removePatch(store.currentPatchId!);
  expect(selectCurrentPatch(useConcert.getState())).toBeDefined();
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Piano + Pad');
});

test('creates, renames and removes sets and patches', () => {
  const store = useConcert.getState();
  store.renameConcert('Show');
  store.addSet('Encore');
  const set = useConcert.getState().concert.sets.at(-1)!;
  store.renameSet(set.id, 'Final');
  store.addPatch(set.id, 'Ballad');
  const patch = selectCurrentPatch(useConcert.getState())!;
  store.renamePatch(patch.id, 'Outro');
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Outro');
  expect(useConcert.getState().concert.name).toBe('Show');
  store.removeSet(set.id);
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Piano');
  store.removeSet(useConcert.getState().concert.sets[0].id);
  expect(useConcert.getState().currentPatchId).toBeNull();
  expect(selectCurrentPatch(useConcert.getState())).toBeUndefined();
});

test('moves layers and insert effects without losing their configuration', () => {
  const store = useConcert.getState();
  const patch = selectCurrentPatch(store)!;
  const layerId = store.addLayer(patch.id);
  store.moveLayer(layerId, -1);
  expect(selectCurrentPatch(useConcert.getState())!.layers[0].id).toBe(layerId);
  const plugin = { componentId: 'aufx:rvb2:appl', name: 'Reverb', manufacturer: 'Apple' };
  store.addEffect(layerId, plugin);
  store.addEffect(layerId, { ...plugin, name: 'Second' });
  const [first, second] = selectLayer(layerId)(useConcert.getState())!.effects;
  store.moveEffect(layerId, second.id, -1);
  store.setEffectBypass(layerId, second.id, true);
  store.savePluginState(layerId, first.id, 'effect-state');
  expect(selectLayer(layerId)(useConcert.getState())!.effects).toMatchObject([
    { id: second.id, bypass: true },
    { id: first.id, plugin: { state: 'effect-state' } },
  ]);
  store.removeEffect(layerId, second.id);
  expect(selectLayer(layerId)(useConcert.getState())!.effects).toHaveLength(1);
  expect(selectPatchOfLayer(layerId)(useConcert.getState())!.id).toBe(patch.id);
  store.removeLayer(layerId);
  expect(selectLayer(layerId)(useConcert.getState())).toBeUndefined();
});

test('captures instrument plugin state and safely ignores unknown slots', () => {
  const store = useConcert.getState();
  const layerId = selectCurrentPatch(store)!.layers[0].id;
  store.savePluginState(layerId, 'instrument', 'ignored');
  expect(selectLayer(layerId)(useConcert.getState())!.plugin).toBeUndefined();
  store.updateLayer(layerId, { plugin: { componentId: 'plugin', name: 'Synth', manufacturer: 'Test' } });
  store.savePluginState(layerId, 'instrument', 'saved');
  store.savePluginState(layerId, 'missing-effect', 'ignored');
  expect(selectLayer(layerId)(useConcert.getState())!.plugin!.state).toBe('saved');
});

test('one controller mapping replaces the previous mapping on the same channel', () => {
  const store = useConcert.getState();
  store.addMapping({ cc: 7, channel: 0, target: { kind: 'masterVolume' } });
  store.addMapping({ cc: 7, channel: 0, target: { kind: 'padToggle' } });
  expect(useConcert.getState().concert.mappings).toHaveLength(1);
  expect(useConcert.getState().concert.mappings[0].target.kind).toBe('padToggle');
  store.removeMapping(useConcert.getState().concert.mappings[0].id);
  expect(useConcert.getState().concert.mappings).toEqual([]);
});

test('older concerts get a reverb send, except layers that already have their own reverb insert', () => {
  const migrate = useConcert.persist.getOptions().migrate!;
  const concert = useConcert.getState().concert;
  const [first] = concert.sets[0].patches;
  const plain = { ...first.layers[0], reverbSend: undefined, effects: [] };
  const withHall = {
    ...first.layers[0],
    id: 'with-hall',
    reverbSend: undefined,
    effects: [
      { id: 'fx', bypass: false, plugin: { componentId: 'aufx:rvb2:appl', name: 'Hall', manufacturer: 'Apple' } },
    ],
  };
  const pad = {
    ...first.layers[0],
    id: 'pad',
    reverbSend: undefined,
    effects: [],
    pad: { mode: 'follow', chord: { root: 0, quality: 'maj' }, base: 48, playing: true },
  };
  const old = {
    concert: { ...concert, sets: [{ ...concert.sets[0], patches: [{ ...first, layers: [plain, withHall, pad] }] }] },
  };
  const migrated = migrate(old, 4) as { concert: typeof concert; settings: { ambience: string; glue: boolean } };
  const layers = migrated.concert.sets[0].patches[0].layers;
  expect(layers.map((l) => l.reverbSend)).toEqual([0.2, 0, 0.35]);
  expect(migrated.settings.ambience).toBe('hall');
  expect(migrated.settings.glue).toBe(true);
});
