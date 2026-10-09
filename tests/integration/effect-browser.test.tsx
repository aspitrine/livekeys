import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AudioEngine, { type PluginInfo } from '../../modules/audio-engine';
import EffectBrowser from '../../src/app/effect/[layerId]';
import { selectLayer, useConcert } from '../../src/store/concert';
import { clearEffects, resetConcert } from '../fixtures';

const appleDelay: PluginInfo = {
  id: 'aufx:dely:appl',
  name: 'AUDelay',
  manufacturer: 'Apple',
  kind: 'effect',
  isAUv3: false,
};
const valhalla: PluginInfo = {
  id: 'aufx:vsup:oDin',
  name: 'Supermassive',
  manufacturer: 'Valhalla DSP',
  kind: 'effect',
  isAUv3: true,
};

let layerId: string;

beforeEach(() => {
  layerId = resetConcert().layers[0]!.id;
  clearEffects(layerId);
  jest.mocked(useLocalSearchParams).mockReturnValue({ layerId });
  jest.mocked(AudioEngine.listPlugins).mockResolvedValue([appleDelay, valhalla]);
});

const effects = () => selectLayer(layerId)(useConcert.getState())!.effects;

test('opens on reverbs with ready-made settings, and adds one to the layer', async () => {
  await render(<EffectBrowser />);
  expect(await screen.findByText('Prêts à l’emploi')).toBeOnTheScreen();
  expect(screen.getByText('Salle de concert')).toBeOnTheScreen();
  // Delays are in their own category.
  expect(screen.queryByText('Slapback')).toBeNull();

  await fireEvent.press(screen.getByText('Salle de concert'));
  expect(effects()).toHaveLength(1);
  expect(effects()[0]!.plugin).toMatchObject({ preset: 'Medium Hall', params: { 0: 30 } });
  expect(router.back).toHaveBeenCalled();
});

test('a category lists its presets then the raw Apple units, third-party plugins apart', async () => {
  await render(<EffectBrowser />);
  await screen.findByText('Prêts à l’emploi');

  await fireEvent.press(screen.getByText('Délais & échos'));
  expect(screen.getByText('Slapback')).toBeOnTheScreen();
  expect(screen.getByText('Effets bruts')).toBeOnTheScreen();
  expect(screen.getByText('AUDelay')).toBeOnTheScreen();
  expect(screen.queryByText('Supermassive')).toBeNull();

  await fireEvent.press(screen.getByText('Plugins tiers'));
  expect(screen.getByText('Plugins installés')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Supermassive'));
  expect(effects()[0]!.plugin).toEqual({
    componentId: valhalla.id,
    name: 'Supermassive',
    manufacturer: 'Valhalla DSP',
  });
});

test('search looks through every category at once', async () => {
  await render(<EffectBrowser />);
  await screen.findByText('Prêts à l’emploi');
  await fireEvent.changeText(screen.getByPlaceholderText('Rechercher un effet…'), 'valhalla');
  expect(screen.getByText('Supermassive')).toBeOnTheScreen();
  expect(screen.queryByText('Salle de concert')).toBeNull();
});

test('with no third-party plugin, says how to install one; refresh rescans', async () => {
  jest.mocked(AudioEngine.listPlugins).mockResolvedValue([]);
  await render(<EffectBrowser />);
  await screen.findByText('Prêts à l’emploi');
  await fireEvent.press(screen.getByText('Plugins tiers'));
  expect(screen.getByText(/Aucun effet AUv3 installé/)).toBeOnTheScreen();

  jest.mocked(AudioEngine.listPlugins).mockResolvedValue([valhalla]);
  await fireEvent.press(screen.getByLabelText('Rafraîchir'));
  await act(async () => {});
  expect(screen.getByText('Supermassive')).toBeOnTheScreen();
});

test('cancel closes without adding anything', async () => {
  await render(<EffectBrowser />);
  await fireEvent.press(screen.getByText('Annuler'));
  expect(router.back).toHaveBeenCalled();
  expect(effects()).toEqual([]);
});
