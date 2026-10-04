import { act, render, screen } from '@testing-library/react-native';
import { MidiPickupHint } from '../../src/components/MidiPickupHint';
import { handleControlChange } from '../../src/engine/controls';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

beforeEach(resetConcert);
test('the mixer tells the musician how to catch the saved volume and clears the hint after acquisition', async () => {
  useConcert.getState().addMapping({ cc: 35, channel: 0, target: { kind: 'masterVolume' }, pickup: true });
  await render(<MidiPickupHint target={{ kind: 'masterVolume' }} />);
  await act(() => handleControlChange(0, 35, 10));
  expect(screen.getByText('↑ Monter le fader')).toBeOnTheScreen();
  await act(() => handleControlChange(0, 35, 127));
  expect(screen.queryByText('↑ Monter le fader')).toBeNull();
  await act(() => useConcert.getState().setMasterVolume(0.4));
  await act(() => handleControlChange(0, 35, 120));
  expect(screen.getByText('↓ Baisser le fader')).toBeOnTheScreen();
  await act(() => useConcert.getState().removeMapping(useConcert.getState().concert.mappings[0].id));
  expect(screen.queryByText('↓ Baisser le fader')).toBeNull();
});
