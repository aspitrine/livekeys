import { EFFECT_PRESETS } from '../src/model/effectCategories';
import { defaultConcert } from '../src/model/defaults';
import { useConcert, selectCurrentPatch } from '../src/store/concert';

/** Reset data through the public store API while retaining its action functions. */
export function resetConcert() {
  useConcert.getState().loadConcert(defaultConcert());
  useConcert.getState().setMasterVolume(0.9);
  const patch = selectCurrentPatch(useConcert.getState());
  if (!patch) throw new Error('Test concert has no current patch');
  return patch;
}

/** Apple's built-in effects used by the ready-made settings: installed on every iPad, as the plugin scan reports. */
export const APPLE_EFFECTS = [...new Set(EFFECT_PRESETS.map((p) => p.plugin.componentId))].map((id) => ({
  id,
  name: id,
  manufacturer: 'Apple',
  kind: 'effect' as const,
  isAUv3: false,
}));

/** The default concert comes with effects: tests about editing a chain start from an empty one. */
export function clearEffects(layerId: string) {
  useConcert.getState().updateLayer(layerId, { effects: [] });
}
