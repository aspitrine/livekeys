export const DEFAULT_TEMPO = 120;
export const MIN_TEMPO = 20;
export const MAX_TEMPO = 300;

/** Whole BPM within what the native musical clock accepts; invalid values fall back to the default. */
export const clampTempo = (bpm: number) =>
  Number.isFinite(bpm) ? Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm))) : DEFAULT_TEMPO;

/** A pause longer than this starts a new tap sequence. */
const RESET_MS = 2000;
/** Average over the last intervals: steady enough, still follows a correction quickly. */
const INTERVALS = 4;

/**
 * Tap Tempo: adds a tap (ms timestamp) to the sequence and returns the kept taps and, from the second tap,
 * the tempo averaged over the last intervals.
 */
export function tapTempo(taps: readonly number[], now: number): { taps: number[]; bpm?: number } {
  const last = taps[taps.length - 1];
  const kept =
    last !== undefined && now > last && now - last <= RESET_MS ? [...taps, now].slice(-(INTERVALS + 1)) : [now];
  if (kept.length < 2) return { taps: kept };
  const average = (kept[kept.length - 1] - kept[0]) / (kept.length - 1);
  return { taps: kept, bpm: clampTempo(60_000 / average) };
}
