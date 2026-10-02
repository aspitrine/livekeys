import AudioEngine from '../../modules/audio-engine';
import { applyLiveSettings, capturePluginStates, syncPatches } from '../../src/engine/sync';
import { selectCurrentPatch, selectLayer, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

let patchId: string;
let pianoId: string;
let padId: string;
beforeEach(() => {
  const patch = resetConcert();
  patchId = patch.id;
  pianoId = patch.layers[0].id;
  padId = useConcert.getState().addPadLayer(patchId);
});
const sync = () => syncPatches(selectCurrentPatch(useConcert.getState()));

test('a slow instrument load never reactivates a patch that has already been left', async () => {
  let finish!: () => void;
  const blocked = new Promise<void>((resolve) => {
    finish = resolve;
  });
  jest.mocked(AudioEngine.loadSoundFont).mockImplementationOnce(() => blocked);
  const old = sync();
  // Let addLayer finish and reach the slow native bank load.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(AudioEngine.loadSoundFont).toHaveBeenCalled();
  const next = useConcert.getState().concert.sets[0].patches[1];
  const latest = syncPatches(next);
  finish();
  await Promise.all([old, latest]);
  expect(AudioEngine.setActiveLayers).not.toHaveBeenCalledWith([pianoId, padId]);
  expect(AudioEngine.setActiveLayers).toHaveBeenLastCalledWith(next.layers.map((l) => l.id));
});

test('rapid fader changes do not replay obsolete louder settings', async () => {
  await sync();
  jest.mocked(AudioEngine.updateLayer).mockClear();
  useConcert.getState().updateLayer(pianoId, { volume: 1 });
  const old = sync();
  useConcert.getState().updateLayer(pianoId, { volume: 0.2 });
  const latest = sync();
  await Promise.all([old, latest]);
  expect(AudioEngine.updateLayer).not.toHaveBeenCalledWith(pianoId, { volume: 1 });
  expect(AudioEngine.updateLayer).toHaveBeenCalledWith(pianoId, { volume: 0.2 });
});

test('loads instruments and gives a new pad a quiet gain without keyboard notes', async () => {
  await sync();
  expect(AudioEngine.addLayer).toHaveBeenCalledWith(pianoId, expect.objectContaining({ volume: 0.8, keyboard: true }));
  expect(AudioEngine.addLayer).toHaveBeenCalledWith(
    padId,
    expect.objectContaining({ volume: expect.closeTo(0.01, 8), keyboard: false }),
  );
  expect(AudioEngine.loadSoundFont).toHaveBeenCalledWith(padId, '/test/GeneralUser-GS.sf2', 89, 0);
  expect(AudioEngine.setActiveLayers).toHaveBeenCalledWith([pianoId, padId]);
});

test('repeated synchronization does not reload unchanged instruments', async () => {
  await sync();
  jest.mocked(AudioEngine.loadSoundFont).mockClear();
  await sync();
  expect(AudioEngine.loadSoundFont).not.toHaveBeenCalled();
});

test.each([
  [0, 0],
  [0.01, 0.0001],
  [0.08, 0.0064],
  [1, 1],
  [-0.1, 0],
  [1.1, 1],
])('pad setting %s produces native gain %s', async (volume, gain) => {
  await sync();
  useConcert.getState().updateLayer(padId, { volume });
  await sync();
  expect(AudioEngine.updateLayer).toHaveBeenCalledWith(padId, { volume: expect.closeTo(gain, 8) });
  expect(AudioEngine.updateLayer).not.toHaveBeenCalledWith(pianoId, expect.anything());
});

test('regular instrument volume remains linear', async () => {
  await sync();
  useConcert.getState().updateLayer(pianoId, { volume: 0.38 });
  await sync();
  expect(AudioEngine.updateLayer).toHaveBeenCalledWith(pianoId, { volume: 0.38 });
});

test('a sound change reloads only that layer', async () => {
  await sync();
  jest.mocked(AudioEngine.loadSoundFont).mockClear();
  const layer = selectLayer(pianoId)(useConcert.getState())!;
  useConcert.getState().updateLayer(pianoId, { sound: { ...layer.sound, program: 4 } });
  await sync();
  expect(AudioEngine.loadSoundFont).toHaveBeenCalledTimes(1);
  expect(AudioEngine.loadSoundFont).toHaveBeenCalledWith(pianoId, '/test/UprightPianoKW-small.sf2', 4, 0);
});

test('loads, bypasses, reorders and removes effects through the native boundary', async () => {
  const store = useConcert.getState();
  const plugin = { componentId: 'aufx:rvb2:appl', name: 'Hall', manufacturer: 'Apple', params: { '0': 30 } };
  store.addEffect(pianoId, plugin);
  store.addEffect(pianoId, { ...plugin, componentId: 'aufx:dely:appl', name: 'Echo' });
  const [first, second] = selectLayer(pianoId)(useConcert.getState())!.effects;
  await sync();
  expect(AudioEngine.addEffect).toHaveBeenCalledWith(pianoId, first.id, plugin.componentId, null, false);
  expect(AudioEngine.setPluginParameter).toHaveBeenCalledWith(pianoId, first.id, 0, 30);
  store.setEffectBypass(pianoId, first.id, true);
  store.moveEffect(pianoId, second.id, -1);
  await sync();
  expect(AudioEngine.setEffectBypass).toHaveBeenCalledWith(pianoId, first.id, true);
  expect(AudioEngine.setEffectOrder).toHaveBeenCalledWith(pianoId, [second.id, first.id]);
  store.removeEffect(pianoId, first.id);
  await sync();
  expect(AudioEngine.removeEffect).toHaveBeenCalledWith(pianoId, first.id);
});

test('restores instrument plugins and captures their saved state', async () => {
  const store = useConcert.getState();
  store.updateLayer(pianoId, {
    plugin: { componentId: 'aumu:test:test', name: 'Synth', manufacturer: 'Test', state: 'initial' },
  });
  await sync();
  expect(AudioEngine.loadPlugin).toHaveBeenCalledWith(pianoId, 'aumu:test:test', 'initial');
  jest.mocked(AudioEngine.getPluginState).mockResolvedValueOnce('captured');
  await capturePluginStates(pianoId, selectLayer(pianoId)(useConcert.getState()));
  expect(selectLayer(pianoId)(useConcert.getState())!.plugin!.state).toBe('captured');
});

test('retrying a partial effect load does not reinstall an already successful effect', async () => {
  const store = useConcert.getState();
  store.addEffect(pianoId, { componentId: 'aufx:rvb2:appl', name: 'Hall', manufacturer: 'Apple' });
  store.addEffect(pianoId, { componentId: 'aufx:dely:appl', name: 'Echo', manufacturer: 'Apple' });
  const [hall, echo] = selectLayer(pianoId)(useConcert.getState())!.effects;
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest
    .mocked(AudioEngine.addEffect)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('AU unavailable'));
  await sync();
  await sync();
  expect(jest.mocked(AudioEngine.addEffect).mock.calls.filter(([, id]) => id === hall.id)).toHaveLength(1);
  expect(jest.mocked(AudioEngine.addEffect).mock.calls.filter(([, id]) => id === echo.id)).toHaveLength(2);
  warning.mockRestore();
});

