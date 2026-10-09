import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AudioEngine, { type PluginInfo } from '../../modules/audio-engine';
import SoundBrowserScreen from '../../src/app/sound/[layerId]';
import { invalidateCatalog } from '../../src/engine/catalog';
import { selectLayer, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';
import { bundledPresets } from '../soundFontPresets';

jest.mock('expo-file-system', () => require('../mocks/file-system'));

const moog: PluginInfo = {
  id: 'aumu:mdl1:Moog',
  name: 'Model D',
  manufacturer: 'Moog',
  kind: 'instrument',
  isAUv3: true,
};
const korg: PluginInfo = {
  id: 'aumu:kmod:KORG',
  name: 'KORG Module',
  manufacturer: 'KORG',
  kind: 'instrument',
  isAUv3: true,
};

let layerId: string;
const layer = () => selectLayer(layerId)(useConcert.getState())!;

/** Finds a sound through the search field and picks it. */
const pickSound = async (name: string) => {
  await fireEvent.changeText(screen.getByPlaceholderText('Rechercher…'), name);
  await fireEvent.press(await screen.findByText(name));
};

beforeEach(() => {
  layerId = resetConcert().layers[0]!.id;
  jest.mocked(useLocalSearchParams).mockReturnValue({ layerId });
  invalidateCatalog();
  jest.mocked(AudioEngine.getSoundFontPresets).mockImplementation(async (path: string) =>
    bundledPresets(path.includes('GeneralUser-GS') ? 'GeneralUser-GS' : 'UprightPianoKW-small').map((s) => ({
      bank: s.bankNumber,
      program: s.program,
      name: s.name,
    })),
  );
  jest.mocked(AudioEngine.listPlugins).mockResolvedValue([moog, korg]);
});

test('picking a sound loads it on the layer, whose name follows the instrument', async () => {
  await render(<SoundBrowserScreen />);
  await pickSound('Harpsichord');
  expect(layer().sound.name).toBe('Harpsichord');
  expect(layer().name).toBe('Harpsichord');
});

test('a layer renamed by the user keeps its name when the sound changes', async () => {
  useConcert.getState().updateLayer(layerId, { name: 'Main gauche' });
  await render(<SoundBrowserScreen />);
  await pickSound('Harpsichord');
  expect(layer().sound.name).toBe('Harpsichord');
  expect(layer().name).toBe('Main gauche');
});

test('an AUv3 instrument replaces the SoundFont, and search filters plugins by maker', async () => {
  await render(<SoundBrowserScreen />);
  await fireEvent.press(screen.getByText('Plugins AUv3'));
  await act(async () => {});
  expect(screen.getByText('Model D')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByPlaceholderText('Rechercher…'), 'korg');
  expect(screen.queryByText('Model D')).toBeNull();
  await fireEvent.press(screen.getByText('KORG Module'));
  expect(layer().plugin).toEqual({ componentId: korg.id, name: 'KORG Module', manufacturer: 'KORG' });
  expect(layer().name).toBe('KORG Module');

  // Back to a SoundFont: the plugin is dropped.
  await fireEvent.press(screen.getByText('Sons'));
  await pickSound('Harpsichord');
  expect(layer().plugin).toBeUndefined();
});

test('a plugin layer opens on the plugins tab; an empty list explains and can be refreshed', async () => {
  useConcert
    .getState()
    .updateLayer(layerId, { plugin: { componentId: moog.id, name: 'Model D', manufacturer: 'Moog' } });
  jest.mocked(AudioEngine.listPlugins).mockResolvedValue([]);
  await render(<SoundBrowserScreen />);
  await act(async () => {});
  expect(screen.getByText('Aucun instrument Audio Unit trouvé.')).toBeOnTheScreen();

  jest.mocked(AudioEngine.listPlugins).mockResolvedValue([moog]);
  await fireEvent.press(screen.getByText('Rafraîchir'));
  await act(async () => {});
  expect(screen.getByText('Model D')).toBeOnTheScreen();
});

test('more sounds open the library, and done closes the browser', async () => {
  await render(<SoundBrowserScreen />);
  await fireEvent.press(screen.getByText('Plus de sons'));
  expect(router.push).toHaveBeenCalledWith('/library');
  await fireEvent.press(screen.getByText('Terminé'));
  expect(router.back).toHaveBeenCalled();
});

test('a layer deleted meanwhile shows nothing instead of crashing', async () => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ layerId: 'gone' });
  await render(<SoundBrowserScreen />);
  expect(screen.toJSON()).toBeNull();
});
