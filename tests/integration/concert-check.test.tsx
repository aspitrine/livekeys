import { act, render, screen, userEvent } from '@testing-library/react-native';

import AudioEngine from '../../modules/audio-engine';
import { ConcertCheck } from '../../src/components/ConcertCheck';
import { useEngineStatus } from '../../src/engine/boot';
import { syncPatches, useLayerErrors } from '../../src/engine/sync';
import { selectCurrentPatch, useConcert } from '../../src/store/concert';
import { APPLE_EFFECTS, resetConcert } from '../fixtures';

beforeEach(() => {
  resetConcert();
  useEngineStatus.setState({ info: null, error: null, sources: [], bluetooth: [] });
  useLayerErrors.setState({}, true);
  useConcert.getState().setSetting('bluetoothDevices', []);
  jest.mocked(AudioEngine.listPlugins).mockResolvedValue(APPLE_EFFECTS);
});

test('a clean concert reports its live connections and the limits of the check', async () => {
  jest.mocked(AudioEngine.getMidiSources).mockReturnValueOnce([{ id: 1, name: 'Nord Stage' }]);
  useEngineStatus.setState({
    info: {
      running: true,
      sampleRate: 48000,
      bufferFrames: 128,
      ioBufferMs: 2.7,
      outputLatencyMs: 4,
      outputRoute: 'USB',
    },
  });
  useConcert.getState().setSetting('bluetoothDevices', [{ id: 'bt', name: 'Piaggero' }]);
  await render(<ConcertCheck />);
  expect(await screen.findByText('Aucun problème détecté')).toBeOnTheScreen();
  expect(AudioEngine.refreshMidi).toHaveBeenCalled();
  expect(AudioEngine.listPlugins).toHaveBeenCalledWith('all');
  expect(screen.getByText('Entrée MIDI : Nord Stage')).toBeOnTheScreen();
  expect(screen.getByText(/Moteur audio actif · sortie USB · 48 kHz/)).toBeOnTheScreen();
  expect(screen.getByText('Bluetooth Piaggero : hors ligne')).toBeOnTheScreen();
  expect(screen.getByText(/ne garantit pas la stabilité/)).toBeOnTheScreen();
});

test('missing plugins can be selected, and a failed plugin scan is explained', async () => {
  const user = userEvent.setup();
  const store = useConcert.getState();
  const target = store.concert.sets[0].patches[3];
  store.updateLayer(target.layers[0].id, {
    plugin: { componentId: 'aumu:Gone:Acme', name: 'Lost', manufacturer: 'Acme' },
  });
  useEngineStatus.setState({ error: 'Session audio refusée' });
  await render(<ConcertCheck />);
  expect(await screen.findByText('1 erreur · 0 avertissement')).toBeOnTheScreen();
  expect(
    screen.getByText('Moteur audio arrêté (Session audio refusée) : nouvel essai automatique en cours.'),
  ).toBeOnTheScreen();
  expect(screen.getByText('Aucune entrée MIDI : branche ou connecte le clavier.')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Sélectionner' }));
  expect(useConcert.getState().currentPatchId).toBe(target.id);
  expect(screen.getByRole('button', { name: 'Sélectionné' })).toBeDisabled();

  jest.mocked(AudioEngine.listPlugins).mockRejectedValueOnce(new Error('scan'));
  await user.press(screen.getByRole('button', { name: 'Relancer' }));
  expect(await screen.findByText(/Liste des plugins indisponible/)).toBeOnTheScreen();
  expect(screen.getByText('Aucun problème détecté')).toBeOnTheScreen();
});

test('native load failures are recorded for the check and cleared after a successful load', async () => {
  const patch = selectCurrentPatch(useConcert.getState())!;
  const layer = patch.layers[0];
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(AudioEngine.loadSoundFont).mockRejectedValueOnce(new Error('Fichier illisible'));
  await act(() => syncPatches(patch));
  expect(useLayerErrors.getState()).toEqual({ [layer.id]: 'Fichier illisible' });
  await render(<ConcertCheck />);
  expect(await screen.findByText(/n’a pas pu être chargé \(Fichier illisible\)/)).toBeOnTheScreen();
  await act(() => syncPatches(patch));
  expect(useLayerErrors.getState()).toEqual({});
  expect(await screen.findByText('Aucun problème détecté')).toBeOnTheScreen();
});
