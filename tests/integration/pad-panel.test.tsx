import { act, render, screen, userEvent } from '@testing-library/react-native';

import { PadPanel } from '../../src/components/PadPanel';
import { onKeyboardNote, panic, updatePads, usePadChord } from '../../src/engine/pads';
import AudioEngine from '../../modules/audio-engine';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(() => {
  resetConcert();
  usePadChord.setState({ detected: null });
});
afterEach(() => {
  for (let note = 0; note < 128; note++) onKeyboardNote('noteOff', note);
});

test('adding a pad, detecting a chord, stopping it and panic work through the real UI and store', async () => {
  const user = userEvent.setup();
  await render(<PadPanel />);
  await user.press(screen.getByRole('button', { name: 'Ajouter un pad' }));
  expect(screen.getByLabelText('Arrêter le pad')).toBeOnTheScreen();
  expect(selectCurrentPatch(useConcert.getState())!.layers.find((l) => l.pad)!.volume).toBe(0.1);
  await act(async () => {
    for (const note of [60, 64, 67]) onKeyboardNote('noteOn', note);
    jest.advanceTimersByTime(90);
  });
  expect(screen.getByText('C')).toBeOnTheScreen();
  expect(AudioEngine.setLayerNotes).toHaveBeenCalledWith(expect.any(String), [48, 55, 60, 64], 90, 2);
  await user.press(screen.getByLabelText('Arrêter le pad'));
  expect(screen.getByLabelText('Lancer le pad')).toBeOnTheScreen();
  await act(async () => {
    updatePads();
  });
  expect(AudioEngine.setLayerNotes).toHaveBeenLastCalledWith(expect.any(String), [], 90, 2);
  await user.press(screen.getByLabelText('Lancer le pad'));
  await act(async () => {
    panic();
  });
  expect(screen.getByLabelText('Lancer le pad')).toBeOnTheScreen();
  expect(AudioEngine.panic).toHaveBeenCalled();
});
