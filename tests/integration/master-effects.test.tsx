import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import AudioEngine from '../../modules/audio-engine';
import PluginScreen from '../../src/app/plugin/[layerId]';
import { MasterStrip } from '../../src/components/MasterStrip';
import { capturePluginStates, syncMasterEffects, useLayerErrors } from '../../src/engine/sync';
import { checkConcert } from '../../src/lib/concertCheck';
import { MASTER_ID } from '../../src/model/types';
import { selectEffectHost, useConcert } from '../../src/store/concert';
import { resetConcert } from '../fixtures';

const hall = { componentId: 'aufx:rvb2:appl', name: 'AUReverb2', manufacturer: 'Apple' };
const delay = { componentId: 'aufx:dely:appl', name: 'AUDelay', manufacturer: 'Apple' };
const masterEffects = () => useConcert.getState().concert.masterEffects ?? [];

beforeEach(() => {
  resetConcert();
  useLayerErrors.setState({}, true);
});

test('master inserts are edited with the same actions as layer effects and saved with the concert', () => {
  const store = useConcert.getState();
  store.addEffect(MASTER_ID, hall);
  store.addEffect(MASTER_ID, delay);
  const [reverb, echo] = masterEffects();
  store.moveEffect(MASTER_ID, echo.id, -1);
  expect(masterEffects().map((e) => e.plugin.name)).toEqual(['AUDelay', 'AUReverb2']);
  store.setEffectBypass(MASTER_ID, reverb.id, true);
  store.savePluginState(MASTER_ID, reverb.id, 'c3RhdGU=');
  expect(masterEffects()[1]).toMatchObject({ bypass: true, plugin: { state: 'c3RhdGU=' } });
  // The master chain belongs to the concert: no layer was touched.
  expect(useConcert.getState().concert.sets[0].patches.every((p) => p.layers.every((l) => !l.effects.length))).toBe(
    true,
  );
  expect(selectEffectHost(MASTER_ID)(useConcert.getState())?.effects).toBe(masterEffects());
  store.removeEffect(MASTER_ID, echo.id);
  expect(masterEffects().map((e) => e.id)).toEqual([reverb.id]);
});

test('the engine receives master inserts in order and failures reach the concert check', async () => {
  const store = useConcert.getState();
  store.addEffect(MASTER_ID, hall);
  store.addEffect(MASTER_ID, delay);
  const [reverb, echo] = masterEffects();
  await syncMasterEffects(masterEffects());
  expect(AudioEngine.addEffect).toHaveBeenCalledWith(MASTER_ID, reverb.id, hall.componentId, null, false);
  expect(AudioEngine.addEffect).toHaveBeenCalledWith(MASTER_ID, echo.id, delay.componentId, null, false);
  store.moveEffect(MASTER_ID, echo.id, -1);
  store.removeEffect(MASTER_ID, reverb.id);
  await syncMasterEffects(masterEffects());
  expect(AudioEngine.removeEffect).toHaveBeenCalledWith(MASTER_ID, reverb.id);

  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.mocked(AudioEngine.addEffect).mockRejectedValueOnce(new Error('AU absente'));
  store.addEffect(MASTER_ID, hall);
  await syncMasterEffects(masterEffects());
  expect(useLayerErrors.getState()[MASTER_ID]).toBe('AU absente');
  const issues = checkConcert(useConcert.getState().concert, {
    installedPlugins: new Set([delay.componentId]),
    isBankInstalled: () => true,
    layerErrors: useLayerErrors.getState(),
  });
  expect(issues.map((i) => i.message)).toEqual([
    'Master : effet « AUReverb2 » non installé.',
    'Master : effets non chargés (AU absente).',
  ]);

  jest.mocked(AudioEngine.getPluginState).mockResolvedValue('bGl2ZQ==');
  await capturePluginStates(MASTER_ID, selectEffectHost(MASTER_ID)(useConcert.getState()));
  expect(masterEffects().every((e) => e.plugin.state === 'bGl2ZQ==')).toBe(true);
  expect(AudioEngine.getPluginState).not.toHaveBeenCalledWith(MASTER_ID, 'instrument');
});

test('the master strip shows its effect slots and opens the effect browser for the master', async () => {
  await render(<MasterStrip />);
  await fireEvent.press(screen.getByLabelText('Ajouter un effet au master'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/effect/[layerId]', params: { layerId: MASTER_ID } });
  await act(() => useConcert.getState().addEffect(MASTER_ID, hall));
  expect(screen.getByText('Reverb2')).toBeOnTheScreen();
});

test('regression: the plugin screen of a master effect opens without an endless re-render', async () => {
  const { useLocalSearchParams } = jest.requireMock('expo-router');
  useConcert.getState().addEffect(MASTER_ID, hall);
  const [reverb] = masterEffects();
  useLocalSearchParams.mockReturnValue({ layerId: MASTER_ID, slot: reverb.id });
  const first = selectEffectHost(MASTER_ID)(useConcert.getState());
  expect(selectEffectHost(MASTER_ID)(useConcert.getState())).toBe(first);
  await render(<PluginScreen />);
  expect(screen.getByText(/sauvegardés dans le concert/)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Désactiver l’effet' }));
  expect(masterEffects()[0].bypass).toBe(true);
});
