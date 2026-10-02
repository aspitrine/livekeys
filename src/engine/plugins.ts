import { useEffect, useState } from 'react';

import AudioEngine, { type PluginInfo, type PluginKind } from '../../modules/audio-engine';
import type { PluginRef } from '../model/types';

const cache = new Map<PluginKind, Promise<PluginInfo[]>>();

/** Installed Audio Units of a kind (scanned once per app session). */
export function usePlugins(kind: PluginKind) {
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null);
  useEffect(() => {
    if (!cache.has(kind)) cache.set(kind, AudioEngine.listPlugins(kind));
    cache
      .get(kind)!
      .then(setPlugins)
      .catch(() => setPlugins([]));
  }, [kind]);
  return plugins;
}

export const toPluginRef = (p: PluginInfo): PluginRef => ({
  componentId: p.id,
  name: p.name,
  manufacturer: p.manufacturer,
});
