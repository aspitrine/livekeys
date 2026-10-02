import AudioEngine from '../../modules/audio-engine';
import { DEFAULT_FADE, onKeyboardNote, panic, togglePads, updatePads, usePadChord } from '../../src/engine/pads';
import { selectCurrentPatch, selectLayer, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

let padId: string;
beforeEach(() => {
  const patch = resetConcert();
  usePadChord.setState({ detected: null });
  padId = useConcert.getState().addPadLayer(patch.id);
});
afterEach(() => {
  for (let note = 0; note < 128; note++) onKeyboardNote('noteOff', note);
  panic();
  updatePads();
});

function play(notes = [60, 64, 67]) {
  for (const note of notes) onKeyboardNote('noteOn', note);
}

test('waits for a stable chord and plays the pad at a fixed velocity', () => {
  play();
  jest.advanceTimersByTime(89);
  expect(AudioEngine.setLayerNotes).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(AudioEngine.setLayerNotes).toHaveBeenCalledWith(padId, [48, 55, 60, 64], 90, DEFAULT_FADE);
});

test('short passing chords never trigger the pad', () => {
  play();
  jest.advanceTimersByTime(40);
  for (const note of [60, 64, 67]) onKeyboardNote('noteOff', note);
  jest.advanceTimersByTime(100);
  expect(AudioEngine.setLayerNotes).not.toHaveBeenCalled();
});

test('releasing the piano keeps the chord pad held without retriggering', () => {
  play();
  jest.advanceTimersByTime(90);
  jest.mocked(AudioEngine.setLayerNotes).mockClear();
  for (const note of [60, 64, 67]) onKeyboardNote('noteOff', note);
  jest.advanceTimersByTime(100);
  expect(AudioEngine.setLayerNotes).not.toHaveBeenCalled();
  expect(usePadChord.getState().detected).toEqual({ root: 0, quality: 'maj' });
  updatePads();
  expect(AudioEngine.setLayerNotes).toHaveBeenCalledWith(padId, [48, 55, 60, 64], 90, DEFAULT_FADE);
});

test('lifting the fingers one by one never changes the pad chord', () => {
  play([60, 64, 67, 71]);
  jest.advanceTimersByTime(90);
  expect(usePadChord.getState().detected).toEqual({ root: 0, quality: 'maj7' });
  jest.mocked(AudioEngine.setLayerNotes).mockClear();
  // Legato release: the seventh is lifted first, leaving a plain C triad for a moment.
  for (const note of [71, 67, 64, 60]) {
    onKeyboardNote('noteOff', note);
    jest.advanceTimersByTime(120);
  }
  expect(AudioEngine.setLayerNotes).not.toHaveBeenCalled();
  expect(usePadChord.getState().detected).toEqual({ root: 0, quality: 'maj7' });
});

test('fixed chords use the configured register and transition time', () => {
  const pad = selectLayer(padId)(useConcert.getState())!.pad!;
  useConcert
    .getState()
    .updateLayer(padId, { pad: { ...pad, mode: 'fixed', chord: { root: 9, quality: 'min' }, base: 36, fade: 0.5 } });
  updatePads();
  expect(AudioEngine.setLayerNotes).toHaveBeenCalledWith(padId, [33, 40, 45, 48], 90, 0.5);
});

test('stopping and restarting pads updates their play state', () => {
  togglePads();
  updatePads();
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(false);
  expect(AudioEngine.setLayerNotes).toHaveBeenLastCalledWith(padId, [], 90, DEFAULT_FADE);
  togglePads();
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(true);
});

test('changing patches releases the previous pad', () => {
  play();
  jest.advanceTimersByTime(90);
  useConcert.getState().stepPatch(1);
  updatePads();
  expect(AudioEngine.setLayerNotes).toHaveBeenLastCalledWith(padId, [], 90, DEFAULT_FADE);
  expect(selectCurrentPatch(useConcert.getState())!.name).toBe('Piano + Pad');
});

test('panic silences native voices and leaves the pad stopped', () => {
  play();
  jest.advanceTimersByTime(90);
  panic();
  expect(AudioEngine.panic).toHaveBeenCalledTimes(1);
  expect(selectLayer(padId)(useConcert.getState())!.pad!.playing).toBe(false);
});

test('panic clears a pending keyboard chord before a pad can be restarted', () => {
  play();
  panic();
  togglePads();
  jest.mocked(AudioEngine.setLayerNotes).mockClear();
  jest.advanceTimersByTime(100);
  expect(usePadChord.getState().detected).toBeNull();
  expect(AudioEngine.setLayerNotes).not.toHaveBeenCalled();
  updatePads();
  expect(AudioEngine.setLayerNotes).toHaveBeenLastCalledWith(padId, [], 90, DEFAULT_FADE);
});
