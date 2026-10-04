import { clampTempo, DEFAULT_TEMPO, tapTempo } from '../../src/lib/tempo';
import { useConcert, selectCurrentPatch } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

test('tempo is a whole BPM inside the native clock range', () => {
  expect(clampTempo(97.6)).toBe(98);
  expect(clampTempo(5)).toBe(20);
  expect(clampTempo(999)).toBe(300);
  expect(clampTempo(Number.NaN)).toBe(DEFAULT_TEMPO);
});

test('tap tempo averages the last intervals and restarts after a pause', () => {
  let state = tapTempo([], 0);
  expect(state).toEqual({ taps: [0] });
  for (const t of [500, 1000, 1500, 2000, 2500]) state = tapTempo(state.taps, t);
  expect(state.bpm).toBe(120);
  expect(state.taps).toEqual([500, 1000, 1500, 2000, 2500]);
  // A late tap (the drummer slowed down) moves the average, it does not replace it.
  expect(tapTempo(state.taps, 3100).bpm).toBe(114);
  expect(tapTempo(state.taps, 5000)).toEqual({ taps: [5000] });
  expect(tapTempo(state.taps, 2400)).toEqual({ taps: [2400] });
});

test('patch tempo is clamped, saved and copied with the patch', () => {
  const patch = resetConcert();
  const store = useConcert.getState();
  store.setPatchTempo(patch.id, 400);
  expect(selectCurrentPatch(useConcert.getState())!.tempo).toBe(300);
  store.duplicatePatch(patch.id);
  expect(selectCurrentPatch(useConcert.getState())!.tempo).toBe(300);
});
