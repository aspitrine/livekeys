const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI note → name, middle C (60) = C3 as in MainStage / Logic. */
export const noteName = (n: number) => `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 2}`;

export const isBlackKey = (n: number) => [1, 3, 6, 8, 10].includes(n % 12);

/** Full 88-key piano range. */
export const PIANO_LOW = 21;
export const PIANO_HIGH = 108;