test('old layers ring out before they are removed, while preloaded layers stay available', async () => {
  await sync();
  const next = useConcert.getState().concert.sets[0].patches[1];
  await syncPatches(next);
  expect(AudioEngine.removeLayer).not.toHaveBeenCalledWith(pianoId);
  await jest.advanceTimersByTimeAsync(6000);
  await syncPatches(next);
  expect(AudioEngine.removeLayer).toHaveBeenCalledWith(pianoId);
  expect(AudioEngine.removeLayer).toHaveBeenCalledWith(padId);
  await syncPatches(next, [useConcert.getState().concert.sets[0].patches[2]]);
  expect(AudioEngine.setActiveLayers).toHaveBeenLastCalledWith(next.layers.map((l) => l.id));
});

test('a layer still held by a key or the pedal is not unloaded when its tail time is over', async () => {
  await sync();
  const next = useConcert.getState().concert.sets[0].patches[1];
  await syncPatches(next);
  // Final chord of the previous song still held with the pedal.
  jest.mocked(AudioEngine.isLayerHeld).mockImplementation((id) => id === pianoId);
  await jest.advanceTimersByTimeAsync(6000);
  await syncPatches(next);
  expect(AudioEngine.removeLayer).not.toHaveBeenCalledWith(pianoId);
  expect(AudioEngine.removeLayer).toHaveBeenCalledWith(padId);
  // Released: it rings out once more, then goes.
  jest.mocked(AudioEngine.isLayerHeld).mockReturnValue(false);
  await jest.advanceTimersByTimeAsync(6100);
  expect(AudioEngine.removeLayer).toHaveBeenCalledWith(pianoId);
});

test('mute and volume apply at once even while a neighbour bank is still loading', async () => {
  await sync();
  // A huge preloaded bank keeps the sync queue busy for seconds.
  jest.mocked(AudioEngine.loadSoundFont).mockImplementationOnce(() => new Promise(() => {}));
  const neighbour = useConcert.getState().concert.sets[0].patches[1];
  const pending = syncPatches(selectCurrentPatch(useConcert.getState()), [neighbour]);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  jest.mocked(AudioEngine.updateLayer).mockClear();
  useConcert.getState().updateLayer(pianoId, { mute: true, volume: 0.3 });
  applyLiveSettings(selectCurrentPatch(useConcert.getState()));
  expect(AudioEngine.updateLayer).toHaveBeenCalledWith(pianoId, { mute: true, volume: 0.3 });
  void pending;
});
