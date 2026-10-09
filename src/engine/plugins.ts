import { useEffect, useState } from 'react';

import AudioEngine, { type PluginInfo, type PluginKind, type PluginSlot } from '../../modules/audio-engine';
import type { PluginRef } from '../model/types';

/**
 * Installed Audio Units of a kind. Scanned each time a browser opens (and on `refresh`):
 * plugins installed while the app runs must show up without a restart.
 */
export function usePlugins(kind: PluginKind) {
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);
  const [scan, setScan] = useState(0);
  useEffect(() => {
    let alive = true;
    AudioEngine.listPlugins(kind)
      .then((list) => alive && setPlugins(list))
      .catch(() => alive && setPlugins([]));
    return () => {
      alive = false;
    };
  }, [kind, scan]);
  return { plugins, refresh: () => setScan((n) => n + 1) };
}

export const toPluginRef = (p: PluginInfo): PluginRef => ({
  componentId: p.id,
  name: p.name,
  manufacturer: p.manufacturer,
});

/** Ids of every installed Audio Unit, or null when the scan fails. */
export const installedPluginIds = () =>
  AudioEngine.listPlugins('all')
    .then((list) => new Set(list.map((p) => p.id)))
    .catch(() => null);

/** Factory presets of a loaded Audio Unit. Throws while the AU is not loaded. */
export const pluginPresets = (layerId: string, slot: PluginSlot) => AudioEngine.getPluginPresets(layerId, slot);

export const selectPluginPreset = (layerId: string, slot: PluginSlot, number: number) =>
  AudioEngine.selectPluginPreset(layerId, slot, number);

/** Writable parameters of a loaded Audio Unit. Throws while the AU is not loaded. */
export const pluginParameters = (layerId: string, slot: PluginSlot) => AudioEngine.getPluginParameters(layerId, slot);

export const setPluginParameter = (layerId: string, slot: PluginSlot, address: number, value: number) =>
  AudioEngine.setPluginParameter(layerId, slot, address, value);
