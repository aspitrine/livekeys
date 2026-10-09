import AudioEngine from '../../modules/audio-engine';

/** Plays a note from the on-screen keyboard, as if it came from MIDI channel 1. */
export const playNote = (note: number, velocity: number) => AudioEngine.noteOn(note, velocity, 0);

export const releaseNote = (note: number) => AudioEngine.noteOff(note, 0);
