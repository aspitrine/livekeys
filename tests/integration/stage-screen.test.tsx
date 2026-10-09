import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AudioEngine from '../../modules/audio-engine';
import StageScreen from '../../src/app/stage';
import { usePadChord } from '../../src/engine/pads';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(() => {
  resetConcert();
  usePadChord.setState({ detected: null });
});

const patches = () => useConcert.getState().concert.sets[0]!.patches;

test('shows the current patch big, with its position, set and audible layers', async () => {
  const patch = patches()[1]!;
  useConcert.getState().selectPatch(patch.id);
  useConcert.getState().updateLayer(patch.layers[1]!.id, { mute: true });
  await render(<StageScreen />);

  expect(screen.getByText(patch.name)).toBeOnTheScreen();
  expect(screen.getByText('Set 1')).toBeOnTheScreen();
  expect(screen.getByText('2 / 9')).toBeOnTheScreen();
  // A muted layer is not listed: the stage shows what is heard.
  expect(screen.getByText(patch.layers[0]!.name)).toBeOnTheScreen();
  expect(screen.queryByText(new RegExp(patch.layers[1]!.name))).toBeNull();
});

test('the halves of the screen go to the neighbour patches, named on each side', async () => {
  const [first, second, third] = patches();
  useConcert.getState().selectPatch(second!.id);
  await render(<StageScreen />);

  await fireEvent.press(screen.getByText(third!.name));
  expect(useConcert.getState().currentPatchId).toBe(third!.id);
  await fireEvent.press(screen.getByText(second!.name));
  await fireEvent.press(screen.getByText(first!.name));
  expect(useConcert.getState().currentPatchId).toBe(first!.id);
});

test('the playing pad shows its chord, the one detected or the fixed one', async () => {
  const patch = selectCurrentPatch(useConcert.getState())!;
  const padId = useConcert.getState().addPadLayer(patch.id);
  await render(<StageScreen />);
  expect(screen.getByText('Pad —')).toBeOnTheScreen();

  await act(() => usePadChord.setState({ detected: { root: 9, quality: 'min' } }));
  expect(screen.getByText('Pad Am')).toBeOnTheScreen();

  const pad = selectCurrentPatch(useConcert.getState())!.layers.find((l) => l.id === padId)!.pad!;
  await act(() =>
    useConcert.getState().updateLayer(padId, { pad: { ...pad, mode: 'fixed', chord: { root: 7, quality: '7' } } }),
  );
  expect(screen.getByText('Pad G7')).toBeOnTheScreen();
});

test('tap tempo, panic and quit are on the top bar', async () => {
  const patch = selectCurrentPatch(useConcert.getState())!;
  await render(<StageScreen />);
  expect(screen.getByLabelText('Tap Tempo, 120 BPM')).toBeOnTheScreen();

  const now = jest.spyOn(Date, 'now');
  for (const t of [0, 600, 1200]) {
    now.mockReturnValue(t);
    await fireEvent.press(screen.getByLabelText(/^Tap Tempo/));
  }
  now.mockRestore();
  expect(selectCurrentPatch(useConcert.getState())!.tempo).toBe(100);
  expect(screen.getByLabelText('Tap Tempo, 100 BPM')).toBeOnTheScreen();
  expect(selectCurrentPatch(useConcert.getState())!.id).toBe(patch.id);

  await fireEvent.press(screen.getByText('PANIC'));
  expect(AudioEngine.panic).toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Quitter'));
  expect(router.back).toHaveBeenCalled();
});
