import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { shareAsync } from 'expo-sharing';
import { Alert } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import SettingsScreen from '../../src/app/settings';
import { useEngineStatus } from '../../src/engine/boot';
import { useMidiLearn, useMidiPickup } from '../../src/engine/controls';
import { defaultConcert } from '../../src/model/defaults';
import { useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';
import { fakeFileSystem } from '../mocks/file-system';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-file-system', () => require('../mocks/file-system'));

const picker = jest.mocked(File.pickFileAsync);
const picks = (data: unknown) =>
  picker.mockResolvedValue({ canceled: false, result: { text: async () => JSON.stringify(data) } } as never);

let alert: jest.SpyInstance;
/** Presses the button named `text` of the last alert. */
const answer = (text: string) =>
  act(async () =>
    alert.mock.calls
      .at(-1)![2]
      .find((b: { text: string }) => b.text === text)
      .onPress(),
  );

beforeEach(() => {
  fakeFileSystem.reset();
  resetConcert();
  useMidiLearn.setState({ learning: null });
  useMidiPickup.setState({ waiting: {} });
  useEngineStatus.setState({ bluetooth: [] });
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

test('sound and performance switches change the saved settings', async () => {
  await render(<SettingsScreen />);
  await fireEvent(screen.getByLabelText('Limiteur sur la sortie'), 'valueChange', false);
  await fireEvent(screen.getByLabelText('Précharger les patches voisins'), 'valueChange', false);
  await fireEvent.press(screen.getByText('Dur'));

  expect(useConcert.getState().settings).toMatchObject({
    limiter: false,
    preloadNeighbors: false,
    velocityCurve: 'heavy',
  });
  expect(screen.getByLabelText('Limiteur sur la sortie')).toHaveProp('value', false);
});

test('MIDI learn is armed and cancelled from the list of controls', async () => {
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByLabelText('Apprendre Volume master'));
  expect(useMidiLearn.getState().learning).toEqual({ kind: 'masterVolume' });
  expect(AudioEngine.setMidiVolumeLearn).toHaveBeenLastCalledWith(true);
  expect(screen.getByText('Bouge un contrôle…')).toBeOnTheScreen();

  await fireEvent.press(screen.getByLabelText('Annuler apprentissage Volume master'));
  expect(useMidiLearn.getState().learning).toBeNull();
});

test('a learned control shows its CC, can use pickup, and can be removed', async () => {
  useConcert.getState().addMapping({ cc: 7, channel: -1, target: { kind: 'masterVolume' } });
  useConcert.getState().addMapping({ cc: 20, channel: 2, target: { kind: 'panic' } });
  const [master] = useConcert.getState().concert.mappings;
  await render(<SettingsScreen />);

  expect(screen.getByText('CC 7 · omni')).toBeOnTheScreen();
  expect(screen.getByText('CC 20 · canal 3')).toBeOnTheScreen();
  // Pickup only makes sense for faders, not for the panic button.
  expect(screen.queryByLabelText('Rattrapage Panic')).toBeNull();

  await fireEvent(screen.getByLabelText('Rattrapage Volume master'), 'valueChange', true);
  expect(useConcert.getState().concert.mappings[0]!.pickup).toBe(true);
  await act(() => useMidiPickup.setState({ waiting: { [master!.id]: 'up' } }));
  expect(screen.getByText('↑ Monter le fader')).toBeOnTheScreen();

  await fireEvent.press(screen.getAllByLabelText('Retirer')[0]!);
  expect(useConcert.getState().concert.mappings.map((m) => m.cc)).toEqual([20]);
});

test('remembered Bluetooth keyboards show their state and can be forgotten', async () => {
  useConcert.getState().setSetting('bluetoothDevices', [
    { id: 'a', name: 'Nord Stage' },
    { id: 'b', name: 'Roli' },
  ]);
  useEngineStatus.setState({ bluetooth: [{ id: 'a', name: 'Nord Stage', state: 'connected' }] as never });
  await render(<SettingsScreen />);

  expect(screen.getByText('Connecté')).toBeOnTheScreen();
  expect(screen.getByText('Hors ligne')).toBeOnTheScreen();
  await fireEvent.press(screen.getAllByText('Oublier')[1]!);
  expect(useConcert.getState().settings.bluetoothDevices).toEqual([{ id: 'a', name: 'Nord Stage' }]);

  await fireEvent(screen.getByLabelText('Reconnexion automatique'), 'valueChange', false);
  expect(useConcert.getState().settings.bluetoothAutoReconnect).toBe(false);
});

test('a Bluetooth pairing error is shown instead of being lost', async () => {
  jest.mocked(AudioEngine.showBluetoothMidi).mockRejectedValueOnce(new Error('Bluetooth éteint'));
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText('Connecter…'));
  await act(async () => {});
  expect(alert).toHaveBeenCalledWith('Bluetooth MIDI', 'Bluetooth éteint');
});

test('the concert is renamed and exported as a shareable file', async () => {
  await render(<SettingsScreen />);
  await fireEvent.changeText(screen.getByDisplayValue('Mon concert'), 'Tournée');
  expect(useConcert.getState().concert.name).toBe('Tournée');

  await fireEvent.press(screen.getByText('Exporter…'));
  await act(async () => {});
  expect(shareAsync).toHaveBeenCalledWith('/cache/Tournée.livekeys.json', expect.anything());
  const file = JSON.parse(fakeFileSystem.contents.get('/cache/Tournée.livekeys.json')!);
  expect(file.concert).toEqual(useConcert.getState().concert);
});

test('importing asks before replacing the concert', async () => {
  const other = { ...defaultConcert(), name: 'Mariage' };
  picks({ format: 'livekeys-concert', version: 3, concert: other });
  await render(<SettingsScreen />);

  await fireEvent.press(screen.getByText('Importer…'));
  expect(alert.mock.calls.at(-1)![0]).toBe('Importer « Mariage » ?');
  expect(useConcert.getState().concert.name).toBe('Mon concert');

  await answer('Remplacer');
  expect(useConcert.getState().concert).toEqual(other);
  expect(useConcert.getState().currentPatchId).toBe(other.sets[0]!.patches[0]!.id);
});

test('an invalid file is refused with the reason, and the concert is kept', async () => {
  picks({ format: 'livekeys-concert', version: 3, concert: { id: 'x', name: 'Cassé', sets: 'nope' } });
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText('Importer…'));

  expect(alert.mock.calls.at(-1)![0]).toBe('Import impossible');
  expect(alert.mock.calls.at(-1)![1]).toMatch(/^Concert invalide \(sets/);
  expect(useConcert.getState().concert.name).toBe('Mon concert');
});

test('library and concert check open from settings', async () => {
  const { router } = require('expo-router');
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText('Ouvrir'));
  expect(router.push).toHaveBeenCalledWith('/library');
  await fireEvent.press(screen.getByText('Vérifier le concert…'));
  expect(router.push).toHaveBeenCalledWith('/check');
});

test('the demo concert replaces the current one only once confirmed', async () => {
  useConcert.getState().renameConcert('Mariage');
  await render(<SettingsScreen />);
  await fireEvent.press(screen.getByText('Concert de démonstration…'));
  expect(alert.mock.calls.at(-1)![0]).toBe('Charger le concert de démonstration ?');
  expect(useConcert.getState().concert.name).toBe('Mariage');

  await answer('Remplacer');
  const { concert } = useConcert.getState();
  expect(concert.name).toBe('Mon concert');
  expect(concert.sets[0]!.patches.map((p) => p.name)).toContain('Piano pop');
});
