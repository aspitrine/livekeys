import { useEffect, useState } from 'react';

import AudioEngine, { type PluginInfo, type PluginKind } from '../../modules/audio-engine';
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
