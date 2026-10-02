/** Chord theory for chord pads: naming, detection from held notes, pad voicing. */

export type ChordQuality = 'maj' | 'min' | '7' | 'maj7' | 'm7' | 'sus2' | 'sus4' | 'add9' | 'dim' | 'aug' | '5';

export type Chord = { root: number; quality: ChordQuality };

export const ROOT_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** French solfège, shown next to the letter names. */
export const ROOT_NAMES_FR = ['Do', 'Do♯', 'Ré', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];

export const QUALITIES: { id: ChordQuality; label: string; suffix: string; intervals: number[] }[] = [
  { id: 'maj', label: 'Majeur', suffix: '', intervals: [0, 4, 7] },
  { id: 'min', label: 'Mineur', suffix: 'm', intervals: [0, 3, 7] },
  { id: '7', label: '7', suffix: '7', intervals: [0, 4, 7, 10] },
  { id: 'maj7', label: 'Maj7', suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'm7', label: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'sus2', label: 'Sus2', suffix: 'sus2', intervals: [0, 2, 7] },
  { id: 'sus4', label: 'Sus4', suffix: 'sus4', intervals: [0, 5, 7] },
  { id: 'add9', label: 'Add9', suffix: 'add9', intervals: [0, 2, 4, 7] },
  { id: 'dim', label: 'Diminué', suffix: 'dim', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Augmenté', suffix: 'aug', intervals: [0, 4, 8] },
  { id: '5', label: 'Quinte (5)', suffix: '5', intervals: [0, 7] },
];

const quality = (id: ChordQuality) => QUALITIES.find((q) => q.id === id)!;

export const chordName = (c: Chord) => `${ROOT_NAMES[c.root]}${quality(c.quality).suffix}`;

export const sameChord = (a: Chord | null, b: Chord | null) =>
  !!a && !!b && a.root === b.root && a.quality === b.quality;

/**
 * Best chord for the held notes, or null when there is not enough to tell (fewer than 2 pitch classes).
 * Scores every root × quality: matching notes count, extra or missing notes cost, and the bass note is
 * strongly favoured as root: what the left hand plays defines the chord, melody notes only colour it.
 */
export function detectChord(heldNotes: Iterable<number>): Chord | null {
  const notes = [...heldNotes];
  const classes = new Set(notes.map((n) => n % 12));
  if (classes.size < 2) return null;
  const bass = Math.min(...notes) % 12;

  let best: { chord: Chord; score: number } | null = null;
  for (let root = 0; root < 12; root++) {
    if (!classes.has(root)) continue;
    for (const q of QUALITIES) {
      const tones = new Set(q.intervals.map((i) => (root + i) % 12));
      let matched = 0;
      for (const c of classes) if (tones.has(c)) matched++;
      const extra = classes.size - matched;
      const missing = tones.size - matched;
      // Prefer simple triads on ties (order of QUALITIES), the bass as root, and penalise power chords.
      const score =
        matched * 3 -
        extra * 3 -
        missing * 2 +
        (root === bass ? 6 : 0) -
        QUALITIES.indexOf(q) * 0.01 -
        (q.id === '5' ? 1 : 0);
      if (!best || score > best.score) best = { chord: { root, quality: q.id }, score };
    }
  }
  return best && best.score > 0 ? best.chord : null;
}

/**
 * Open, pad-friendly voicing around `base` (MIDI note of a C, e.g. 48 = C3):
 * root, fifth, octave, then the third / colour notes an octave up (a "tenth" voicing, no muddy thirds low).
 */
export function padVoicing(chord: Chord, base: number): number[] {
  // Keep the root within a fifth of `base` so every key sits in the same register (B is played below C).
  const root = base + (chord.root <= 6 ? chord.root : chord.root - 12);
  const intervals = quality(chord.quality).intervals;
  const notes = new Set<number>([root, root + 12]);
  if (intervals.includes(7)) notes.add(root + 7);
  for (const i of intervals) if (i !== 0 && i !== 7) notes.add(root + 12 + i);
  return [...notes].sort((a, b) => a - b);
}
