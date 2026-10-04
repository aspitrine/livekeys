import { act, render, screen, userEvent } from '@testing-library/react-native';

import AudioEngine from '../../modules/audio-engine';
import { PatchEditor } from '../../src/components/PatchEditor';
import { bootEngine, useEngineStatus } from '../../src/engine/boot';
import { handleControlChange, targetLabel } from '../../src/engine/controls';
import { tap } from '../../src/engine/tempo';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(() => {
  resetConcert();
});

test('the engine follows the tempo of the current patch', async () => {
  jest.mocked(AudioEngine.start).mockResolvedValue({
    running: true,
    sampleRate: 48000,
    bufferFrames: 128,
    ioBufferMs: 2.7,
    outputLatencyMs: 4,
    outputRoute: 'Speaker',
  });
  await bootEngine();
  expect(useEngineStatus.getState().error).toBeNull();
  const store = useConcert.getState();
  const [first, second] = store.concert.sets[0].patches;
  store.selectPatch(first.id);
  store.setPatchTempo(second.id, 90);
  store.selectPatch(second.id);
  expect(AudioEngine.setTempo).toHaveBeenLastCalledWith(90);
  store.selectPatch(first.id);
  expect(AudioEngine.setTempo).toHaveBeenLastCalledWith(120);
  jest.mocked(AudioEngine.setTempo).mockClear();
  store.setMasterVolume(0.5);
  expect(AudioEngine.setTempo).not.toHaveBeenCalled();
});

test('a MIDI button taps the tempo of the current patch, never mixing taps between patches', () => {
  const store = useConcert.getState();
  store.addMapping({ cc: 64 + 1, channel: 0, target: { kind: 'tapTempo' } });
  expect(targetLabel({ kind: 'tapTempo' })).toBe('Tap Tempo');
  const now = jest.spyOn(Date, 'now');
  const press = (t: number) => {
    now.mockReturnValue(t);
    handleControlChange(0, 65, 127);
    handleControlChange(0, 65, 0);
  };
  press(0);
  expect(selectCurrentPatch(useConcert.getState())!.tempo).toBeUndefined();
  press(600);
  press(1200);
  expect(selectCurrentPatch(useConcert.getState())!.tempo).toBe(100);
  store.stepPatch(1);
  tap(undefined, 1500);
  expect(selectCurrentPatch(useConcert.getState())!.tempo).toBeUndefined();
  now.mockRestore();
});

test('tempo is edited and tapped from the patch editor without changing the playing patch', async () => {
  const user = userEvent.setup();
  const store = useConcert.getState();
  const current = selectCurrentPatch(store)!;
  const other = store.concert.sets[0].patches[2];
  await render(<PatchEditor patchId={other.id} />);
  expect(screen.getByText('120 BPM')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Accélérer le tempo' }));
  expect(screen.getByText('121 BPM')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Ralentir le tempo' }));
  await user.press(screen.getByRole('button', { name: 'Ralentir le tempo' }));
  expect(screen.getByText('119 BPM')).toBeOnTheScreen();
  const now = jest.spyOn(Date, 'now');
  now.mockReturnValue(10_000);
  await user.press(screen.getByRole('button', { name: 'Tap Tempo' }));
  now.mockReturnValue(10_750);
  await user.press(screen.getByRole('button', { name: 'Tap Tempo' }));
  now.mockRestore();
  expect(screen.getByText('80 BPM')).toBeOnTheScreen();
  expect(useConcert.getState().currentPatchId).toBe(current.id);
  await act(() => store.setPatchTempo(other.id, 20));
  expect(await screen.findByRole('button', { name: 'Ralentir le tempo' })).toBeDisabled();
});
