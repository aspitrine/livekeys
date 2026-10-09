import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AudioEngine from '../../modules/audio-engine';
import { TopBar } from '../../src/components/TopBar';
import { useEngineStatus } from '../../src/engine/boot';
import { usePerformance } from '../../src/engine/performance';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

const performance = (load: number, peak = load) => ({
  load,
  peak,
  overloads: 0,
  layers: [],
  cpu: 0,
  memoryMB: 0,
  availableMemoryMB: 0,
});

beforeEach(() => {
  resetConcert();
  useEngineStatus.setState({ info: null, error: null, sources: [], bluetooth: [] });
  usePerformance.setState({ current: null, history: [], overloads: 0 });
});

test('shows the current patch, what comes next, and steps through the concert', async () => {
  const [first, second] = useConcert.getState().concert.sets[0]!.patches;
  useConcert.getState().selectPatch(first!.id);
  await render(<TopBar />);

  expect(screen.getByText(first!.name)).toBeOnTheScreen();
  expect(screen.getByText(`Ensuite : ${second!.name}`)).toBeOnTheScreen();
  expect(screen.getByLabelText('Patch précédent')).toBeDisabled();

  await fireEvent.press(screen.getByLabelText('Patch suivant'));
  expect(useConcert.getState().currentPatchId).toBe(second!.id);
  expect(screen.getByText(/· 2\/9$/)).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText('Réglages du patch'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/patch/[id]', params: { id: second!.id } });
});

test('the last patch says the concert ends there', async () => {
  const patches = useConcert.getState().concert.sets[0]!.patches;
  useConcert.getState().selectPatch(patches.at(-1)!.id);
  await render(<TopBar />);
  expect(screen.getByText('Fin du concert')).toBeOnTheScreen();
  expect(screen.getByLabelText('Patch suivant')).toBeDisabled();
});

test('an empty concert shows no patch and no navigation', async () => {
  useConcert.getState().loadConcert({ ...useConcert.getState().concert, sets: [] });
  await render(<TopBar />);
  expect(screen.getByText('Aucun patch')).toBeOnTheScreen();
  expect(screen.getByLabelText('Patch suivant')).toBeDisabled();
});

test('names the connected keyboards, or says none is connected', async () => {
  await render(<TopBar />);
  expect(screen.getByText('Aucun clavier')).toBeOnTheScreen();

  await act(() => useEngineStatus.setState({ sources: [{ id: '1', name: 'Nord Stage' }] as never }));
  expect(screen.getByText('Nord Stage')).toBeOnTheScreen();
});

test('the audio pill shows start-up, load with glitches, then a failed engine', async () => {
  await render(<TopBar />);
  expect(screen.getByText('Démarrage…')).toBeOnTheScreen();

  await act(() => usePerformance.setState({ current: performance(42), overloads: 3 }));
  expect(screen.getByText(/DSP 42 %/)).toBeOnTheScreen();
  expect(screen.getByText(/3 ⚠︎/)).toBeOnTheScreen();

  await act(() => useEngineStatus.setState({ error: 'no audio' }));
  expect(screen.getByText('Audio indisponible')).toBeOnTheScreen();
  await fireEvent.press(screen.getByLabelText('Performance'));
  expect(router.push).toHaveBeenCalledWith('/performance');
});

test('stage, settings and panic are one tap away', async () => {
  await render(<TopBar />);
  await fireEvent.press(screen.getByLabelText('Mode scène'));
  expect(router.push).toHaveBeenCalledWith('/stage');
  await fireEvent.press(screen.getByLabelText('Réglages'));
  expect(router.push).toHaveBeenCalledWith('/settings');
  await fireEvent.press(screen.getByLabelText('Panic : coupe toutes les notes'));
  expect(AudioEngine.panic).toHaveBeenCalled();
});
