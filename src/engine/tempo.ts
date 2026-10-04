import { DEFAULT_TEMPO, tapTempo } from '../lib/tempo';
import { selectCurrentPatch, useConcert } from '../store/concert';

let taps: number[] = [];
let tappedPatch: string | null = null;

/** Tap Tempo on a patch, the current one by default (screen button or MIDI control). Saves from the second tap. */
export function tap(patchId?: string, now = Date.now()) {
  const state = useConcert.getState();
  const id = patchId ?? selectCurrentPatch(state)?.id;
  const patch = state.concert.sets.flatMap((s) => s.patches).find((p) => p.id === id);
  if (!patch) return;
  // Taps from a previous patch never bleed into the next song.
  if (tappedPatch !== patch.id) taps = [];
  tappedPatch = patch.id;
  const result = tapTempo(taps, now);
  taps = result.taps;
  if (result.bpm !== undefined) state.setPatchTempo(patch.id, result.bpm);
}

export const patchTempo = (patch: { tempo?: number } | undefined) => patch?.tempo ?? DEFAULT_TEMPO;
