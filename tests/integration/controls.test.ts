import AudioEngine from '../../modules/audio-engine';
import {
  cancelLearn,
  handleControlChange,
  sameTarget,
  startLearn,
  targetLabel,
  useMidiLearn,
} from '../../src/engine/controls';
import { selectCurrentPatch, selectLayer, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';
import { onKeyboardNote, updatePads, usePadChord } from '../../src/engine/pads';

beforeEach(() => {
  resetConcert();
  cancelLearn();
});

test('MIDI learn records the controller without immediately changing the volume', () => {
  startLearn({ kind: 'masterVolume' });
  handleControlChange(2, 7, 20);
  expect(useMidiLearn.getState().learning).toBeNull();
  expect(useConcert.getState().concert.mappings).toMatchObject([
    { channel: 2, cc: 7, target: { kind: 'masterVolume' } },
  ]);
  expect(useConcert.getState().masterVolume).toBe(0.9);
  handleControlChange(2, 7, 127);
  expect(useConcert.getState().masterVolume).toBe(1);
});

test('channel-specific mappings ignore other channels', () => {
  useConcert.getState().addMapping({ cc: 11, channel: 3, target: { kind: 'masterVolume' } });
  handleControlChange(2, 11, 0);
  expect(useConcert.getState().masterVolume).toBe(0.9);
  handleControlChange(3, 11, 0);
  expect(useConcert.getState().masterVolume).toBe(0);
});

test('layer volume mappings follow the current patch and handle missing layers', () => {
  const store = useConcert.getState();
  store.addMapping({ cc: 12, channel: -1, target: { kind: 'layerVolume', index: 0 } });
  handleControlChange(0, 12, 64);
  const first = selectCurrentPatch(useConcert.getState())!.layers[0];
  expect(first.volume).toBe(0.5);
  store.stepPatch(1);
  handleControlChange(1, 12, 127);
  expect(selectCurrentPatch(useConcert.getState())!.layers[0].volume).toBe(1);
  expect(selectLayer(first.id)(useConcert.getState())!.volume).toBe(0.5);
  store.addMapping({ cc: 13, channel: -1, target: { kind: 'layerVolume', index: 99 } });
  expect(() => handleControlChange(0, 13, 100)).not.toThrow();
});

test('patch buttons fire only on the press edge, not every repeated MIDI message', () => {
  const store = useConcert.getState();
  store.addMapping({ cc: 20, channel: -1, target: { kind: 'nextPatch' } });
  handleControlChange(0, 20, 0);
  handleControlChange(0, 20, 127);
  handleControlChange(0, 20, 127);
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Piano + Pad');
  handleControlChange(0, 20, 0);
  handleControlChange(0, 20, 127);
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Basse / EP');
  store.addMapping({ cc: 21, channel: -1, target: { kind: 'prevPatch' } });
  handleControlChange(0, 21, 0);
  handleControlChange(0, 21, 127);
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Piano + Pad');
});

test('pad and panic mappings reach the real store and native panic boundary', () => {
  const store = useConcert.getState();
  const padId = store.addPadLayer(selectCurrentPatch(store)!.id);
  store.addMapping({ cc: 22, channel: -1, target: { kind: 'padToggle' } });
  handleControlChange(0, 22, 0);
  handleControlChange(0, 22, 127);
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(false);
  handleControlChange(0, 22, 0);
  handleControlChange(0, 22, 127);
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(true);
  store.addMapping({ cc: 23, channel: -1, target: { kind: 'panic' } });
  handleControlChange(0, 23, 0);
  handleControlChange(0, 23, 127);
  expect(AudioEngine.panic).toHaveBeenCalledTimes(1);
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(false);
});

test('controller target labels and matching distinguish layer indices', () => {
  expect(sameTarget({ kind: 'layerVolume', index: 0 }, { kind: 'layerVolume', index: 1 })).toBe(false);
  expect(sameTarget({ kind: 'masterVolume' }, { kind: 'masterVolume' })).toBe(true);
  expect(sameTarget({ kind: 'masterVolume' }, { kind: 'panic' })).toBe(false);
  for (const target of [
    { kind: 'masterVolume' },
    { kind: 'nextPatch' },
    { kind: 'prevPatch' },
    { kind: 'padToggle' },
    { kind: 'panic' },
    { kind: 'layerVolume', index: 1 },
  ] as const) {
    expect(targetLabel(target)).toEqual(expect.any(String));
  }
});

test.each([120, 123])('MIDI command %s stops pads even with value zero and no mapping', (cc) => {
  const store = useConcert.getState();
  const padId = store.addPadLayer(selectCurrentPatch(store)!.id);
  for (const note of [60, 64, 67]) onKeyboardNote('noteOn', note);
  handleControlChange(0, cc, 0);
  jest.advanceTimersByTime(100);
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(false);
  expect(usePadChord.getState().detected).toBeNull();
  updatePads();
  expect(AudioEngine.setLayerNotes).toHaveBeenLastCalledWith(padId, [], 90, 2);
});
