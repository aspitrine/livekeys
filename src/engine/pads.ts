import { create } from 'zustand';

import AudioEngine from '../../modules/audio-engine';
import { type Chord, detectChord, padVoicing, sameChord } from '../lib/chords';
import { selectCurrentPatch, useConcert } from '../store/concert';

/** A chord must stay the same this long before pads follow it (filters passing notes and arpeggios). */
const SETTLE_MS = 90;
const PAD_VELOCITY = 90;
/** Seconds of crossfade between two chords. */
export const DEFAULT_FADE = 2;

/** Chord detected from the keyboard, shared with the UI. */
export const usePadChord = create<{ detected: Chord | null }>(() => ({ detected: null }));

const held = new Set<number>();
let pending: ReturnType<typeof setTimeout> | undefined;
/** Pad layers currently given notes, so they can be released when they leave the active patch. */
const sounding = new Set<string>();

/** Called for every note event from the keyboard (hardware or on-screen). */
export function onKeyboardNote(type: 'noteOn' | 'noteOff', note: number) {
  if (type === 'noteOn') held.add(note);
  else held.delete(note);

  // Releasing the keys keeps the current chord: the pad holds until a new chord is played.
  const chord = detectChord(held);
  if (!chord || sameChord(chord, usePadChord.getState().detected)) {
    clearTimeout(pending);
    return;
  }
  clearTimeout(pending);
  pending = setTimeout(() => {
    if (sameChord(detectChord(held), chord)) {
      usePadChord.setState({ detected: chord });
      updatePads();
    }
  }, SETTLE_MS);
}

/** Gives every pad layer of the current patch its notes; releases pads of other patches. */
export function updatePads() {
  const state = useConcert.getState();
  const patch = selectCurrentPatch(state);
  const detected = usePadChord.getState().detected;
  const active = new Set<string>();

  for (const layer of patch?.layers ?? []) {
    if (!layer.pad) continue;
    active.add(layer.id);
    const chord = layer.pad.mode === 'fixed' ? layer.pad.chord : detected;
    const notes = layer.pad.playing && chord ? padVoicing(chord, layer.pad.base) : [];
    AudioEngine.setLayerNotes(layer.id, notes, PAD_VELOCITY, layer.pad.fade ?? DEFAULT_FADE);
    if (notes.length) sounding.add(layer.id);
    else sounding.delete(layer.id);
  }

  for (const id of [...sounding]) {
    if (active.has(id)) continue;
    AudioEngine.setLayerNotes(id, [], PAD_VELOCITY, DEFAULT_FADE);
    sounding.delete(id);
  }
}

/** Starts / stops every pad of the current patch (MIDI-mappable). */
export function togglePads() {
  const state = useConcert.getState();
  const pads = selectCurrentPatch(state)?.layers.filter((l) => l.pad) ?? [];
  const playing = !pads.some((l) => l.pad!.playing);
  for (const layer of pads) state.updateLayer(layer.id, { pad: { ...layer.pad!, playing } });
}

/** Panic: silences everything, pads included (they stay off until restarted). */
export function panic() {
  const state = useConcert.getState();
  for (const layer of selectCurrentPatch(state)?.layers ?? []) {
    if (layer.pad?.playing) state.updateLayer(layer.id, { pad: { ...layer.pad, playing: false } });
  }
  AudioEngine.panic();
}
