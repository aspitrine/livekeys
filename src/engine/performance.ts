import { create } from 'zustand';

import AudioEngine, { type PerformanceInfo } from '../../modules/audio-engine';

const POLL_MS = 1000;
const HISTORY = 60;

type PerformanceState = {
  current: PerformanceInfo | null;
  /** Average load of the last minute, one value per second (for the graph). */
  history: number[];
  /** Glitches counted since launch / last reset. */
  overloads: number;
  resetOverloads: () => void;
};

export const usePerformance = create<PerformanceState>((set) => ({
  current: null,
  history: [],
  overloads: 0,
  resetOverloads: () => set({ overloads: 0 }),
}));

let timer: ReturnType<typeof setInterval> | undefined;

/** Samples the engine's load once per second for the whole app session. */
export function startPerformanceMonitor() {
  if (timer) return;
  timer = setInterval(() => {
    try {
      const info = AudioEngine.getPerformance();
      usePerformance.setState((s) => ({
        current: info,
        history: [...s.history, info.load].slice(-HISTORY),
        overloads: s.overloads + info.overloads,
      }));
    } catch {
      // Engine not started yet.
    }
  }, POLL_MS);
}

/** Engine load in %: comfortable, getting busy, risk of glitches. */
export const loadLevel = (percent: number) => (percent < 50 ? 'ok' : percent < 75 ? 'busy' : 'critical');
