import { create } from 'zustand';
import AudioEngine from '../../modules/audio-engine';

import type { MappingTarget, MidiMapping } from '../model/types';
import { mixerLayers, selectCurrentPatch, useConcert } from '../store/concert';
import { panic, togglePads } from './pads';
import { tap } from './tempo';

/** While set, the next controller moved on the hardware gets mapped to this target. */
export const useMidiLearn = create<{ learning: MappingTarget | null }>(() => ({ learning: null }));

/** Mixer controls the host owns: their CC must not also reach instruments (expression, volume, plugin parameters). */
const hostOwned = (target: MappingTarget) =>
  target.kind === 'masterVolume' || target.kind === 'layerVolume' || target.kind === 'layerMute';

/** CC/channel pairs the native engine keeps away from the instruments. */
export const hostOwnedControls = (mappings: MidiMapping[]) =>
  mappings.filter((m) => hostOwned(m.target)).map(({ cc, channel }) => ({ cc, channel }));

export const startLearn = (target: MappingTarget) => {
  AudioEngine.setMidiVolumeLearn(hostOwned(target));
  useMidiLearn.setState({ learning: target });
};
export const cancelLearn = () => {
  AudioEngine.setMidiVolumeLearn(false);
  useMidiLearn.setState({ learning: null });
};

/** Every target the user can map, in display order. */
export const MAPPABLE_TARGETS: MappingTarget[] = [
  { kind: 'masterVolume' },
  ...[0, 1, 2, 3, 4, 5].map((index): MappingTarget => ({ kind: 'layerVolume', index })),
  ...[0, 1, 2, 3, 4, 5].map((index): MappingTarget => ({ kind: 'layerMute', index })),
  { kind: 'nextPatch' },
  { kind: 'prevPatch' },
  { kind: 'padToggle' },
  { kind: 'tapTempo' },
  { kind: 'panic' },
];

export function targetLabel(t: MappingTarget): string {
  switch (t.kind) {
    case 'masterVolume':
      return 'Volume master';
    case 'layerVolume':
      return `Volume layer ${t.index + 1}`;
    case 'layerMute':
      return `Layer ${t.index + 1} on / off`;
    case 'nextPatch':
      return 'Patch suivant';
    case 'prevPatch':
      return 'Patch précédent';
    case 'padToggle':
      return 'Pad on / off';
    case 'tapTempo':
      return 'Tap Tempo';
    case 'panic':
      return 'Panic';
  }
}

export const sameTarget = (a: MappingTarget, b: MappingTarget) =>
  a.kind === b.kind && ((a.kind !== 'layerVolume' && a.kind !== 'layerMute') || a.index === (b as typeof a).index);

/** Direction to move each waiting hardware fader; runtime state is never persisted. */
export const useMidiPickup = create<{ waiting: Record<string, 'up' | 'down'> }>(() => ({ waiting: {} }));
type PickupState = { mapping: MidiMapping; context: string; expected: number; acquired: boolean; hardware?: number };
const pickups = new Map<string, PickupState>();

function pickupAllows(mapping: MidiMapping, channel: number, context: string, current: number, next: number) {
  const key = `${mapping.id}:${channel}`;
  const waiting = useMidiPickup.getState().waiting;
  const show = (direction?: 'up' | 'down') => {
    if (waiting[mapping.id] === direction) return;
    const updated = { ...waiting };
    if (direction) updated[mapping.id] = direction;
    else delete updated[mapping.id];
    useMidiPickup.setState({ waiting: updated });
  };
  if (!mapping.pickup) {
    pickups.delete(key);
    show();
    return true;
  }
  let state = pickups.get(key);
  if (
    !state ||
    state.mapping !== mapping ||
    state.context !== context ||
    Math.abs(state.expected - current) > 0.000001
  ) {
    state = { mapping, context, expected: current, acquired: false };
    pickups.set(key, state);
  }
  const crossed = state.hardware !== undefined && (state.hardware - current) * (next - current) <= 0;
  state.acquired ||= Math.abs(next - current) <= 1 / 127 || crossed;
  state.hardware = next;
  if (!state.acquired) {
    show(next < current ? 'up' : 'down');
    return false;
  }
  // Predict the exact value written by the mapping to distinguish our own updates from UI edits.
  state.expected = mapping.target.kind === 'layerVolume' ? Math.round(next * 100) / 100 : next;
  show();
  return true;
}

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
        if (pickupAllows(m, channel, 'master', store.masterVolume, value / 127)) store.setMasterVolume(value / 127);
        break;
      case 'layerVolume': {
        const layer = mixerLayers(selectCurrentPatch(store))[t.index];
        if (layer && pickupAllows(m, channel, layer.id, layer.volume, value / 127))
          store.updateLayer(layer.id, { volume: Math.round((value / 127) * 100) / 100 });
        break;
      }
      case 'layerMute': {
        const layer = mixerLayers(selectCurrentPatch(useConcert.getState()))[t.index];
        if (pressed && layer) store.updateLayer(layer.id, { mute: !layer.mute });
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
      case 'tapTempo':
        if (pressed) tap();
        break;
    }
  }
}

useConcert.subscribe((state, previous) => {
  if (state.currentPatchId === previous.currentPatchId && state.concert.mappings === previous.concert.mappings) return;
  const ids = new Set(state.concert.mappings.map((m) => m.id));
  for (const [key, value] of pickups) if (!ids.has(value.mapping.id) || value.context !== 'master') pickups.delete(key);
  useMidiPickup.setState({ waiting: {} });
});
