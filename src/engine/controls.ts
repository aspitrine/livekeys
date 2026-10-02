import { create } from 'zustand';

import type { MappingTarget } from '../model/types';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { panic, togglePads } from './pads';

/** While set, the next controller moved on the hardware gets mapped to this target. */
export const useMidiLearn = create<{ learning: MappingTarget | null }>(() => ({ learning: null }));

export const startLearn = (target: MappingTarget) => useMidiLearn.setState({ learning: target });
export const cancelLearn = () => useMidiLearn.setState({ learning: null });

/** Every target the user can map, in display order. */
export const MAPPABLE_TARGETS: MappingTarget[] = [
  { kind: 'masterVolume' },
  ...[0, 1, 2, 3, 4, 5].map((index): MappingTarget => ({ kind: 'layerVolume', index })),
  { kind: 'nextPatch' },
  { kind: 'prevPatch' },
  { kind: 'padToggle' },
  { kind: 'panic' },
];

export function targetLabel(t: MappingTarget): string {
  switch (t.kind) {
    case 'masterVolume':
      return 'Volume master';
    case 'layerVolume':
      return `Volume layer ${t.index + 1}`;
    case 'nextPatch':
      return 'Patch suivant';
    case 'prevPatch':
      return 'Patch précédent';
    case 'padToggle':
      return 'Pad on / off';
    case 'panic':
      return 'Panic';
  }
}

export const sameTarget = (a: MappingTarget, b: MappingTarget) =>
  a.kind === b.kind && (a.kind !== 'layerVolume' || a.index === (b as typeof a).index);

/** Last value per "channel:cc", to fire buttons on the press edge only. */
const lastValues = new Map<string, number>();

/** Called for every Control Change coming from the hardware. */
export function handleControlChange(channel: number, cc: number, value: number) {
  // These MIDI commands are unconditional, including their normal value of zero.
  // The native engine already stops its voices; keep pad state/timers in step too.
  if (cc === 120 || cc === 123) {
    panic();
    return;
  }
  const store = useConcert.getState();
  const learning = useMidiLearn.getState().learning;
  if (learning) {
    store.addMapping({ cc, channel, target: learning });
    cancelLearn();
    return;
  }

  const key = `${channel}:${cc}`;
  const previous = lastValues.get(key) ?? 0;
  lastValues.set(key, value);
  const pressed = value >= 64 && previous < 64;

  for (const m of store.concert.mappings) {
    if (m.cc !== cc || (m.channel >= 0 && m.channel !== channel)) continue;
    const t = m.target;
    switch (t.kind) {
      case 'masterVolume':
        store.setMasterVolume(value / 127);
        break;
      case 'layerVolume': {
        const layer = selectCurrentPatch(store)?.layers[t.index];
        if (layer) store.updateLayer(layer.id, { volume: Math.round((value / 127) * 100) / 100 });
        break;
      }
      case 'nextPatch':
        if (pressed) store.stepPatch(1);
        break;
      case 'prevPatch':
        if (pressed) store.stepPatch(-1);
        break;
      case 'panic':
        if (pressed) panic();
        break;
      case 'padToggle':
        if (pressed) togglePads();
        break;
    }
  }
}
