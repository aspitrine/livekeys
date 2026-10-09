import { act, renderHook, waitFor } from '@testing-library/react-native';

import AudioEngine from '../../modules/audio-engine';
import { installedPluginIds, toPluginRef, usePlugins } from '../../src/engine/plugins';

const synth = { id: 'aumu:synt:acme', name: 'Synth', manufacturer: 'Acme', kind: 'instrument' as const, isAUv3: true };

test('installed plugins are listed by id, and a failed scan says unknown rather than none', async () => {
  jest.mocked(AudioEngine.listPlugins).mockResolvedValueOnce([synth]);
  await expect(installedPluginIds()).resolves.toEqual(new Set([synth.id]));

  jest.mocked(AudioEngine.listPlugins).mockRejectedValueOnce(new Error('AU registry unavailable'));
  await expect(installedPluginIds()).resolves.toBeNull();
});

test('the plugin browser rescans on refresh, so plugins installed meanwhile appear', async () => {
  jest.mocked(AudioEngine.listPlugins).mockResolvedValueOnce([]).mockResolvedValueOnce([synth]);
  const { result } = await renderHook(() => usePlugins('instrument'));
  await waitFor(() => expect(result.current.plugins).toEqual([]));

  await act(async () => result.current.refresh());
  await waitFor(() => expect(result.current.plugins).toEqual([synth]));
  expect(AudioEngine.listPlugins).toHaveBeenCalledWith('instrument');
  expect(toPluginRef(synth)).toEqual({ componentId: synth.id, name: 'Synth', manufacturer: 'Acme' });
});

test('a failed scan shows an empty browser instead of loading forever', async () => {
  jest.mocked(AudioEngine.listPlugins).mockRejectedValueOnce(new Error('AU registry unavailable'));
  const { result } = await renderHook(() => usePlugins('effect'));
  await waitFor(() => expect(result.current.plugins).toEqual([]));
});
