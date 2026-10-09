import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';

import AudioEngine from '../../modules/audio-engine';
import PluginScreen from '../../src/app/plugin/[layerId]';
import { selectLayer, useConcert } from '../../src/store/concert';
import { clearEffects, resetConcert } from '../fixtures';

const delay = { componentId: 'aufx:dely:appl', name: 'AUDelay', manufacturer: 'Apple' };

let layerId: string;
let effectId: string;

beforeEach(() => {
  layerId = resetConcert().layers[0]!.id;
  clearEffects(layerId);
  useConcert.getState().addEffect(layerId, delay);
  effectId = selectLayer(layerId)(useConcert.getState())!.effects[0]!.id;
  jest.mocked(useLocalSearchParams).mockReturnValue({ layerId, slot: effectId });
  jest.mocked(AudioEngine.getPluginParameters).mockReturnValue([
    { address: 0, name: 'Dry/Wet', min: 0, max: 100, value: 50, unit: '%' },
    { address: 1, name: 'Delay Time', min: 0, max: 2, value: 1, unit: 's' },
  ]);
  jest.mocked(AudioEngine.getPluginPresets).mockReturnValue({ presets: [], current: -1 });
});

const effect = () => selectLayer(layerId)(useConcert.getState())!.effects[0];

/** The native editor reports whether the Audio Unit has its own interface. */
const editorLoads = (hasView: boolean) =>
  act(() => screen.getByTestId('plugin-editor').props.onLayout?.({ nativeEvent: { hasView } }));

test('an Audio Unit without interface gets one slider per parameter, sent to the engine', async () => {
  await render(<PluginScreen />);
  await editorLoads(false);
  expect(screen.getByText('Dry/Wet')).toBeOnTheScreen();
  expect(screen.getByText('50 %')).toBeOnTheScreen();
  expect(screen.getByText('1 s')).toBeOnTheScreen();

  await fireEvent(screen.getByLabelText('Dry/Wet'), 'valueChange', 37.5);
  expect(AudioEngine.setPluginParameter).toHaveBeenCalledWith(layerId, effectId, 0, 37.5);
  expect(screen.getByText('37.50 %')).toBeOnTheScreen();
});

test('an Audio Unit with neither interface nor parameter says so', async () => {
  jest.mocked(AudioEngine.getPluginParameters).mockReturnValue([]);
  await render(<PluginScreen />);
  await editorLoads(false);
  expect(screen.getByText('Ce plugin n’a ni interface ni paramètre réglable.')).toBeOnTheScreen();
});

test('factory presets are listed and picked, and the current one is named', async () => {
  jest.mocked(AudioEngine.getPluginPresets).mockReturnValue({
    presets: [
      { number: 0, name: 'Short Echo' },
      { number: 1, name: 'Long Echo' },
    ],
    current: 0,
  });
  await render(<PluginScreen />);
  await editorLoads(false);

  await fireEvent.press(screen.getByText('Short Echo'));
  expect(screen.getByText('Presets (2)')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('Long Echo'));
  expect(AudioEngine.selectPluginPreset).toHaveBeenCalledWith(layerId, effectId, 1);
  expect(screen.queryByText('Presets (2)')).toBeNull();
  expect(screen.getByText('Long Echo')).toBeOnTheScreen();
});

test('a custom sound shows « Preset personnalisé », and a preset list that fails to load is hidden', async () => {
  jest.mocked(AudioEngine.getPluginPresets).mockReturnValue({ presets: [{ number: 0, name: 'A' }], current: -1 });
  const { unmount } = await render(<PluginScreen />);
  expect(screen.getByText('Preset personnalisé')).toBeOnTheScreen();
  await unmount();

  jest.mocked(AudioEngine.getPluginPresets).mockImplementation(() => {
    throw new Error('not loaded');
  });
  await render(<PluginScreen />);
  expect(screen.queryByText('Preset personnalisé')).toBeNull();
});

test('an Audio Unit with its own interface shows it instead of sliders', async () => {
  await render(<PluginScreen />);
  await editorLoads(true);
  expect(screen.queryByText('Dry/Wet')).toBeNull();
});

test('an effect can be bypassed and removed from its own screen', async () => {
  await render(<PluginScreen />);
  await fireEvent.press(screen.getByLabelText('Désactiver l’effet'));
  expect(effect()!.bypass).toBe(true);
  expect(screen.getByText('Désactivé')).toBeOnTheScreen();

  await fireEvent.press(screen.getByText('Retirer l’effet'));
  expect(router.back).toHaveBeenCalled();
  expect(effect()).toBeUndefined();
});

test('leaving the screen saves the plugin state into the patch', async () => {
  jest.mocked(AudioEngine.getPluginState).mockResolvedValue('c3RhdGU=');
  const { unmount } = await render(<PluginScreen />);
  await fireEvent.press(screen.getByText('Terminé'));
  expect(router.back).toHaveBeenCalled();
  await unmount();
  await act(async () => {});
  expect(effect()!.plugin.state).toBe('c3RhdGU=');
});
